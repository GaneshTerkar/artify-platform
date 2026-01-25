package middleware

import (
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

func AuthMiddleware(jwtSecret string) gin.HandlerFunc {
	slog.Info("Auth middleware initialized")

	return func(c *gin.Context) {

		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			slog.Debug("Authorization header missing")
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "authorization header missing",
			})
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			slog.Debug("Invalid authorization header format", "header", authHeader)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "invalid authorization format",
			})
			return
		}

		tokenStr := parts[1]

		token, err := jwt.ParseWithClaims(
			tokenStr,
			jwt.MapClaims{},
			func(t *jwt.Token) (interface{}, error) {
				if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, errors.New("unexpected signing method")
				}
				return []byte(jwtSecret), nil
			},
		)

		if err != nil {
			slog.Debug("JWT parse failed", "error", err)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "invalid token",
			})
			return
		}

		if !token.Valid {
			slog.Debug("JWT validation failed")
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "token not valid",
			})
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			slog.Debug("Invalid JWT claims type")
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "invalid token claims",
			})
			return
		}

		// user_id
		userIDStr, ok := claims["user_id"].(string)
		if !ok {
			slog.Debug("user_id missing in JWT claims")
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "user_id missing in token",
			})
			return
		}

		userID, err := uuid.Parse(userIDStr)
		if err != nil {
			slog.Debug("Invalid user_id format", "user_id", userIDStr)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "invalid user_id",
			})
			return
		}

		// role
		role, ok := claims["role"].(string)
		if !ok {
			slog.Debug("role missing in JWT claims", "user_id", userID)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "role missing in token",
			})
			return
		}

		// status (optional)
		status, _ := claims["status"].(string)

		// Attach to context
		c.Set("user_id", userID)
		c.Set("role", role)
		c.Set("status", status)

		slog.Debug(
			"Authenticated request",
			"user_id", userID,
			"role", role,
			"status", status,
			"path", c.Request.URL.Path,
		)

		c.Next()
	}
}
