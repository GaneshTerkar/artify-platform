package cache

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/ganeshterkar/artifyme-backend/cmd/internal/config"
	"github.com/redis/go-redis/v9"
)

var (
	// Client is the global Redis client instance
	Client *redis.Client

	// ErrLockNotAcquired is returned when a distributed lock could not be obtained
	ErrLockNotAcquired = errors.New("distributed lock could not be acquired")
)

// Init initializes the Redis connection pool and verifies connectivity.
func Init(cfg config.RedisConfig) error {
	opts := &redis.Options{
		Addr:         cfg.Addr,
		Password:     cfg.Password,
		DB:           cfg.DB,
		PoolSize:     20,
		MinIdleConns: 5,
		DialTimeout:  3 * time.Second,
		ReadTimeout:  2 * time.Second,
		WriteTimeout: 2 * time.Second,
	}

	Client = redis.NewClient(opts)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	pong, err := Client.Ping(ctx).Result()
	if err != nil {
		slog.Warn("Redis connection failed (caching disabled)", "addr", cfg.Addr, "error", err)
		return err
	}

	slog.Info("Redis connected successfully", "addr", cfg.Addr, "ping", pong)
	return nil
}

// Get fetches a cached JSON payload and unmarshals it into dest.
// Returns true on cache HIT, false on cache MISS or error.
func Get(ctx context.Context, key string, dest interface{}) bool {
	if Client == nil {
		return false
	}

	val, err := Client.Get(ctx, key).Bytes()
	if err != nil {
		return false
	}

	if err := json.Unmarshal(val, dest); err != nil {
		slog.Warn("Failed to unmarshal cached JSON", "key", key, "error", err)
		return false
	}

	return true
}

// Set serializes val to JSON and caches it in Redis with the given TTL.
func Set(ctx context.Context, key string, val interface{}, ttl time.Duration) error {
	if Client == nil {
		return nil
	}

	bytes, err := json.Marshal(val)
	if err != nil {
		return fmt.Errorf("failed to marshal cache value: %w", err)
	}

	return Client.Set(ctx, key, bytes, ttl).Err()
}

// Delete removes one or more keys from Redis.
func Delete(ctx context.Context, keys ...string) error {
	if Client == nil || len(keys) == 0 {
		return nil
	}
	return Client.Del(ctx, keys...).Err()
}

// DeletePattern evicts all keys matching the given glob pattern (e.g. "cache:gallery:*").
func DeletePattern(ctx context.Context, pattern string) error {
	if Client == nil {
		return nil
	}

	iter := Client.Scan(ctx, 0, pattern, 0).Iterator()
	var keys []string
	for iter.Next(ctx) {
		keys = append(keys, iter.Val())
	}
	if err := iter.Err(); err != nil {
		return err
	}

	if len(keys) > 0 {
		return Client.Del(ctx, keys...).Err()
	}
	return nil
}

// AcquireLock attempts to obtain a distributed lock for key with a unique token and TTL.
// Returns true if the lock was successfully acquired, false if already held.
func AcquireLock(ctx context.Context, lockKey string, token string, ttl time.Duration) (bool, error) {
	if Client == nil {
		// In-memory fallback if Redis is unavailable: allow single-node operation
		return true, nil
	}

	fullKey := "lock:" + lockKey
	acquired, err := Client.SetNX(ctx, fullKey, token, ttl).Result()
	if err != nil {
		return false, fmt.Errorf("redis lock error: %w", err)
	}
	return acquired, nil
}

// ReleaseLock releases a distributed lock ONLY if the token matches the current lock owner.
// Uses an atomic Lua script to guarantee safe lock release.
func ReleaseLock(ctx context.Context, lockKey string, token string) (bool, error) {
	if Client == nil {
		return true, nil
	}

	fullKey := "lock:" + lockKey
	luaScript := `
		if redis.call("get", KEYS[1]) == ARGV[1] then
			return redis.call("del", KEYS[1])
		else
			return 0
		end
	`

	res, err := Client.Eval(ctx, luaScript, []string{fullKey}, token).Int()
	if err != nil {
		return false, fmt.Errorf("redis unlock script error: %w", err)
	}

	return res == 1, nil
}
