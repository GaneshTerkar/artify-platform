package orders

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"strings"
	"time"
)

// Supported payment providers.
const (
	PaymentProviderManual   = "manual"
	PaymentProviderRazorpay = "razorpay"
)

// Payment statuses stored in payments.status.
const (
	PaymentStatusPending  = "pending"
	PaymentStatusPaid     = "paid"
	PaymentStatusFailed   = "failed"
	PaymentStatusRefunded = "refunded"
)

// AmountInPaise converts an INR amount to the smallest unit Razorpay expects.
func AmountInPaise(amount float64) int64 {
	return int64(math.Round(amount * 100))
}

// RazorpayClient is a small REST client (no SDK) for the Razorpay API.
// The same client is used with test and live keys; live charging is gated by
// configuration (PAYMENT_PROVIDER + PAYMENTS_LIVE), never by this type.
type RazorpayClient struct {
	KeyID         string
	KeySecret     string
	WebhookSecret string
	BaseURL       string
	HTTPClient    *http.Client
}

func NewRazorpayClient(keyID, keySecret, webhookSecret, baseURL string) *RazorpayClient {
	if strings.TrimSpace(baseURL) == "" {
		baseURL = "https://api.razorpay.com"
	}
	return &RazorpayClient{
		KeyID:         keyID,
		KeySecret:     keySecret,
		WebhookSecret: webhookSecret,
		BaseURL:       strings.TrimRight(baseURL, "/"),
		HTTPClient:    &http.Client{Timeout: 20 * time.Second},
	}
}

type RazorpayOrder struct {
	ID       string `json:"id"`
	Entity   string `json:"entity"`
	Amount   int64  `json:"amount"`
	Currency string `json:"currency"`
	Receipt  string `json:"receipt"`
	Status   string `json:"status"`
}

type RazorpayRefund struct {
	ID        string `json:"id"`
	Entity    string `json:"entity"`
	PaymentID string `json:"payment_id"`
	Amount    int64  `json:"amount"`
	Currency  string `json:"currency"`
	Status    string `json:"status"`
}

func (c *RazorpayClient) doJSON(ctx context.Context, method, path string, body any, out any) error {
	var reader io.Reader
	if body != nil {
		payload, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reader = bytes.NewReader(payload)
	}

	req, err := http.NewRequestWithContext(ctx, method, c.BaseURL+path, reader)
	if err != nil {
		return err
	}
	req.SetBasicAuth(c.KeyID, c.KeySecret)
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("razorpay request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		msg, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return fmt.Errorf("razorpay %s %s returned %d: %s", method, path, resp.StatusCode, strings.TrimSpace(string(msg)))
	}
	if out == nil {
		return nil
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

// CreateOrder creates a Razorpay order. The amount must be in paise.
func (c *RazorpayClient) CreateOrder(ctx context.Context, amountPaise int64, receipt string, notes map[string]string) (*RazorpayOrder, error) {
	if amountPaise <= 0 {
		return nil, fmt.Errorf("order amount must be positive")
	}
	body := map[string]any{
		"amount":   amountPaise,
		"currency": "INR",
		"receipt":  receipt,
		"notes":    notes,
	}
	var out RazorpayOrder
	if err := c.doJSON(ctx, http.MethodPost, "/v1/orders", body, &out); err != nil {
		return nil, err
	}
	if out.ID == "" {
		return nil, fmt.Errorf("razorpay returned an empty order id")
	}
	return &out, nil
}

// CapturePayment captures an authorised payment (used when auto-capture is off).
func (c *RazorpayClient) CapturePayment(ctx context.Context, paymentID string, amountPaise int64) error {
	if paymentID == "" || amountPaise <= 0 {
		return fmt.Errorf("payment id and amount are required to capture")
	}
	body := map[string]any{"amount": amountPaise, "currency": "INR"}
	return c.doJSON(ctx, http.MethodPost, "/v1/payments/"+paymentID+"/capture", body, nil)
}

// Refund issues a refund. A nil amount means a full refund.
func (c *RazorpayClient) Refund(ctx context.Context, paymentID string, amountPaise *int64, notes map[string]string) (*RazorpayRefund, error) {
	if paymentID == "" {
		return nil, fmt.Errorf("payment id is required to refund")
	}
	body := map[string]any{"notes": notes, "speed": "normal"}
	if amountPaise != nil {
		body["amount"] = *amountPaise
	}
	var out RazorpayRefund
	if err := c.doJSON(ctx, http.MethodPost, "/v1/payments/"+paymentID+"/refund", body, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// VerifyCheckoutSignature validates the handler() callback sent by Razorpay
// Checkout: HMAC-SHA256("<razorpay_order_id>|<razorpay_payment_id>", key_secret).
func (c *RazorpayClient) VerifyCheckoutSignature(orderID, paymentID, signature string) bool {
	if orderID == "" || paymentID == "" || signature == "" || c.KeySecret == "" {
		return false
	}
	return verifyHMACHex([]byte(orderID+"|"+paymentID), []byte(c.KeySecret), signature)
}

// VerifyWebhookSignature validates the X-Razorpay-Signature header:
// HMAC-SHA256(raw_request_body, webhook_secret).
func (c *RazorpayClient) VerifyWebhookSignature(rawBody []byte, signature string) bool {
	if len(rawBody) == 0 || signature == "" || c.WebhookSecret == "" {
		return false
	}
	return verifyHMACHex(rawBody, []byte(c.WebhookSecret), signature)
}

func verifyHMACHex(payload, secret []byte, provided string) bool {
	mac := hmac.New(sha256.New, secret)
	_, _ = mac.Write(payload)
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(strings.ToLower(strings.TrimSpace(provided))))
}
