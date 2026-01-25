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

	"github.com/ganeshterkar/artifyme-backend/cmd/internal/config"
	"github.com/ganeshterkar/artifyme-backend/cmd/internal/db"
	"github.com/ganeshterkar/artifyme-backend/cmd/internal/logger"
	"github.com/ganeshterkar/artifyme-backend/cmd/internal/routes"
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

	// Swagger
	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// Routes
	routes.RegisterRoutes(r, pool, cfg)

	slog.Info("Server running", "port", cfg.App.Port)

	if err := r.Run(":" + cfg.App.Port); err != nil {
		panic(err)
	}
}
