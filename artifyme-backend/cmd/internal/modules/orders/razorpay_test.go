package orders

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func signHex(payload, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(payload))
	return hex.EncodeToString(mac.Sum(nil))
}

func TestAmountInPaise(t *testing.T) {
	cases := map[float64]int64{
		0:      0,
		100:    10000,
		2390:   239000,
		19.99:  1999,
		0.001:  0,
		1234.5: 123450,
	}
	for amount, want := range cases {
		if got := AmountInPaise(amount); got != want {
			t.Errorf("AmountInPaise(%v) = %d, want %d", amount, got, want)
		}
	}
}

func TestVerifyCheckoutSignature(t *testing.T) {
	client := NewRazorpayClient("rzp_test_local", "secret", "whsec", "")
	orderID, paymentID := "order_abc", "pay_xyz"
	valid := signHex(orderID+"|"+paymentID, "secret")

	if !client.VerifyCheckoutSignature(orderID, paymentID, valid) {
		t.Fatal("valid checkout signature was rejected")
	}
	if client.VerifyCheckoutSignature(orderID, paymentID, "deadbeef") {
		t.Fatal("invalid checkout signature was accepted")
	}
	if client.VerifyCheckoutSignature(orderID, paymentID, "") {
		t.Fatal("empty signature was accepted")
	}
	if client.VerifyCheckoutSignature(orderID+"x", paymentID, valid) {
		t.Fatal("signature for a different order was accepted")
	}
}

func TestVerifyWebhookSignature(t *testing.T) {
	client := NewRazorpayClient("rzp_test_local", "secret", "whsec", "")
	body := []byte(`{"event":"payment.captured"}`)
	valid := signHex(string(body), "whsec")

	if !client.VerifyWebhookSignature(body, valid) {
		t.Fatal("valid webhook signature was rejected")
	}
	if client.VerifyWebhookSignature(body, signHex(string(body), "wrong")) {
		t.Fatal("webhook signed with the wrong secret was accepted")
	}
	if client.VerifyWebhookSignature([]byte(`{"event":"tampered"}`), valid) {
		t.Fatal("webhook with a tampered body was accepted")
	}
	if client.VerifyWebhookSignature(body, "") {
		t.Fatal("empty webhook signature was accepted")
	}
}

func TestCreateOrderCallsRazorpayAPI(t *testing.T) {
	var gotAuth string
	var gotBody map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/orders" || r.Method != http.MethodPost {
			t.Errorf("unexpected request %s %s", r.Method, r.URL.Path)
		}
		gotAuth = r.Header.Get("Authorization")
		raw, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(raw, &gotBody)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"order_test123","entity":"order","amount":239000,"currency":"INR","receipt":"ord_1","status":"created"}`))
	}))
	defer srv.Close()

	client := NewRazorpayClient("rzp_test_local", "secret", "whsec", srv.URL)
	order, err := client.CreateOrder(context.Background(), 239000, "ord_1", map[string]string{"order_id": "ord_1"})
	if err != nil {
		t.Fatalf("CreateOrder: %v", err)
	}
	if order.ID != "order_test123" || order.Amount != 239000 || order.Currency != "INR" {
		t.Fatalf("unexpected order: %+v", order)
	}
	if gotAuth == "" {
		t.Fatal("basic auth header missing")
	}
	if gotBody["amount"].(float64) != 239000 || gotBody["currency"] != "INR" || gotBody["receipt"] != "ord_1" {
		t.Fatalf("unexpected request body: %+v", gotBody)
	}
}

func TestCreateOrderSurfacesAPIError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"error":{"description":"Authentication failed"}}`))
	}))
	defer srv.Close()

	client := NewRazorpayClient("bad", "bad", "whsec", srv.URL)
	_, err := client.CreateOrder(context.Background(), 100, "ord_1", nil)
	if err == nil {
		t.Fatal("expected an error for a 401 response")
	}
}

func TestRefundUsesFullRefundWhenAmountIsNil(t *testing.T) {
	var gotBody map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/payments/pay_1/refund" {
			t.Errorf("unexpected path %s", r.URL.Path)
		}
		raw, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(raw, &gotBody)
		_, _ = w.Write([]byte(`{"id":"rfnd_1","entity":"refund","payment_id":"pay_1","amount":239000,"status":"processed"}`))
	}))
	defer srv.Close()

	client := NewRazorpayClient("rzp_test_local", "secret", "whsec", srv.URL)
	refund, err := client.Refund(context.Background(), "pay_1", nil, map[string]string{"order_id": "ord_1"})
	if err != nil {
		t.Fatalf("Refund: %v", err)
	}
	if refund.ID != "rfnd_1" || refund.PaymentID != "pay_1" {
		t.Fatalf("unexpected refund: %+v", refund)
	}
	if _, hasAmount := gotBody["amount"]; hasAmount {
		t.Fatalf("full refund should not send an amount, got %+v", gotBody)
	}
}
