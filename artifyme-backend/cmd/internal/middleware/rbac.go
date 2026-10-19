package middleware

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/ganeshterkar/artifyme-backend/cmd/internal/modules/artists"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// RoleMiddleware ensures that the authenticated user has the required role
func RoleMiddleware(requiredRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {

		// role must be set by AuthMiddleware
		roleValue, exists := c.Get("role")
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "you are not allowed to perform this action: role not found in authentication token",
			})
			return
		}

		userRole, ok := roleValue.(string)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "you are not allowed to perform this action: invalid role format in token",
			})
			return
		}

		// allow if user is ADMIN (universal testing and operational access across all roles)
		if userRole == "ADMIN" {
			c.Next()
			return
		}

		// allow if userRole matches ANY required role
		for _, requiredRole := range requiredRoles {
			if userRole == requiredRole {
				c.Next()
				return
			}
		}

		// no role matched
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
			"error": fmt.Sprintf("you are not allowed to perform this action with role '%s'. Required role: %s", userRole, strings.Join(requiredRoles, " or ")),
		})
	}
}

func VerifiedArtistMiddleware(repo *artists.ArtistRepository) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.GetString("role") == "ADMIN" {
			c.Next()
			return
		}
		artistID := c.MustGet("user_id").(uuid.UUID)

		profile, err := repo.GetArtistProfile(c.Request.Context(), artistID)
		if err != nil || !profile.Verified {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": "you are not allowed to perform this action: artist account is not verified by admin",
			})
			return
		}
		c.Next()
	}
}

func StatusMiddleware(allowed ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.GetString("role") == "ADMIN" {
			c.Next()
			return
		}
		status := c.GetString("status")

		for _, s := range allowed {
			if status == s {
				c.Next()
				return
			}
		}

		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
			"error": fmt.Sprintf("you are not allowed to perform this action: account status '%s' is not permitted. Allowed status: %s", status, strings.Join(allowed, " or ")),
		})
	}
}


