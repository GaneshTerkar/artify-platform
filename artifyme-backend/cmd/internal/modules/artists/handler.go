package artists

import (
	"fmt"
	"net/http"

	dberrors "github.com/ganeshterkar/artifyme-backend/cmd/internal/errors"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type ArtistHandler struct {
	service *ArtistService
}

func NewHandler(service *ArtistService) *ArtistHandler {
	if service == nil {
		panic("auth.NewHandler: service is nil")
	}
	return &ArtistHandler{service: service}
}

// AddPainting godoc
// @Summary Add a new painting
// @Description Artist adds a painting
// @Tags Artist
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param body body AddPaintingRequest true "Painting details"
// @Success 201 {object} ArtistPainting
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/artist/paintings/add [post]
func (h *ArtistHandler) AddPainting(c *gin.Context) {
	artistID := c.MustGet("user_id").(uuid.UUID)

	var req AddPaintingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error: "invalid payload",
		})
		return
	}

	painting, err := h.service.AddPainting(
		c.Request.Context(),
		artistID,
		req,
	)

	if err != nil {
		if err == dberrors.ErrUpdatingArtistAccountStatus || err == dberrors.ErrAddingPainting{
			c.AbortWithStatusJSON(http.StatusBadRequest, ErrorResponse{
				Error: "error adding painting or updating artis's account status",
			})
		} else{
			c.AbortWithStatusJSON(http.StatusInternalServerError, ErrorResponse{
				Error: "error adding painting",
			})
		}
		return
	}

	c.JSON(http.StatusCreated, painting)
}

// MyPaintings godoc
// @Summary Get my paintings
// @Description Get all paintings added by the logged-in artist
// @Tags Artist
// @Security BearerAuth
// @Produce json
// @Success 200 {array} ArtistPainting
// @Failure 404 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Router /api/artist/paintings/ [get]
func (h *ArtistHandler) MyPaintings(c *gin.Context) {
	artistID := c.MustGet("user_id").(uuid.UUID)

	paintings, err := h.service.ListMyPaintings(
		c.Request.Context(),
		artistID,
	)
	if err != nil {
		if err == dberrors.ErrPaintingsNotFound{
			c.AbortWithStatusJSON(http.StatusNotFound, ErrorResponse{
				Error: dberrors.ErrPaintingsNotFound.Error(),
			})
		} else{
			c.AbortWithStatusJSON(http.StatusInternalServerError, ErrorResponse{
				Error: fmt.Errorf("error getting paintings: %w", err).Error(),
			})
		}
		return
	}

	c.JSON(http.StatusOK, paintings)
}

func (h *ArtistHandler) CreateOrUpdateProfile(c *gin.Context) {	
	var req ArtistProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, ErrorResponse{
				Error: dberrors.ErrInvalidCreateOrUpdateProfileRequest.Error(),
		})
		return
	}
	artistID := c.MustGet("user_id").(uuid.UUID)

	profile, err := h.service.CreateOrUpdateProfile(
		c.Request.Context(),
		artistID,
		&req,
	)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, ErrorResponse{
			Error: fmt.Errorf("error creating/updating artist profile: %w", err).Error(),
		})
		return
	}

	c.JSON(http.StatusOK, profile)
}

func (h *ArtistHandler) GetMyProfile(c *gin.Context) {
	artistID := c.MustGet("user_id").(uuid.UUID)

	profile, err := h.service.GetProfile(
		c.Request.Context(),
		artistID,
	)
	if err != nil {
		if err == dberrors.ErrArtistProfileNotFound{
			c.AbortWithStatusJSON(http.StatusNotFound, ErrorResponse{
				Error: dberrors.ErrArtistProfileNotFound.Error(),
			})
		} else {
			c.AbortWithStatusJSON(http.StatusInternalServerError, ErrorResponse{
				Error: err.Error(),
			})
		}
		return
	}

	c.JSON(http.StatusOK, profile)
}

func (h *ArtistHandler) VerifyArtist(c *gin.Context) {
	artistID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error: "invalid artist id"})
		return
	}

	if err := h.service.VerifyArtist(c.Request.Context(), artistID); err != nil {
		switch err {
		case dberrors.ErrArtistAlreadyVerified:
			c.JSON(http.StatusConflict, ErrorResponse{
				Error: err.Error()})
		case dberrors.ErrArtistProfileNotFound:
			c.JSON(http.StatusNotFound, ErrorResponse{
				Error: err.Error()})
		case dberrors.ErrNoPaintings:
			c.JSON(http.StatusBadRequest, ErrorResponse{
				Error: err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, ErrorResponse{
				Error: "failed to verify artist",
		})
		return
	}
	c.JSON(http.StatusOK, MessageResponse{Message: "artist verified and account activated"})
	}
}

func (h *ArtistHandler) GetPublicArtistProfile(c *gin.Context) {
	artistID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": dberrors.ErrInvalidArtistId.Error()})
		return
	}

	profile, err := h.service.GetPublicArtistProfile(
		c.Request.Context(),
		artistID,
	)

	if err != nil {
		if err == dberrors.ErrArtistProfileNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": dberrors.ErrArtistProfileNotFound.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch artist"})
		return
	}

	c.JSON(http.StatusOK, profile)
}

func (h *ArtistHandler) AdminReviewQueue(c *gin.Context) {
	artists, err := h.service.GetArtistsForReview(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to fetch review queue",
		})
		return
	}
	
	c.JSON(http.StatusOK, artists)
}

func (h *ArtistHandler) RejectArtist(c *gin.Context) {
	ctx := c.Request.Context()

	artistID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": dberrors.ErrInvalidArtistId.Error()})
		return
	}

	var req RejectArtistRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "reason required"})
		return
	}

	err = h.service.RejectArtist(ctx, artistID, req.Reason)
	if err != nil {
		switch err {
		case dberrors.ErrNotInReviewState:
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		case dberrors.ErrArtistAlreadyRejected:
			c.AbortWithStatusJSON(http.StatusConflict, gin.H{"error": err.Error()})
		default:
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "artist rejected successfully",
	})
}

func (h *ArtistHandler) MyReviewStatus(c *gin.Context) {
	ctx := c.Request.Context()

	artistID := c.MustGet("user_id").(uuid.UUID)

	resp, err := h.service.GetMyReviewStatus(ctx, artistID)
	if err != nil {
		if err == dberrors.ErrInvalidArtistId{
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		}
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch review status"})
		return
	}

	c.JSON(http.StatusOK, resp)
}
