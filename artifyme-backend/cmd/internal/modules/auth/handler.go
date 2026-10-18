package auth

import (
	"net/http"
	"strings"

	dberrors "github.com/ganeshterkar/artifyme-backend/cmd/internal/errors"
	"github.com/ganeshterkar/artifyme-backend/cmd/internal/utils"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type AuthHandler struct {
	service   *AuthService
	jwtSecret string
}

func NewHandler(service *AuthService, jwtSecret string) *AuthHandler {
	if service == nil {
		panic("auth.NewHandler: service is nil")
	}
	return &AuthHandler{
		service:   service,
		jwtSecret: jwtSecret,
	}
}

type RegisterRequest struct {
	FullName    string `json:"full_name" binding:"required" example:"Ganesh Terkar"`
	Email       string `json:"email" binding:"required,email" example:"ganesh@example.com"`
	Password    string `json:"password" binding:"required,min=8" example:"password123"`
	Address     string `json:"address" binding:"required" example:"Pune, India"`
	PhoneNumber string `json:"phone_number" binding:"required" example:"+91XXXXXXXXXX"`
	Role        UserRole `json:"role" example:"CUSTOMER"`
}

type RegisterResponse struct{
	User UserDTO `json:"user"` 
}

type LoginRequest struct {
	Email      string `json:"email" binding:"required,email" example:"ganesh@example.com"`
	Password   string `json:"password" binding:"required" example:"password123"`
	DeviceID   string `json:"device_id,omitempty"`
	DeviceName string `json:"device_name,omitempty"`
	DeviceType string `json:"device_type,omitempty"`
}

type LoginResponse struct {
	Token        string  `json:"token"`
	RefreshToken string  `json:"refresh_token"`
	User         UserDTO `json:"user"`
}

func (h *AuthHandler) RegisterHandler(c *gin.Context) {
	ctx, cancel := utils.DBContext(c)
	defer cancel()
	
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": dberrors.ErrInvalidRequestPayload})
		return
	}

	userRole := string(req.Role)
	if strings.TrimSpace(userRole) == ""{
		req.Role = UserRole(Customer)
	}

	user, err := h.service.RegisterUserService(ctx, &req)
	if err != nil {
		if err == dberrors.ErrEmailAlreadyExists{
			c.AbortWithStatusJSON(http.StatusConflict, gin.H{"error": dberrors.ErrEmailAlreadyExists.Error()})
		} else {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}

	c.JSON(http.StatusCreated, RegisterResponse{User: ToUserDTO(user)})
}

func (h *AuthHandler) LoginHandler(c *gin.Context) {
	ctx, cancel := utils.DBContext(c)
	defer cancel()
	var req LoginRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": dberrors.ErrInvalidRequestPayload.Error()})
		return
	}

	user, err := h.service.LoginUserService(ctx, &req)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	// Multi-device session creation
	deviceID := req.DeviceID
	if deviceID == "" {
		deviceID = c.GetHeader("X-Device-ID")
		if deviceID == "" {
			deviceID = "web-" + uuid.New().String()[:8]
		}
	}
	deviceName := req.DeviceName
	if deviceName == "" {
		deviceName = c.Request.UserAgent()
		if len(deviceName) > 40 {
			deviceName = deviceName[:40]
		}
	}
	deviceType := req.DeviceType
	if deviceType == "" {
		deviceType = "DESKTOP"
	}
	ip := c.ClientIP()
	userAgent := c.Request.UserAgent()

	sessionID, refreshToken, err := h.service.CreateSession(ctx, user.UserID, deviceID, deviceName, deviceType, ip, userAgent)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "failed to initialize device session"})
		return
	}

	token, err := utils.GenerateJWT(user.UserID, string(user.Role), h.jwtSecret, string(user.Status), sessionID)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
			"error": dberrors.ErrGeneratingToken.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, LoginResponse{
		Token:        token,
		RefreshToken: refreshToken,
		User:         ToUserDTO(user),
	})
}

// RefreshTokenHandler handles Refresh Token Rotation (RTR)
func (h *AuthHandler) RefreshTokenHandler(c *gin.Context) {
	ctx, cancel := utils.DBContext(c)
	defer cancel()

	var req RefreshTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "refresh_token is required"})
		return
	}

	newToken, newRefreshToken, _, err := h.service.RefreshToken(ctx, req.RefreshToken, h.jwtSecret)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, RefreshTokenResponse{
		Token:        newToken,
		RefreshToken: newRefreshToken,
	})
}

// ListSessionsHandler returns all active sessions for the current authenticated user
func (h *AuthHandler) ListSessionsHandler(c *gin.Context) {
	ctx, cancel := utils.DBContext(c)
	defer cancel()

	userID := c.MustGet("user_id").(uuid.UUID)
	currentSessionID := c.GetString("session_id")

	sessions, err := h.service.ListSessions(ctx, userID, currentSessionID)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "failed to list active sessions"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"sessions": sessions})
}

// RevokeSessionHandler revokes a specific session (remote logout)
func (h *AuthHandler) RevokeSessionHandler(c *gin.Context) {
	ctx, cancel := utils.DBContext(c)
	defer cancel()

	userID := c.MustGet("user_id").(uuid.UUID)
	sessionID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "invalid session id"})
		return
	}

	if err := h.service.RevokeSession(ctx, sessionID, userID); err != nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "failed to revoke session"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "session revoked successfully"})
}

// RevokeAllOtherSessionsHandler revokes all sessions except the current one
func (h *AuthHandler) RevokeAllOtherSessionsHandler(c *gin.Context) {
	ctx, cancel := utils.DBContext(c)
	defer cancel()

	userID := c.MustGet("user_id").(uuid.UUID)
	currentSessionIDStr := c.GetString("session_id")
	currentSessionID, _ := uuid.Parse(currentSessionIDStr)

	if err := h.service.RevokeAllOtherSessions(ctx, currentSessionID, userID); err != nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "failed to revoke other sessions"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "all other sessions revoked successfully"})
}
