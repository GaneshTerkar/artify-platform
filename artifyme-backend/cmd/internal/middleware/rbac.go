package middleware

import (
	"net/http"

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
				"error": "role not found in token",
			})
			return
		}

		userRole, ok := roleValue.(string)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "invalid role format",
			})
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
			"error": "insufficient permissions",
		})
	}
}

func VerifiedArtistMiddleware(repo *artists.ArtistRepository) gin.HandlerFunc {
	return func(c *gin.Context) {
		artistID := c.MustGet("user_id").(uuid.UUID)

		profile, err := repo.GetArtistProfile(c.Request.Context(), artistID)
		if err != nil || !profile.Verified {
			c.AbortWithStatusJSON(403, gin.H{
				"error": "artist not verified",
			})
			return
		}
		c.Next()
	}
}

func StatusMiddleware(allowed ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		status := c.GetString("status")

		for _, s := range allowed {
			if status == s {
				c.Next()
				return
			}
		}

		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
			"error": "action not allowed in current account status",
		})
	}
}

