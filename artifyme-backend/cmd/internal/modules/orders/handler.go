package orders

import (
	"net/http"

	"github.com/ganeshterkar/artifyme-backend/cmd/internal/config"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	service *Service
	cfg     *config.Config
}

func NewHandler(service *Service, cfg *config.Config) *Handler {
	return &Handler{service: service, cfg: cfg}
}

type createOrderRequest struct {
	PaintingCategory  string  `json:"painting_category" binding:"required"`
	ReferenceImageURL string  `json:"reference_image_url" binding:"required"`
	Size              string  `json:"size" binding:"required"`
	PersonsIncluded   string  `json:"persons_included" binding:"required"`
	DeliveryAddress   string  `json:"delivery_address" binding:"required"`
	CustomerNotes     *string `json:"customer_notes"`
}

type updateOrderRequest struct {
	PaintingCategory  string  `json:"painting_category"`
	ReferenceImageURL string  `json:"reference_image_url"`
	Size              string  `json:"size"`
	PersonsIncluded   string  `json:"persons_included"`
	DeliveryAddress   string  `json:"delivery_address"`
	CustomerNotes     *string `json:"customer_notes"`
}

type adminStatusRequest struct {
	Status        string  `json:"status" binding:"required"`
	ArtistID      *string `json:"artist_id"`
	FinalImageURL *string `json:"final_image_url"`
}

func (h *Handler) ListProducts(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"products": h.service.ListProducts()})
}

func (h *Handler) ListPaintings(c *gin.Context) {
	category := c.Query("category")
	paintings, err := h.service.ListGalleryPaintings(c.Request.Context(), category)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"paintings": paintings})
}

func (h *Handler) GetProduct(c *gin.Context) {
	p, err := h.service.GetProduct(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, p)
}

func (h *Handler) EstimatePrice(c *gin.Context) {
	category := c.Query("category")
	size := c.Query("size")
	persons := c.Query("persons")
	c.JSON(http.StatusOK, gin.H{
		"estimated_total": EstimatePrice(category, size, persons),
		"currency":        "INR",
	})
}

func (h *Handler) CreateOrder(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	var req createOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	o, err := h.service.CreateOrder(c.Request.Context(), userID, CreateOrderInput{
		UserID:            userID,
		PaintingCategory:  req.PaintingCategory,
		ReferenceImageURL: req.ReferenceImageURL,
		Size:              req.Size,
		PersonsIncluded:   req.PersonsIncluded,
		DeliveryAddress:   req.DeliveryAddress,
		CustomerNotes:     req.CustomerNotes,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, toOrderDTO(o))
}

func (h *Handler) ListMyOrders(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	list, err := h.service.ListMyOrders(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	out := make([]orderDTO, 0, len(list))
	for i := range list {
		out = append(out, toOrderDTO(&list[i]))
	}
	c.JSON(http.StatusOK, gin.H{"orders": out})
}

func (h *Handler) GetOrder(c *gin.Context) {
	orderID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid order id"})
		return
	}
	userID := c.MustGet("user_id").(uuid.UUID)
	role := c.MustGet("role").(string)

	o, err := h.service.GetOrder(c.Request.Context(), orderID, userID, role)
	if err != nil {
		status := http.StatusInternalServerError
		if err == ErrNotFound {
			status = http.StatusNotFound
		} else if err == ErrForbidden {
			status = http.StatusForbidden
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	history, _ := h.service.History(c.Request.Context(), orderID, userID, role)
	c.JSON(http.StatusOK, gin.H{
		"order":   toOrderDTO(o),
		"history": history,
	})
}

func (h *Handler) PatchOrder(c *gin.Context) {
	orderID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid order id"})
		return
	}
	userID := c.MustGet("user_id").(uuid.UUID)

	var req updateOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	fields := map[string]interface{}{
		"painting_category":   req.PaintingCategory,
		"reference_image_url": req.ReferenceImageURL,
		"size":                req.Size,
		"persons_included":    req.PersonsIncluded,
		"delivery_address":    req.DeliveryAddress,
	}
	if req.CustomerNotes != nil {
		fields["customer_notes"] = *req.CustomerNotes
	}

	o, err := h.service.UpdateDraft(c.Request.Context(), orderID, userID, fields)
	if err != nil {
		status := http.StatusBadRequest
		if err == ErrForbidden {
			status = http.StatusForbidden
		} else if err == ErrNotFound {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, toOrderDTO(o))
}

func (h *Handler) Checkout(c *gin.Context) {
	orderID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid order id"})
		return
	}
	userID := c.MustGet("user_id").(uuid.UUID)
	role := c.MustGet("role").(string)

	o, err := h.service.GetOrder(c.Request.Context(), orderID, userID, role)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	if o.Status != StatusPlaced {
		c.JSON(http.StatusBadRequest, gin.H{"error": "order is not checkout-eligible"})
		return
	}

	checkoutURL, sessionID, err := h.createCheckoutSession(o)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error()})
		return
	}

	if sessionID != "" {
		_ = h.service.RecordPendingPayment(c.Request.Context(), o.OrderID, sessionID, o.TotalPrice, "INR")
	}

	c.JSON(http.StatusOK, gin.H{
		"checkout_url": checkoutURL,
		"session_id":   sessionID,
		"amount":       o.TotalPrice,
		"currency":     "INR",
	})
}

