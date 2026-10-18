package middleware

import (
	"bytes"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/ganeshterkar/artifyme-backend/cmd/internal/cache"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type bodyWriter struct {
	gin.ResponseWriter
	body *bytes.Buffer
}

func (w *bodyWriter) Write(b []byte) (int, error) {
	w.body.Write(b)
	return w.ResponseWriter.Write(b)
}

func (w *bodyWriter) WriteString(s string) (int, error) {
	w.body.WriteString(s)
	return w.ResponseWriter.WriteString(s)
}

type IdempotencyCachedResponse struct {
	Status int    `json:"status"`
	Body   string `json:"body"`
	State  string `json:"state"` // "PROCESSING" or "COMPLETED"
}

// IdempotencyMiddleware ensures operations carrying an Idempotency-Key or X-Idempotency-Key
// are executed at most once, returning cached responses for duplicates and blocking parallel races.
func IdempotencyMiddleware(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Only check mutations (POST, PUT, PATCH, DELETE)
		if c.Request.Method == http.MethodGet || c.Request.Method == http.MethodOptions || c.Request.Method == http.MethodHead {
			c.Next()
			return
		}

		key := strings.TrimSpace(c.GetHeader("Idempotency-Key"))
		if key == "" {
			key = strings.TrimSpace(c.GetHeader("X-Idempotency-Key"))
		}

		// If no idempotency key is passed, allow request through normally
		if key == "" {
			c.Next()
			return
		}

		if len(key) < 4 || len(key) > 128 {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
				"error": "Idempotency-Key must be between 4 and 128 characters",
			})
			return
		}

		ctx := c.Request.Context()
		redisKey := fmt.Sprintf("idemp:%s", key)

		// 1. Check Redis cache first (sub-millisecond fast path)
		var cached IdempotencyCachedResponse
		if cache.Get(ctx, redisKey, &cached) {
			if cached.State == "PROCESSING" {
				c.AbortWithStatusJSON(http.StatusConflict, gin.H{
					"error": "a request with this idempotency key is currently processing, please wait",
				})
				return
			}
			if cached.State == "COMPLETED" {
				c.Header("X-Cache", "IDEMPOTENT-HIT")
				c.Header("Content-Type", "application/json")
				c.String(cached.Status, cached.Body)
				c.Abort()
				return
			}
		}

		// 2. Check PostgreSQL database fallback
		var status string
		var respCode sql.NullInt32
		var respBody sql.NullString
		var expiresAt time.Time

		err := pool.QueryRow(ctx, `
			SELECT status, response_code, response_body, expires_at 
			FROM api_idempotency_keys 
			WHERE key = $1 AND expires_at > NOW()
		`, key).Scan(&status, &respCode, &respBody, &expiresAt)

		if err == nil {
			if status == "PROCESSING" {
				c.AbortWithStatusJSON(http.StatusConflict, gin.H{
					"error": "a request with this idempotency key is currently processing, please wait",
				})
				return
			}
			if status == "COMPLETED" && respCode.Valid && respBody.Valid {
				// Repopulate Redis cache for remaining time
				ttl := time.Until(expiresAt)
				if ttl > 0 {
					_ = cache.Set(ctx, redisKey, IdempotencyCachedResponse{
						Status: int(respCode.Int32),
						Body:   respBody.String,
						State:  "COMPLETED",
					}, ttl)
				}
				c.Header("X-Cache", "IDEMPOTENT-HIT")
				c.Header("Content-Type", "application/json")
				c.String(int(respCode.Int32), respBody.String)
				c.Abort()
				return
			}
		} else if !errors.Is(err, pgx.ErrNoRows) {
			slog.Warn("Failed to check idempotency database table", "key", key, "error", err)
		}

		// 3. Acquire distributed lock for this key to prevent in-flight concurrent double-clicks
		lockKey := "lock:idemp:" + key
		lockToken := uuid.New().String()
		acquired, lockErr := cache.AcquireLock(ctx, lockKey, lockToken, 10*time.Second)
		if lockErr != nil || !acquired {
			c.AbortWithStatusJSON(http.StatusConflict, gin.H{
				"error": "concurrent request with identical idempotency key detected",
			})
			return
		}
		defer cache.ReleaseLock(ctx, lockKey, lockToken)

		// 4. Record 'PROCESSING' state in DB and Redis
		var userID *uuid.UUID
		if uVal, exists := c.Get("user_id"); exists {
			if uid, ok := uVal.(uuid.UUID); ok && uid != uuid.Nil {
				userID = &uid
			}
		}

		_, err = pool.Exec(ctx, `
			INSERT INTO api_idempotency_keys (key, user_id, request_path, status, expires_at)
			VALUES ($1, $2, $3, 'PROCESSING', NOW() + INTERVAL '24 hours')
			ON CONFLICT (key) DO UPDATE
			SET status = 'PROCESSING', expires_at = NOW() + INTERVAL '24 hours'
			WHERE api_idempotency_keys.expires_at < NOW()
		`, key, userID, c.Request.URL.Path)

		if err != nil {
			slog.Warn("Failed to insert idempotency tracking row", "key", key, "error", err)
		}

		_ = cache.Set(ctx, redisKey, IdempotencyCachedResponse{State: "PROCESSING"}, 2*time.Minute)

		// 5. Wrap response writer to capture status code and body
		bw := &bodyWriter{ResponseWriter: c.Writer, body: bytes.NewBuffer(nil)}
		c.Writer = bw

		c.Next()

		// 6. After handler execution, persist response if not 5xx internal server error
		statusCode := c.Writer.Status()
		bodyStr := bw.body.String()

		if statusCode < 500 {
			_, _ = pool.Exec(context.Background(), `
				UPDATE api_idempotency_keys
				SET status = 'COMPLETED',
					response_code = $2,
					response_body = $3,
					expires_at = NOW() + INTERVAL '24 hours'
				WHERE key = $1
			`, key, statusCode, bodyStr)

			_ = cache.Set(context.Background(), redisKey, IdempotencyCachedResponse{
				Status: statusCode,
				Body:   bodyStr,
				State:  "COMPLETED",
			}, 24*time.Hour)
		} else {
			// On server error (500), clean up so the client can fix and retry
			_, _ = pool.Exec(context.Background(), "DELETE FROM api_idempotency_keys WHERE key = $1", key)
			_ = cache.Delete(context.Background(), redisKey)
		}
	}
}
