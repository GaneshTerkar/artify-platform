package routes

import (
	"net/http"
	"strings"

	"github.com/ganeshterkar/artifyme-backend/cmd/internal/config"
	"github.com/ganeshterkar/artifyme-backend/cmd/internal/middleware"
	"github.com/ganeshterkar/artifyme-backend/cmd/internal/modules/artists"
	"github.com/ganeshterkar/artifyme-backend/cmd/internal/modules/auth"
	"github.com/ganeshterkar/artifyme-backend/cmd/internal/modules/files"
	"github.com/ganeshterkar/artifyme-backend/cmd/internal/modules/orders"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

func RegisterRoutes(r *gin.Engine, pool *pgxpool.Pool, cfg *config.Config) {
	// ======================
	// Root & Health Check
	// ======================
	r.GET("/", func(c *gin.Context) {
		accept := c.GetHeader("Accept")
		if strings.Contains(accept, "text/html") {
			c.Redirect(http.StatusTemporaryRedirect, "/swagger/index.html")
			return
		}
		c.JSON(200, gin.H{
			"service":      "ArtifyMe Backend API",
			"status":       "running",
			"swagger_docs": "/swagger/index.html",
			"health":       "/health",
			"frontend_url": "http://localhost:5173",
		})
	})

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})
	r.GET("/healthz", func(c *gin.Context) {
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

	// ======================
	// ORDERS / CATALOG (v1)
	// ======================
	orderRepo := orders.NewRepository(pool)
	orderService := orders.NewService(orderRepo)
	orderHandler := orders.NewHandler(orderService, cfg)

	// ======================
	// FILES / UPLOADS & PAINTINGS
	// ======================
	filesService := files.NewService(cfg)
	filesHandler := files.NewHandler(filesService)
	r.Static("/uploads", "./uploads")
	r.Static("/paintings", "./Paintings")

	v1 := r.Group("/api/v1")
	{
		v1.GET("/paintings", orderHandler.ListPaintings)
		v1.GET("/products", orderHandler.ListProducts)
		v1.GET("/products/price/estimate", orderHandler.EstimatePrice)
		v1.GET("/products/:id", orderHandler.GetProduct)
	}

	v1Auth := v1.Group("")
	v1Auth.Use(middleware.AuthMiddleware(cfg.JWT.Secret))
	{
		v1Auth.POST("/upload", filesHandler.Upload)
		v1Auth.POST("/orders", orderHandler.CreateOrder)
		v1Auth.GET("/orders", orderHandler.ListMyOrders)
		v1Auth.GET("/orders/:id", orderHandler.GetOrder)
		v1Auth.PATCH("/orders/:id", orderHandler.PatchOrder)
		v1Auth.POST("/orders/:id/checkout", orderHandler.Checkout)
		v1Auth.POST("/orders/:id/assign", orderHandler.AssignOrder)
		v1Auth.GET("/artists/verified", orderHandler.ListVerifiedArtists)
	}


	v1Admin := v1.Group("/admin")
	v1Admin.Use(middleware.AuthMiddleware(cfg.JWT.Secret), middleware.RoleMiddleware("ADMIN"))
	{
		v1Admin.GET("/orders", orderHandler.AdminListOrders)
		v1Admin.PATCH("/orders/:id/status", orderHandler.AdminUpdateStatus)
	}

	r.POST("/webhooks/stripe", orderHandler.StripeWebhook)

}
