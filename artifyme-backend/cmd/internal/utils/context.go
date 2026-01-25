package utils

import (
	"context"
	"time"

	"github.com/gin-gonic/gin"
)

func DBContext(c *gin.Context) (context.Context, context.CancelFunc) {
	return context.WithTimeout(c.Request.Context(), 5*time.Second)
}

