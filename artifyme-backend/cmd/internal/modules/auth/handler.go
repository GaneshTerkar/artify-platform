package auth

import (
	"net/http"
	"strings"

	dberrors "github.com/ganeshterkar/artifyme-backend/cmd/internal/errors"
	"github.com/ganeshterkar/artifyme-backend/cmd/internal/utils"
	"github.com/gin-gonic/gin"
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
	Email    string `json:"email" binding:"required,email" example:"ganesh@example.com"`
	Password string `json:"password" binding:"required" example:"password123"`
}
 type LoginResponse struct {
	Token string
	User UserDTO
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

	c.JSON(http.StatusCreated, RegisterResponse{User: ToUserDTO(user),})
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

	token, err := utils.GenerateJWT(user.UserID, string(user.Role),	h.jwtSecret, string(user.Status))
	if err != nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
			"error": dberrors.ErrGeneratingToken.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, LoginResponse{
		Token: token,
		User: ToUserDTO(user),
	})
}
