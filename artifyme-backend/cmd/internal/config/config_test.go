package config

import (
	"strings"
	"testing"
)

func basePaymentConfig() Config {
	return Config{
		Payment: PaymentConfig{
			Provider:              "razorpay",
			Live:                  false,
			RazorpayKeyID:         "rzp_test_local",
			RazorpayKeySecret:     "secret",
			RazorpayWebhookSecret: "whsec",
			MinAmount:             100,
			MaxAmount:             200000,
		},
	}
}

func TestValidatePaymentsDefaultsToManual(t *testing.T) {
	cfg := Config{Payment: PaymentConfig{Provider: ""}}
	if err := cfg.ValidatePayments(); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.Payment.Provider != "manual" {
		t.Fatalf("provider = %q, want manual", cfg.Payment.Provider)
	}
}

func TestValidatePaymentsAcceptsTestKey(t *testing.T) {
	cfg := basePaymentConfig()
	if err := cfg.ValidatePayments(); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestValidatePaymentsRejectsLiveKeyWhenLiveIsFalse(t *testing.T) {
	cfg := basePaymentConfig()
	cfg.Payment.RazorpayKeyID = "rzp_live_abc"
	cfg.Payment.Live = false

	err := cfg.ValidatePayments()
	if err == nil || !strings.Contains(err.Error(), "LIVE key") {
		t.Fatalf("expected a live-key refusal, got %v", err)
	}
}

func TestValidatePaymentsRejectsTestKeyWhenLiveIsTrue(t *testing.T) {
	cfg := basePaymentConfig()
	cfg.Payment.Live = true

	err := cfg.ValidatePayments()
	if err == nil || !strings.Contains(err.Error(), "TEST key") {
		t.Fatalf("expected a test-key refusal, got %v", err)
	}
}

func TestValidatePaymentsRequiresSecrets(t *testing.T) {
	cfg := basePaymentConfig()
	cfg.Payment.RazorpayKeySecret = ""
	if err := cfg.ValidatePayments(); err == nil {
		t.Fatal("expected an error for a missing key secret")
	}

	cfg = basePaymentConfig()
	cfg.Payment.RazorpayWebhookSecret = ""
	if err := cfg.ValidatePayments(); err == nil {
		t.Fatal("expected an error for a missing webhook secret")
	}
}

func TestValidatePaymentsRejectsUnknownProvider(t *testing.T) {
	cfg := Config{Payment: PaymentConfig{Provider: "paypal"}}
	if err := cfg.ValidatePayments(); err == nil {
		t.Fatal("expected an error for an unknown provider")
	}
}

func TestValidatePaymentsRejectsBadLimits(t *testing.T) {
	cfg := basePaymentConfig()
	cfg.Payment.MinAmount = 500
	cfg.Payment.MaxAmount = 100
	if err := cfg.ValidatePayments(); err == nil {
		t.Fatal("expected an error for min > max")
	}
}
