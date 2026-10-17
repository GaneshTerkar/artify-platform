package files

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// Upload godoc
// @Summary Upload an image file
// @Description Uploads an image (JPG, PNG, WEBP, GIF, HEIC) to storage and returns its URL
// @Tags Files
// @Accept multipart/form-data
// @Produce json
// @Param file formData file true "Image file to upload"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/upload [post]
func (h *Handler) Upload(c *gin.Context) {
	// 25 MB max memory
	if err := c.Request.ParseMultipartForm(25 << 20); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file too large or invalid multipart form"})
		return
	}

	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file field is required"})
		return
	}

	scheme := "http"
	if c.Request.TLS != nil || c.Request.Header.Get("X-Forwarded-Proto") == "https" {
		scheme = "https"
	}
	baseURL := fmt.Sprintf("%s://%s", scheme, c.Request.Host)

	fileURL, filename, err := h.service.UploadFile(c.Request.Context(), file, baseURL)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"url":      fileURL,
		"filename": filename,
		"size":     file.Size,
	})
}
