package orders

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// checkoutResponse is deliberately provider-agnostic so the frontend can
// support manual mock checkout and Razorpay checkout with one code path.
type checkoutResponse struct {
	Provider        string  `json:"provider"`
	OrderID         string  `json:"order_id"`
	Amount          float64 `json:"amount"`
	AmountPaise     int64   `json:"amount_paise,omitempty"`
	Currency        string  `json:"currency"`
	PaymentID       string  `json:"payment_id,omitempty"`
	CheckoutURL     string  `json:"checkout_url,omitempty"`
	SessionID       string  `json:"session_id,omitempty"`
	KeyID           string  `json:"key_id,omitempty"`
	RazorpayOrderID string  `json:"razorpay_order_id,omitempty"`
}

func (h *Handler) razorpayClient() *RazorpayClient {
	if h.cfg == nil || h.cfg.Payment.Provider != PaymentProviderRazorpay {
		return nil
	}
	if h.cfg.Payment.RazorpayKeyID == "" || h.cfg.Payment.RazorpayKeySecret == "" {
		return nil
	}
	return NewRazorpayClient(
		h.cfg.Payment.RazorpayKeyID,
		h.cfg.Payment.RazorpayKeySecret,
		h.cfg.Payment.RazorpayWebhookSecret,
		h.cfg.Payment.RazorpayAPIBase,
	)
}

// startCheckout continues the (already validated) Checkout handler. In manual
// mode it keeps the original mock behaviour; in razorpay mode it creates a real
// Razorpay order and returns the fields the Checkout.js modal needs.
func (h *Handler) startCheckout(c *gin.Context, o *Order) {
	ctx := c.Request.Context()
	provider := PaymentProviderManual
	if h.cfg != nil && h.cfg.Payment.Provider == PaymentProviderRazorpay {
		provider = PaymentProviderRazorpay
	}

	if provider == PaymentProviderManual {
		checkoutURL, sessionID, err := h.createCheckoutSession(o)
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error()})
			return
		}

		var paymentID string
		if sessionID != "" {
			p, err := h.service.RecordProviderPayment(ctx, o.OrderID, PaymentProviderManual, sessionID, o.TotalPrice, "INR", nil)
			if err != nil {
				slog.Error("failed to record manual payment", "order_id", o.OrderID, "error", err)
			} else {
				paymentID = p.PaymentID.String()
			}
		}

		c.JSON(http.StatusOK, checkoutResponse{
			Provider:    PaymentProviderManual,
			OrderID:     o.OrderID.String(),
			Amount:      o.TotalPrice,
			Currency:    "INR",
			PaymentID:   paymentID,
			CheckoutURL: checkoutURL,
			SessionID:   sessionID,
		})
		return
	}

	client := h.razorpayClient()
	if client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "razorpay payments are not configured"})
		return
	}

	if o.TotalPrice < h.cfg.Payment.MinAmount || o.TotalPrice > h.cfg.Payment.MaxAmount {
		c.JSON(http.StatusBadRequest, gin.H{"error": "order amount is outside the allowed payment range"})
		return
	}
	amountPaise := AmountInPaise(o.TotalPrice)
	if amountPaise <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "order amount must be greater than zero"})
		return
	}

	// Reuse an existing pending gateway order so double-clicks and retries do
	// not create several Razorpay orders for the same purchase.
	if p, err := h.service.PendingProviderPayment(ctx, o.OrderID, PaymentProviderRazorpay); err == nil && p != nil &&
		p.ProviderOrderID != nil && *p.ProviderOrderID != "" {
		c.JSON(http.StatusOK, checkoutResponse{
			Provider:        PaymentProviderRazorpay,
			OrderID:         o.OrderID.String(),
			Amount:          o.TotalPrice,
			AmountPaise:     amountPaise,
			Currency:        p.Currency,
			PaymentID:       p.PaymentID.String(),
			KeyID:           h.cfg.Payment.RazorpayKeyID,
			RazorpayOrderID: *p.ProviderOrderID,
		})
		return
	}

	rzpOrder, err := client.CreateOrder(ctx, amountPaise, o.OrderID.String(), map[string]string{
		"order_id":    o.OrderID.String(),
		"customer_id": o.UserID.String(),
	})
	if err != nil {
		slog.Error("razorpay create order failed", "order_id", o.OrderID, "error", err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "could not start the payment. Please try again."})
		return
	}

	p, err := h.service.RecordProviderPayment(ctx, o.OrderID, PaymentProviderRazorpay, rzpOrder.ID, o.TotalPrice, rzpOrder.Currency, nil)
	if err != nil {
		slog.Error("failed to record razorpay payment", "order_id", o.OrderID, "provider_order_id", rzpOrder.ID, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not record the payment"})
		return
	}

	c.JSON(http.StatusOK, checkoutResponse{
		Provider:        PaymentProviderRazorpay,
		OrderID:         o.OrderID.String(),
		Amount:          o.TotalPrice,
		AmountPaise:     amountPaise,
		Currency:        rzpOrder.Currency,
		PaymentID:       p.PaymentID.String(),
		KeyID:           h.cfg.Payment.RazorpayKeyID,
		RazorpayOrderID: rzpOrder.ID,
	})
}

