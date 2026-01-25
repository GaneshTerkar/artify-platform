package routes

import (
	"github.com/ganeshterkar/artifyme-backend/cmd/internal/config"
	"github.com/ganeshterkar/artifyme-backend/cmd/internal/middleware"
	"github.com/ganeshterkar/artifyme-backend/cmd/internal/modules/artists"
	"github.com/ganeshterkar/artifyme-backend/cmd/internal/modules/auth"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

func RegisterRoutes(r *gin.Engine, pool *pgxpool.Pool, cfg *config.Config) {
	// ======================
	// Health Check
	// ======================
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	// ======================
	// AUTH SETUP
	// ======================
	authRepo := auth.NewRepository(pool)
	authService := auth.NewService(authRepo)
	authHandler := auth.NewHandler(authService, cfg.JWT.Secret)

	authGroup := r.Group("/auth")
	{
		authGroup.POST("/register", authHandler.RegisterHandler)
		authGroup.POST("/login", authHandler.LoginHandler)
	}

	// ======================
	// PROTECTED ROUTES
	// ======================
	api := r.Group("/api")
	api.Use(middleware.AuthMiddleware(cfg.JWT.Secret))

	// ----------------------
	// USER ROUTES
	// ----------------------
	api.GET("/me", func(c *gin.Context) {
		userID := c.MustGet("user_id").(uuid.UUID)
		c.JSON(200, gin.H{
			"user_id": userID.String(),
			"role":    c.MustGet("role").(string),
			"status": c.MustGet("status").(string),
		})
	})

	// ======================
	// ARTIST SETUP
	// ======================
	artistRepo := artists.NewRepository(pool)
	artistService := artists.NewService(artistRepo)
	artistHandler := artists.NewHandler(artistService)

	artist := api.Group("/artist")
	artist.Use(
		middleware.RoleMiddleware("ARTIST"),
	)
	{
		artist.POST("/profile", artistHandler.CreateOrUpdateProfile)
		artist.GET("/profile/view", artistHandler.GetMyProfile)
		artist.GET("/profile/review-status", artistHandler.MyReviewStatus)

		// paintings
		artistPaintings := artist.Group("/paintings")
		artistPaintings.Use(
			middleware.StatusMiddleware("PENDING", "UNDER_REVIEW", "ACTIVE"),
		)
		{
			artistPaintings.GET("/", artistHandler.MyPaintings)
			artistPaintings.POST("/add", artistHandler.AddPainting)
		}
		
	}

	admin := api.Group("/admin")
	admin.Use(middleware.RoleMiddleware("ADMIN"))
	{
		admin.GET("/artists/review-queue", artistHandler.AdminReviewQueue)
		admin.POST("/verify-artist/:id", artistHandler.VerifyArtist)
		admin.POST("/reject-artist/:id", artistHandler.RejectArtist)
	}

	r.GET("/artists/:id", artistHandler.GetPublicArtistProfile)

}
