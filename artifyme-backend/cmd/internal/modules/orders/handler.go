package orders

import (
	"errors"
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
	FailureReason *string `json:"failure_reason"`
	Version       *int    `json:"version"`
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
	role := c.MustGet("role").(string)
	perspective := c.Query("perspective")

	if role == "ADMIN" {
		switch perspective {
		case "customer":
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
			return

		case "artist":
			allOrders, err := h.service.ListAdminOrders(c.Request.Context(), nil)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			out := make([]orderDTO, 0)
			for i := range allOrders {
				st := allOrders[i].Status
				if (allOrders[i].ArtistID != nil && *allOrders[i].ArtistID == userID) ||
					st == StatusConfirmed || st == StatusAssignedArtist || st == StatusInProgress || st == StatusCompleted {
					out = append(out, toOrderDTO(&allOrders[i]))
				}
			}
			c.JSON(http.StatusOK, gin.H{"orders": out})
			return

		case "delivery":
			allOrders, err := h.service.ListAdminOrders(c.Request.Context(), nil)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			out := make([]orderDTO, 0)
			for i := range allOrders {
				st := allOrders[i].Status
				if (allOrders[i].DeliveryAgentID != nil && *allOrders[i].DeliveryAgentID == userID) ||
					st == StatusAssignedDeliveryAgent || st == StatusInTransit || st == StatusOutForDelivery || st == StatusDelivered || st == StatusDeliveryFailed || st == StatusCompleted {
					out = append(out, toOrderDTO(&allOrders[i]))
				}
			}
			c.JSON(http.StatusOK, gin.H{"orders": out})
			return

		case "all":
			allOrders, err := h.service.ListAdminOrders(c.Request.Context(), nil)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			out := make([]orderDTO, 0, len(allOrders))
			for i := range allOrders {
				out = append(out, toOrderDTO(&allOrders[i]))
			}
			c.JSON(http.StatusOK, gin.H{"orders": out})
			return
		}
	}

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

	// Provider-specific checkout (manual mock or Razorpay).
	h.startCheckout(c, o)
}

func (h *Handler) ConfirmPayment(c *gin.Context) {
	orderID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid order id"})
		return
	}
	userID := c.MustGet("user_id").(uuid.UUID)
	role := c.MustGet("role").(string)

	if role != "ADMIN" {
		c.JSON(http.StatusForbidden, gin.H{"error": "only admin can confirm payment"})
		return
	}

	o, err := h.service.GetOrder(c.Request.Context(), orderID, userID, role)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	if o.Status != StatusPlaced {
		c.JSON(http.StatusBadRequest, gin.H{"error": "order is not in placed status"})
		return
	}

	updated, err := h.service.TransitionStatus(
		c.Request.Context(),
		orderID,
		userID,
		role,
		StatusConfirmed,
		nil,
		nil,
		nil,
	)
	if err != nil {
		status := http.StatusBadRequest
		if errors.Is(err, ErrForbidden) {
			status = http.StatusForbidden
		} else if errors.Is(err, ErrConflict) {
			status = http.StatusConflict
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "payment confirmed successfully",
		"order":   toOrderDTO(updated),
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

type updateUserStatusRequest struct {
	Status string `json:"status" binding:"required"`
}

func (h *Handler) AdminUpdateUserStatus(c *gin.Context) {
	targetID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}
	role := c.MustGet("role").(string)

	var req updateUserStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "status is required"})
		return
	}

	if err := h.service.UpdateUserStatus(c.Request.Context(), role, targetID, req.Status); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "user status updated successfully"})
}

func (h *Handler) AdminElevateArtist(c *gin.Context) {
	targetID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}
	actorID := c.MustGet("user_id").(uuid.UUID)
	role := c.MustGet("role").(string)

	if err := h.service.ElevateArtistToAdmin(c.Request.Context(), role, actorID, targetID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "artist promoted to Admin successfully"})
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

	var expVer []int
	if req.Version != nil && *req.Version > 0 {
		expVer = append(expVer, *req.Version)
	}

	o, err := h.service.TransitionStatus(
		c.Request.Context(),
		orderID,
		actorID,
		role,
		OrderStatus(req.Status),
		artistID,
		req.FinalImageURL,
		req.FailureReason,
		expVer...,
	)
	if err != nil {
		status := http.StatusBadRequest
		if errors.Is(err, ErrNotFound) {
			status = http.StatusNotFound
		} else if errors.Is(err, ErrConflict) {
			status = http.StatusConflict
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
	Version  *int   `json:"version"`
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

	var expVer []int
	if req.Version != nil && *req.Version > 0 {
		expVer = append(expVer, *req.Version)
	}

	o, err := h.service.AssignOrder(c.Request.Context(), orderID, actorID, role, targetArtistID, expVer...)
	if err != nil {
		status := http.StatusBadRequest
		if errors.Is(err, ErrNotFound) {
			status = http.StatusNotFound
		} else if errors.Is(err, ErrForbidden) {
			status = http.StatusForbidden
		} else if errors.Is(err, ErrConflict) {
			status = http.StatusConflict
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
		"message": "painting confirmed and published successfully",
		"order":   toOrderDTO(o),
	})
}

type assignDeliveryRequest struct {
	DeliveryAgentID string `json:"delivery_agent_id" binding:"required"`
	Version         *int   `json:"version"`
}

func (h *Handler) AssignDeliveryAgent(c *gin.Context) {
	orderID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid order id"})
		return
	}
	actorID := c.MustGet("user_id").(uuid.UUID)
	role := c.MustGet("role").(string)

	var req assignDeliveryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "delivery_agent_id is required"})
		return
	}

	targetAgentID, err := uuid.Parse(req.DeliveryAgentID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid delivery_agent_id format"})
		return
	}

	var expVer []int
	if req.Version != nil && *req.Version > 0 {
		expVer = append(expVer, *req.Version)
	}

	o, err := h.service.AssignDeliveryAgent(c.Request.Context(), orderID, actorID, role, targetAgentID, expVer...)
	if err != nil {
		status := http.StatusBadRequest
		if errors.Is(err, ErrNotFound) {
			status = http.StatusNotFound
		} else if errors.Is(err, ErrForbidden) {
			status = http.StatusForbidden
		} else if errors.Is(err, ErrConflict) {
			status = http.StatusConflict
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "delivery partner assigned successfully",
		"order":   toOrderDTO(o),
	})
}

