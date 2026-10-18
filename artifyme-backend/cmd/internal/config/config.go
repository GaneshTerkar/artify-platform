package config

import (
	"log/slog"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	App      AppConfig
	Database DatabaseConfig
	JWT      JWTConfig
	CORS     CORSConfig
	Stripe   StripeConfig
	S3       S3Config
	Email    EmailConfig
	Redis    RedisConfig
	Kafka    KafkaConfig
}

type KafkaConfig struct {
	Brokers []string
	Topic   string
	Enabled bool
}

type RedisConfig struct {
	Addr     string
	Password string
	DB       int
}

type S3Config struct {
	Endpoint        string
	Region          string
	Bucket          string
	AccessKey       string
	SecretKey       string
	UseSSL          bool
	PublicDomain    string // For CDN or public access if needed
}

type EmailConfig struct {
	Provider string // e.g., "resend", "smtp"
	APIKey   string
	From     string
}

type CORSConfig struct {
	AllowedOrigins string
}

type StripeConfig struct {
	SecretKey     string
	WebhookSecret string
	SuccessURL    string
	CancelURL     string
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
		CORS: CORSConfig{
			AllowedOrigins: getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:5173"),
		},
		Stripe: StripeConfig{
			SecretKey:     getEnv("STRIPE_SECRET_KEY", ""),
			WebhookSecret: getEnv("STRIPE_WEBHOOK_SECRET", ""),
			SuccessURL:    getEnv("STRIPE_SUCCESS_URL", "http://localhost:5173/order/success"),
			CancelURL:     getEnv("STRIPE_CANCEL_URL", "http://localhost:5173/order/cancel"),
		},
		S3: S3Config{
			Endpoint:     getEnv("S3_ENDPOINT", "http://localhost:9000"),
			Region:       getEnv("S3_REGION", "us-east-1"),
			Bucket:       getEnv("S3_BUCKET", "artifyme"),
			AccessKey:    getEnv("S3_ACCESS_KEY", "minioadmin"),
			SecretKey:    getEnv("S3_SECRET_KEY", "minioadmin"),
			UseSSL:       getEnv("S3_USE_SSL", "false") == "true",
			PublicDomain: getEnv("S3_PUBLIC_DOMAIN", ""),
		},
		Email: EmailConfig{
			Provider: getEnv("EMAIL_PROVIDER", "log"),
			APIKey:   getEnv("EMAIL_API_KEY", ""),
			From:     getEnv("EMAIL_FROM", "noreply@artifyme.com"),
		},
		Redis: RedisConfig{
			Addr:     getEnv("REDIS_ADDR", "localhost:6379"),
			Password: getEnv("REDIS_PASSWORD", ""),
			DB:       getEnvAsInt("REDIS_DB", 0),
		},
		Kafka: KafkaConfig{
			Brokers: strings.Split(getEnv("KAFKA_BROKERS", "localhost:9092"), ","),
			Topic:   getEnv("KAFKA_TOPIC", "artifyme.events"),
			Enabled: getEnv("KAFKA_ENABLED", "true") == "true",
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
