package orders

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
)

func (h *Handler) createCheckoutSession(o *Order) (checkoutURL, sessionID string, err error) {
	if h.cfg.Stripe.SecretKey == "" {
		sessionID = fmt.Sprintf("dev_session_%s", o.OrderID.String())
		return h.cfg.Stripe.SuccessURL + "?order_id=" + o.OrderID.String(), sessionID, nil
	}
	return "", "", fmt.Errorf("stripe is configured but checkout integration is not wired yet; unset STRIPE_SECRET_KEY for dev mock checkout")
}

func (h *Handler) StripeWebhook(c *gin.Context) {
	// MVP: accept dev webhook body { "session_id": "..." } when Stripe secret is unset.
	c.JSON(http.StatusNotImplemented, gin.H{"error": "stripe webhook not implemented; confirm payment via admin status CONFIRMED in dev"})
}