type verifyPaymentRequest struct {
	RazorpayOrderID   string `json:"razorpay_order_id" binding:"required"`
	RazorpayPaymentID string `json:"razorpay_payment_id" binding:"required"`
	RazorpaySignature string `json:"razorpay_signature" binding:"required"`
}

// VerifyPayment is called by the browser right after Razorpay Checkout
// succeeds. It verifies the HMAC signature and confirms the order immediately
// (the webhook is the authoritative fallback if the browser never returns).
func (h *Handler) VerifyPayment(c *gin.Context) {
	var req verifyPaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payment payload"})
		return
	}

	client := h.razorpayClient()
	if client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "razorpay payments are not configured"})
		return
	}

	userID := c.MustGet("user_id").(uuid.UUID)
	role := c.MustGet("role").(string)

	p, err := h.service.PaymentByProviderOrder(c.Request.Context(), PaymentProviderRazorpay, req.RazorpayOrderID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "payment not found"})
		return
	}
	// Reuse order authorization: customers may only verify their own payments.
	if _, err := h.service.GetOrder(c.Request.Context(), p.OrderID, userID, role); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "payment not found"})
		return
	}

	if !client.VerifyCheckoutSignature(req.RazorpayOrderID, req.RazorpayPaymentID, req.RazorpaySignature) {
		slog.Warn("razorpay checkout signature rejected", "order_id", p.OrderID, "razorpay_order_id", req.RazorpayOrderID)
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payment signature"})
		return
	}

	updated, err := h.service.ConfirmProviderPayment(c.Request.Context(), PaymentProviderRazorpay, req.RazorpayOrderID, req.RazorpayPaymentID, nil)
	if err != nil {
		slog.Error("failed to confirm payment", "order_id", p.OrderID, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not confirm the payment"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "paid",
		"order":  toOrderDTO(updated),
	})
}

type razorpayWebhookEvent struct {
	Event   string `json:"event"`
	Payload struct {
		Payment struct {
			Entity struct {
				ID               string `json:"id"`
				OrderID          string `json:"order_id"`
				Amount           int64  `json:"amount"`
				Currency         string `json:"currency"`
				Status           string `json:"status"`
				Method           string `json:"method"`
				ErrorDescription string `json:"error_description"`
			} `json:"entity"`
		} `json:"payment"`
		Refund struct {
			Entity struct {
				ID        string `json:"id"`
				PaymentID string `json:"payment_id"`
				Amount    int64  `json:"amount"`
				Status    string `json:"status"`
			} `json:"entity"`
		} `json:"refund"`
	} `json:"payload"`
}

