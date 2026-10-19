package reviews

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

type createReviewRequest struct {
	OrderID          string  `json:"order_id" binding:"required"`
	Rating           int     `json:"rating" binding:"required"`
	Title            string  `json:"title"`
	Comment          string  `json:"comment" binding:"required"`
	UnboxingPhotoURL *string `json:"unboxing_photo_url"`
}

func (h *Handler) CreateReview(c *gin.Context) {
	customerID := c.MustGet("user_id").(uuid.UUID)

	var req createReviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload: " + err.Error()})
		return
	}

	orderID, err := uuid.Parse(req.OrderID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid order_id format"})
		return
	}

	rev, err := h.service.CreateReview(c.Request.Context(), customerID, CreateReviewInput{
		OrderID:          orderID,
		Rating:           req.Rating,
		Title:            req.Title,
		Comment:          req.Comment,
		UnboxingPhotoURL: req.UnboxingPhotoURL,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "review submitted successfully",
		"review":  rev,
	})
}

func (h *Handler) GetReviewByOrder(c *gin.Context) {
	orderID, err := uuid.Parse(c.Param("orderId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid order id"})
		return
	}

	rev, err := h.service.GetReviewByOrderID(c.Request.Context(), orderID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"review": rev})
}

func (h *Handler) ListPublicReviews(c *gin.Context) {
	limit := 20
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	reviews, err := h.service.ListPublicReviews(c.Request.Context(), limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"reviews": reviews})
}

func (h *Handler) ListAdminReviews(c *gin.Context) {
	var minRating, maxRating *int
	if minStr := c.Query("min_rating"); minStr != "" {
		if val, err := strconv.Atoi(minStr); err == nil {
			minRating = &val
		}
	}
	if maxStr := c.Query("max_rating"); maxStr != "" {
		if val, err := strconv.Atoi(maxStr); err == nil {
			maxRating = &val
		}
	}

	var isFeatured, isApproved *bool
	if featStr := c.Query("is_featured"); featStr != "" {
		val := featStr == "true"
		isFeatured = &val
	}
	if appStr := c.Query("is_approved"); appStr != "" {
		val := appStr == "true"
		isApproved = &val
	}

	reviews, err := h.service.ListAdminReviews(c.Request.Context(), minRating, maxRating, isFeatured, isApproved)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"reviews": reviews})
}

func (h *Handler) ModerateReview(c *gin.Context) {
	reviewID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid review id"})
		return
	}

	var in ModerateReviewInput
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload: " + err.Error()})
		return
	}

	rev, err := h.service.ModerateReview(c.Request.Context(), reviewID, in)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "review moderation updated successfully",
		"review":  rev,
	})
}

func (h *Handler) GetReviewStats(c *gin.Context) {
	stats, err := h.service.GetReviewStats(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, stats)
}