func (h *Handler) AdminListOrders(c *gin.Context) {
	status := c.Query("status")
	var statusPtr *string
	if status != "" {
		statusPtr = &status
	}
	list, err := h.service.ListAdminOrders(c.Request.Context(), statusPtr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	out := make([]orderDTO, 0, len(list))
	for i := range list {
		out = append(out, toOrderDTO(&list[i]))
	}
	c.JSON(http.StatusOK, gin.H{"orders": out})
}

func (h *Handler) AdminListUsers(c *gin.Context) {
	role := c.MustGet("role").(string)
	users, err := h.service.ListAllUsers(c.Request.Context(), role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"users": users})
}

func (h *Handler) AdminUpdateStatus(c *gin.Context) {
	orderID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid order id"})
		return
	}
	actorID := c.MustGet("user_id").(uuid.UUID)
	role := c.MustGet("role").(string)

	var req adminStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	var artistID *uuid.UUID
	if req.ArtistID != nil && *req.ArtistID != "" {
		id, err := uuid.Parse(*req.ArtistID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid artist_id"})
			return
		}
		artistID = &id
	}

	o, err := h.service.TransitionStatus(
		c.Request.Context(),
		orderID,
		actorID,
		role,
		OrderStatus(req.Status),
		artistID,
		req.FinalImageURL,
	)
	if err != nil {
		status := http.StatusBadRequest
		if err == ErrNotFound {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, toOrderDTO(o))
}

func (h *Handler) UpdateOrderStatus(c *gin.Context) {
	h.AdminUpdateStatus(c)
}

type assignOrderRequest struct {
	ArtistID string `json:"artist_id" binding:"required"`
}

func (h *Handler) AssignOrder(c *gin.Context) {
	orderID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid order id"})
		return
	}
	actorID := c.MustGet("user_id").(uuid.UUID)
	role := c.MustGet("role").(string)

	var req assignOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "artist_id is required"})
		return
	}

	targetArtistID, err := uuid.Parse(req.ArtistID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid artist_id format"})
		return
	}

	o, err := h.service.AssignOrder(c.Request.Context(), orderID, actorID, role, targetArtistID)
	if err != nil {
		status := http.StatusBadRequest
		if err == ErrNotFound {
			status = http.StatusNotFound
		} else if err == ErrForbidden {
			status = http.StatusForbidden
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "order assigned to verified artist successfully",
		"order":   toOrderDTO(o),
	})
}

func (h *Handler) ListVerifiedArtists(c *gin.Context) {
	list, err := h.service.ListVerifiedArtists(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"verified_artists": list})
}

func (h *Handler) AdminConfirmGalleryPublish(c *gin.Context) {
	orderID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid order id"})
		return
	}
	actorID := c.MustGet("user_id").(uuid.UUID)
	role := c.MustGet("role").(string)

	o, err := h.service.ConfirmGalleryPublish(c.Request.Context(), orderID, actorID, role)
	if err != nil {
		status := http.StatusBadRequest
		if err == ErrNotFound {
			status = http.StatusNotFound
		} else if err == ErrForbidden {
			status = http.StatusForbidden
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "painting confirmed and published to gallery successfully",
		"order":   toOrderDTO(o),
	})
}

