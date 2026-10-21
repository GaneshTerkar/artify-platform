package main

import (
	"context"
	"log/slog"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"

	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"

	_ "github.com/ganeshterkar/artifyme-backend/docs"

	"github.com/ganeshterkar/artifyme-backend/cmd/internal/cache"
	"github.com/ganeshterkar/artifyme-backend/cmd/internal/config"
	"github.com/ganeshterkar/artifyme-backend/cmd/internal/db"
	"github.com/ganeshterkar/artifyme-backend/cmd/internal/events"
	"github.com/ganeshterkar/artifyme-backend/cmd/internal/logger"
	"github.com/ganeshterkar/artifyme-backend/cmd/internal/middleware"
	"github.com/ganeshterkar/artifyme-backend/cmd/internal/routes"
	"github.com/ganeshterkar/artifyme-backend/cmd/internal/worker"
)

// @title ArtifyMe Backend API
// @version 1.0
// @description Backend API for ArtifyMe platform
// @termsOfService http://swagger.io/terms/

// @contact.name Ganesh Terkar
// @contact.email ganesh@example.com

// @license.name MIT
// @license.url https://opensource.org/licenses/MIT

// @host localhost:8080
// @BasePath /

// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
func main() {

	// Load .env ONLY for local/dev
	if os.Getenv("APP_ENV") != "production" {
		_ = godotenv.Load()
	}

	// Logger first
	logger.InitLogger()

	// Load config
	cfg := config.Load()

	// Payment safety rails: refuse to start on an unsafe provider/key combination.
	if err := cfg.ValidatePayments(); err != nil {
		slog.Error("payment configuration invalid", "error", err)
		panic(err)
	}
	if cfg.Payment.Provider == "razorpay" {
		if cfg.Payment.Live {
			slog.Warn("LIVE PAYMENTS ENABLED - real money will be charged", "provider", "razorpay", "key_id", cfg.Payment.RazorpayKeyID)
		} else {
			slog.Info("Razorpay TEST mode enabled (no real money)", "key_id", cfg.Payment.RazorpayKeyID)
		}
	} else {
		slog.Info("payments running in manual mode (admin confirms PLACED -> CONFIRMED)")
	}

	// DB connection
	ctx, cancel := context.WithTimeout(
		context.Background(),
		cfg.Database.ConnectTimeout,
	)
	defer cancel()

	pool, err := pgxpool.New(ctx, cfg.Database.URL)
	if err != nil {
		panic(err)
	}
	defer pool.Close()

	slog.Info("PostgreSQL pool connected")
	_ = cache.Init(cfg.Redis)

	// Run DB migrations
	if err := db.RunMigrations(
		cfg.Database.URL,
		cfg.Database.DBMigrationsPath,
	); err != nil {
		slog.Error("database migration failed", "error", err)
		panic(err)
	}

	slog.Info(
		"Configuration loaded",
		"env", cfg.App.Env,
		"port", cfg.App.Port,
	)

	// Gin mode
	if cfg.App.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.Default()
	r.Use(middleware.CORSMiddleware(cfg.CORS.AllowedOrigins))

	// Swagger
	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// Initialize asynchronous Worker Pool (4 workers, 100 job capacity)
	workerPool := worker.NewPool(4, 100)
	workerPool.Start()
	defer workerPool.Stop()

	// Initialize Transactional Outbox Relay for Redpanda / Kafka event streaming
	eventsRepo := events.NewRepository(pool)
	eventsRelay := events.NewRelay(eventsRepo, cfg.Kafka.Brokers, cfg.Kafka.Topic, cfg.Kafka.Enabled)
	eventsRelay.Start()
	defer eventsRelay.Stop()

	// Routes
	routes.RegisterRoutes(r, pool, cfg, workerPool, eventsRepo, eventsRelay)

	slog.Info("Server running", "port", cfg.App.Port)

	if err := r.Run(":" + cfg.App.Port); err != nil {
		panic(err)
	}
}
