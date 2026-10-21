package config

import (
	"fmt"
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
	Payment  PaymentConfig
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

// PaymentConfig controls the payment provider. "manual" (default) keeps the
// development mock checkout: the order stays PLACED until an admin confirms
// the payment. "razorpay" enables real/test gateway payments.
//
// Live charging requires BOTH Provider == "razorpay" AND Live == true. This is
// deliberately explicit so a live key can never start charging by accident.
type PaymentConfig struct {
	Provider              string
	Live                  bool
	RazorpayKeyID         string
	RazorpayKeySecret     string
	RazorpayWebhookSecret string
	RazorpayAPIBase       string
	MinAmount             float64
	MaxAmount             float64
}

// ValidatePayments checks the payment configuration and fails fast on unsafe
// combinations (for example a live key while PAYMENTS_LIVE is false).
func (c *Config) ValidatePayments() error {
	switch strings.ToLower(strings.TrimSpace(c.Payment.Provider)) {
	case "", "manual":
		c.Payment.Provider = "manual"
		return nil
	case "razorpay":
		c.Payment.Provider = "razorpay"
		if c.Payment.RazorpayKeyID == "" || c.Payment.RazorpayKeySecret == "" {
			return fmt.Errorf("PAYMENT_PROVIDER=razorpay requires RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET")
		}
		if c.Payment.RazorpayWebhookSecret == "" {
			return fmt.Errorf("PAYMENT_PROVIDER=razorpay requires RAZORPAY_WEBHOOK_SECRET (webhook signatures cannot be verified without it)")
		}
		if !c.Payment.Live && strings.HasPrefix(c.Payment.RazorpayKeyID, "rzp_live_") {
			return fmt.Errorf("refusing to start: RAZORPAY_KEY_ID is a LIVE key but PAYMENTS_LIVE=false (set PAYMENTS_LIVE=true to charge real money)")
		}
		if c.Payment.Live && strings.HasPrefix(c.Payment.RazorpayKeyID, "rzp_test_") {
			return fmt.Errorf("PAYMENTS_LIVE=true but RAZORPAY_KEY_ID is a TEST key (use rzp_live_... or set PAYMENTS_LIVE=false)")
		}
		if c.Payment.MinAmount <= 0 || c.Payment.MaxAmount < c.Payment.MinAmount {
			return fmt.Errorf("invalid payment amount limits: min=%v max=%v", c.Payment.MinAmount, c.Payment.MaxAmount)
		}
		return nil
	default:
		return fmt.Errorf("unknown PAYMENT_PROVIDER %q (use manual or razorpay)", c.Payment.Provider)
	}
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
		Payment: PaymentConfig{
			Provider:              getEnv("PAYMENT_PROVIDER", "manual"),
			Live:                  getEnv("PAYMENTS_LIVE", "false") == "true",
			RazorpayKeyID:         getEnv("RAZORPAY_KEY_ID", ""),
			RazorpayKeySecret:     getEnv("RAZORPAY_KEY_SECRET", ""),
			RazorpayWebhookSecret: getEnv("RAZORPAY_WEBHOOK_SECRET", ""),
			RazorpayAPIBase:       strings.TrimRight(getEnv("RAZORPAY_API_BASE", "https://api.razorpay.com"), "/"),
			MinAmount:             getEnvAsFloat("PAYMENT_MIN_AMOUNT", 100),
			MaxAmount:             getEnvAsFloat("PAYMENT_MAX_AMOUNT", 200000),
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

func getEnvAsFloat(key string, fallback float64) float64 {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	val, err := strconv.ParseFloat(v, 64)
	if err != nil {
		panic("Invalid float env var: " + key)
	}
	return val
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
