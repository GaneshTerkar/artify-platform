package config

import (
	"log/slog"
	"os"
	"path/filepath"
	"strconv"
	"time"
)

type Config struct {
	App      AppConfig
	Database DatabaseConfig
	JWT      JWTConfig
}

type AppConfig struct {
	Port string
	Env  string
}

type DatabaseConfig struct {
	URL              string
	DBMigrationsPath string
	ConnectTimeout   time.Duration
}

type JWTConfig struct {
	Secret       string
	ExpiryHours  int
	RefreshHours int
}

func Load() *Config {
	slog.Debug("Loading application configuration")

	cfg := &Config{
		App: AppConfig{
			Port: getEnv("PORT", "8080"),
			Env:  getEnv("APP_ENV", "development"),
		},
		Database: DatabaseConfig{
			URL:              mustGetEnv("DATABASE_URL"),
			DBMigrationsPath: resolveMigrationPath(
				getEnv("MIGRATIONS_PATH", "cmd/migrations"),
			),
			ConnectTimeout: 5 * time.Second,
		},
		JWT: JWTConfig{
			Secret:       mustGetEnv("JWT_SECRET"),
			ExpiryHours:  getEnvAsInt("JWT_EXPIRES_IN", 24),
			RefreshHours: getEnvAsInt("JWT_REFRESH_HOURS", 168),
		},
	}

	return cfg
}

/* ======================
   Helpers
====================== */

func projectRoot() string {
	cwd, err := os.Getwd()
	if err != nil {
		panic("unable to determine working directory")
	}
	return cwd
}

func resolveMigrationPath(path string) string {
	if filepath.IsAbs(path) {
		return path
	}
	return filepath.Join(projectRoot(), path)
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		slog.Debug("Environment variable loaded", "key", "value", key, v)
		return v
	}
	return fallback
}

func mustGetEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		slog.Error("Required environment variable missing", "key", "value",  key, v)
		panic("Required environment variable missing: " + key)
	}
	return v
}

func getEnvAsInt(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}

	val, err := strconv.Atoi(v)
	if err != nil {
		panic("Invalid integer env var: " + key)
	}
	return val
}