// RazorpayWebhook handles signed webhook deliveries. Signatures are verified
// against the raw body, duplicates are ignored, and processing is idempotent.
func (h *Handler) RazorpayWebhook(c *gin.Context) {
	client := h.razorpayClient()
	if client == nil || client.WebhookSecret == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "razorpay webhooks are not configured"})
		return
	}

	raw, err := io.ReadAll(io.LimitReader(c.Request.Body, 1<<20))
	if err != nil || len(raw) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	signature := c.GetHeader("X-Razorpay-Signature")
	if !client.VerifyWebhookSignature(raw, signature) {
		slog.Warn("razorpay webhook signature rejected", "remote_ip", c.ClientIP())
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid signature"})
		return
	}

	var evt razorpayWebhookEvent
	if err := json.Unmarshal(raw, &evt); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid json"})
		return
	}

	eventID := c.GetHeader("X-Razorpay-Event-Id")
	if eventID == "" {
		sum := sha256.Sum256(raw)
		eventID = "sha256:" + hex.EncodeToString(sum[:])
	}

	ctx := c.Request.Context()
	exists, err := h.service.PaymentEventExists(ctx, eventID)
	if err != nil {
		slog.Error("failed to check payment event", "event_id", eventID, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not process webhook"})
		return
	}
	if exists {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "duplicate": true})
		return
	}

	payment := evt.Payload.Payment.Entity
	var procErr error
	switch evt.Event {
	case "payment.captured", "order.paid":
		if payment.OrderID == "" || payment.ID == "" {
			procErr = errors.New("webhook is missing payment.order_id or payment.id")
			break
		}
		_, procErr = h.service.ConfirmProviderPayment(ctx, PaymentProviderRazorpay, payment.OrderID, payment.ID, raw)
	case "payment.authorized":
		// Auto-capture may be disabled on the account. Capture explicitly; the
		// payment.captured webhook will then flip the order to CONFIRMED.
		if payment.ID != "" && payment.Amount > 0 {
			procErr = client.CapturePayment(ctx, payment.ID, payment.Amount)
		}
	case "payment.failed":
		if payment.OrderID != "" {
			procErr = h.service.FailProviderPayment(ctx, PaymentProviderRazorpay, payment.OrderID, payment.ErrorDescription, raw)
		}
	case "refund.created", "refund.processed":
		if evt.Payload.Refund.Entity.PaymentID != "" {
			_, procErr = h.service.MarkPaymentRefunded(ctx, PaymentProviderRazorpay, evt.Payload.Refund.Entity.PaymentID, raw)
			if errors.Is(procErr, ErrPaymentNotFound) {
				// A refund for a payment we never recorded; nothing to update.
				slog.Warn("refund webhook for unknown payment", "payment_id", evt.Payload.Refund.Entity.PaymentID)
				procErr = nil
			}
		}
	default:
		slog.Info("unhandled razorpay webhook event", "event", evt.Event, "event_id", eventID)
	}

	if procErr != nil {
		slog.Error("razorpay webhook processing failed", "event", evt.Event, "event_id", eventID, "error", procErr)
		// Do not record the event: Razorpay retries non-2xx deliveries.
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not process webhook"})
		return
	}

	if err := h.service.RecordPaymentEvent(ctx, eventID, PaymentProviderRazorpay, evt.Event, raw); err != nil {
		slog.Warn("failed to record payment event", "event_id", eventID, "error", err)
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// AdminRefundPayment refunds a captured Razorpay payment (full refund). Manual
// payments must be refunded outside the system.
func (h *Handler) AdminRefundPayment(c *gin.Context) {
	orderID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid order id"})
		return
	}
	role := c.MustGet("role").(string)
	if role != "ADMIN" {
		c.JSON(http.StatusForbidden, gin.H{"error": "only admin can issue refunds"})
		return
	}

	p, err := h.service.PaymentForOrder(c.Request.Context(), orderID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "payment not found"})
		return
	}
	if p.Provider != PaymentProviderRazorpay {
		c.JSON(http.StatusBadRequest, gin.H{"error": "manual payments must be refunded outside the system"})
		return
	}
	if p.Status != PaymentStatusPaid {
		c.JSON(http.StatusBadRequest, gin.H{"error": "only a paid payment can be refunded"})
		return
	}
	if p.ProviderPaymentID == nil || *p.ProviderPaymentID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "payment has no provider payment id"})
		return
	}

	client := h.razorpayClient()
	if client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "razorpay payments are not configured"})
		return
	}

	refund, err := client.Refund(c.Request.Context(), *p.ProviderPaymentID, nil, map[string]string{
		"order_id": orderID.String(),
		"reason":   "admin refund",
	})
	if err != nil {
		slog.Error("razorpay refund failed", "order_id", orderID, "payment_id", *p.ProviderPaymentID, "error", err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "refund failed at the payment provider"})
		return
	}

	if _, err := h.service.MarkPaymentRefunded(c.Request.Context(), PaymentProviderRazorpay, *p.ProviderPaymentID, nil); err != nil {
		slog.Error("failed to mark payment refunded", "order_id", orderID, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "refund succeeded but the payment record could not be updated"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":    "refunded",
		"refund_id": refund.ID,
		"order_id":  orderID.String(),
	})
}
