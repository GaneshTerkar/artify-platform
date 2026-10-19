package routes

import (
	"net/http"
	"strings"

	"github.com/ganeshterkar/artifyme-backend/cmd/internal/config"
	"github.com/ganeshterkar/artifyme-backend/cmd/internal/events"
	"github.com/ganeshterkar/artifyme-backend/cmd/internal/middleware"
	"github.com/ganeshterkar/artifyme-backend/cmd/internal/modules/artists"
	"github.com/ganeshterkar/artifyme-backend/cmd/internal/modules/auth"
	"github.com/ganeshterkar/artifyme-backend/cmd/internal/modules/files"
	"github.com/ganeshterkar/artifyme-backend/cmd/internal/modules/orders"
	"github.com/ganeshterkar/artifyme-backend/cmd/internal/modules/reviews"
	"github.com/ganeshterkar/artifyme-backend/cmd/internal/worker"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

func RegisterRoutes(r *gin.Engine, pool *pgxpool.Pool, cfg *config.Config, workerPool *worker.Pool, eventsRepo events.Repository, eventsRelay *events.Relay) {
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
		authGroup.POST("/refresh-token", authHandler.RefreshTokenHandler)
	}

	// Also register under /api/v1/auth
	v1AuthPublic := r.Group("/api/v1/auth")
	{
		v1AuthPublic.POST("/register", authHandler.RegisterHandler)
		v1AuthPublic.POST("/login", authHandler.LoginHandler)
		v1AuthPublic.POST("/refresh-token", authHandler.RefreshTokenHandler)
	}

	// ======================
	// PROTECTED ROUTES
	// ======================
	api := r.Group("/api")
	api.Use(middleware.AuthMiddleware(cfg.JWT.Secret))

	// ----------------------
	// MULTI-DEVICE SESSIONS
	// ----------------------
	api.GET("/auth/sessions", authHandler.ListSessionsHandler)
	api.DELETE("/auth/sessions/:id", authHandler.RevokeSessionHandler)
	api.POST("/auth/sessions/:id/revoke", authHandler.RevokeSessionHandler)
	api.POST("/auth/sessions/revoke-all", authHandler.RevokeAllOtherSessionsHandler)
	api.POST("/auth/sessions/revoke-others", authHandler.RevokeAllOtherSessionsHandler)

	// ----------------------
	// USER ROUTES
	// ----------------------
	api.GET("/me", func(c *gin.Context) {
		userID := c.MustGet("user_id").(uuid.UUID)
		c.JSON(200, gin.H{
			"user_id": userID.String(),
			"role":    c.MustGet("role").(string),
			"status":  c.MustGet("status").(string),
		})
	})

	api.GET("/user/profile", func(c *gin.Context) {
		userID := c.MustGet("user_id").(uuid.UUID)
		var u struct {
			UserID      string `json:"user_id"`
			FullName    string `json:"full_name"`
			Email       string `json:"email"`
			PhoneNumber string `json:"phone_number"`
			Address     string `json:"address"`
			Role        string `json:"role"`
			Status      string `json:"status"`
		}
		err := pool.QueryRow(c.Request.Context(), `
			SELECT user_id, full_name, email, phone_number, address, role::text, status::text
			FROM users WHERE user_id = $1
		`, userID).Scan(&u.UserID, &u.FullName, &u.Email, &u.PhoneNumber, &u.Address, &u.Role, &u.Status)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
			return
		}
		c.JSON(http.StatusOK, u)
	})

	api.PUT("/user/profile", func(c *gin.Context) {
		userID := c.MustGet("user_id").(uuid.UUID)
		var body struct {
			FullName    string `json:"full_name"`
			PhoneNumber string `json:"phone_number"`
			Address     string `json:"address"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
			return
		}
		var u struct {
			UserID      string `json:"user_id"`
			FullName    string `json:"full_name"`
			Email       string `json:"email"`
			PhoneNumber string `json:"phone_number"`
			Address     string `json:"address"`
			Role        string `json:"role"`
			Status      string `json:"status"`
		}
		err := pool.QueryRow(c.Request.Context(), `
			UPDATE users
			SET full_name = COALESCE(NULLIF($1, ''), full_name),
			    phone_number = COALESCE(NULLIF($2, ''), phone_number),
			    address = COALESCE(NULLIF($3, ''), address),
			    updated_at = NOW()
			WHERE user_id = $4
			RETURNING user_id, full_name, email, phone_number, address, role::text, status::text
		`, body.FullName, body.PhoneNumber, body.Address, userID).Scan(
			&u.UserID, &u.FullName, &u.Email, &u.PhoneNumber, &u.Address, &u.Role, &u.Status,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, u)
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
		admin.GET("/artists/:id/paintings", artistHandler.AdminGetArtistPaintings)
		admin.POST("/verify-artist/:id", artistHandler.VerifyArtist)
		admin.POST("/reject-artist/:id", artistHandler.RejectArtist)
	}

	r.GET("/artists/:id", artistHandler.GetPublicArtistProfile)

	// ======================
	// ======================
	// FILES / UPLOADS & PAINTINGS
	// ======================
	filesService := files.NewService(cfg)
	filesHandler := files.NewHandler(filesService)
	r.Static("/uploads", "./uploads")
	r.Static("/paintings", "./Paintings")

	// ======================
	// ORDERS & REVIEWS (v1)
	// ======================
	baseURL := "http://localhost:" + cfg.App.Port
	orderRepo := orders.NewRepository(pool)
	orderService := orders.NewService(orderRepo, filesService, baseURL, workerPool, eventsRepo, eventsRelay)
	orderHandler := orders.NewHandler(orderService, cfg)

	reviewRepo := reviews.NewRepository(pool)
	reviewService := reviews.NewService(reviewRepo, eventsRepo)
	reviewHandler := reviews.NewHandler(reviewService)

	v1 := r.Group("/api/v1")
	{
		v1.GET("/paintings", orderHandler.ListPaintings)
		v1.GET("/products", orderHandler.ListProducts)
		v1.GET("/products/price/estimate", orderHandler.EstimatePrice)
		v1.GET("/products/:id", orderHandler.GetProduct)
		v1.GET("/reviews/public", reviewHandler.ListPublicReviews)
	}

	v1Auth := v1.Group("")
	v1Auth.Use(middleware.AuthMiddleware(cfg.JWT.Secret), middleware.IdempotencyMiddleware(pool))
	{
		v1Auth.POST("/upload", filesHandler.Upload)
		v1Auth.POST("/orders", orderHandler.CreateOrder)
		v1Auth.GET("/orders", orderHandler.ListMyOrders)
		v1Auth.GET("/orders/:id", orderHandler.GetOrder)
		v1Auth.PATCH("/orders/:id", orderHandler.PatchOrder)
		v1Auth.POST("/orders/:id/checkout", orderHandler.Checkout)
		v1Auth.POST("/orders/:id/confirm-payment", orderHandler.ConfirmPayment)
		v1Auth.POST("/orders/:id/assign", orderHandler.AssignOrder)
		v1Auth.PATCH("/orders/:id/status", orderHandler.UpdateOrderStatus)
		v1Auth.GET("/artists/verified", orderHandler.ListVerifiedArtists)
		v1Auth.POST("/reviews", reviewHandler.CreateReview)
		v1Auth.GET("/reviews/order/:orderId", reviewHandler.GetReviewByOrder)
	}


	v1Admin := v1.Group("/admin")
	v1Admin.Use(middleware.AuthMiddleware(cfg.JWT.Secret), middleware.RoleMiddleware("ADMIN"), middleware.IdempotencyMiddleware(pool))
	{
		v1Admin.GET("/orders", orderHandler.AdminListOrders)
		v1Admin.PATCH("/orders/:id/status", orderHandler.AdminUpdateStatus)
		v1Admin.PATCH("/orders/:id/logistics", orderHandler.AdminUpdateLogistics)
		v1Admin.POST("/orders/:id/confirm-gallery", orderHandler.AdminConfirmGalleryPublish)
		v1Admin.POST("/orders/:id/assign-delivery", orderHandler.AssignDeliveryAgent)
		v1Admin.GET("/delivery-agents", orderHandler.ListActiveDeliveryAgents)
		v1Admin.GET("/users", orderHandler.AdminListUsers)
		v1Admin.PATCH("/users/:id/status", orderHandler.AdminUpdateUserStatus)
		v1Admin.PATCH("/users/:id/role", orderHandler.AdminElevateArtist)
		v1Admin.GET("/worker/stats", orderHandler.GetWorkerStats)
		v1Admin.GET("/events/stats", orderHandler.GetEventStats)
		v1Admin.GET("/reviews", reviewHandler.ListAdminReviews)
		v1Admin.GET("/reviews/stats", reviewHandler.GetReviewStats)
		v1Admin.PATCH("/reviews/:id/moderate", reviewHandler.ModerateReview)
		v1Admin.GET("/test-fixtures", orderHandler.AdminGetTestFixtures)
	}

	r.POST("/webhooks/stripe", orderHandler.StripeWebhook)

}