func (h *Handler) ListActiveDeliveryAgents(c *gin.Context) {
	list, err := h.service.ListActiveDeliveryAgents(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"delivery_agents": list})
}

func (h *Handler) GetWorkerStats(c *gin.Context) {
	stats := h.service.WorkerStats()
	if stats == nil {
		c.JSON(http.StatusOK, gin.H{"status": "worker pool not initialized"})
		return
	}
	c.JSON(http.StatusOK, stats)
}

func (h *Handler) GetEventStats(c *gin.Context) {
	stats := h.service.OutboxStats(c.Request.Context())
	if stats == nil {
		c.JSON(http.StatusOK, gin.H{"status": "outbox relay not initialized"})
		return
	}
	c.JSON(http.StatusOK, stats)
}

func (h *Handler) AdminUpdateLogistics(c *gin.Context) {
	orderID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid order id"})
		return
	}
	actorID := c.MustGet("user_id").(uuid.UUID)
	role := c.MustGet("role").(string)

	var in UpdateLogisticsInput
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload: " + err.Error()})
		return
	}

	o, err := h.service.UpdateLogistics(c.Request.Context(), orderID, actorID, role, in)
	if err != nil {
		status := http.StatusBadRequest
		if errors.Is(err, ErrNotFound) {
			status = http.StatusNotFound
		} else if errors.Is(err, ErrForbidden) {
			status = http.StatusForbidden
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "logistics and tracking updated successfully",
		"order":   toOrderDTO(o),
	})
}

type TestFixtureConversion struct {
	Category    string `json:"category"`
	Label       string `json:"label"`
	Description string `json:"description"`
	ImageURL    string `json:"image_url"`
}

type TestFixtureSuite struct {
	SuiteID           string                  `json:"suite_id"`
	Title             string                  `json:"title"`
	Description       string                  `json:"description"`
	ReferenceImageURL string                  `json:"reference_image_url"`
	Conversions       []TestFixtureConversion `json:"conversions"`
}

func (h *Handler) AdminGetTestFixtures(c *gin.Context) {
	suites := []TestFixtureSuite{
		{
			SuiteID:           "suite_1_solo_portrait",
			Title:             "Classical Solo Character Portrait (Elderly Gentleman)",
			Description:       "Wise expressions, textured silver hair, fine skin contours, and yellow button-up shirt.",
			ReferenceImageURL: "/uploads/admin_test_fixtures/suite_1_solo_portrait/reference_photo.png",
			Conversions: []TestFixtureConversion{
				{
					Category:    "OIL",
					Label:       "Fine Art Oil Painting",
					Description: "Classical Rembrandt impasto brushwork on stretched canvas with warm chiaroscuro lighting.",
					ImageURL:    "/uploads/admin_test_fixtures/suite_1_solo_portrait/OIL.jpg",
				},
				{
					Category:    "PENCIL",
					Label:       "Graphite Pencil Sketch",
					Description: "Hand-drawn delicate cross-hatching, fine sharp pencil shading, and kneaded eraser highlights.",
					ImageURL:    "/uploads/admin_test_fixtures/suite_1_solo_portrait/PENCIL.jpg",
				},
				{
					Category:    "CHARCOAL",
					Label:       "Smoky Vine Charcoal Portrait",
					Description: "Dramatic chiaroscuro with velvety blacks, soft paper blending, and soulful contrast.",
					ImageURL:    "/uploads/admin_test_fixtures/suite_1_solo_portrait/CHARCOAL.jpg",
				},
				{
					Category:    "WATERCOLOR",
					Label:       "Luminous Fluid Watercolor",
					Description: "Transparent wet-on-wet pigments, soft violet blooms, and expressive brushwork.",
					ImageURL:    "/uploads/admin_test_fixtures/suite_1_solo_portrait/WATERCOLOR.jpg",
				},
				{
					Category:    "ACRYLIC",
					Label:       "Contemporary Textured Acrylic",
					Description: "Vibrant layered pigments, energetic palette knife marks, and modern fine-art realism.",
					ImageURL:    "/uploads/admin_test_fixtures/suite_1_solo_portrait/ACRYLIC.jpg",
				},
			},
		},
	}
	c.JSON(http.StatusOK, gin.H{"suites": suites})
}
