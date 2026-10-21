// Command razorpay-stub is a local, deterministic stand-in for the Razorpay
// REST API. It lets the full payment flow be exercised offline, without test
// keys and without moving money:
//
//	go run ./cmd/devtools/razorpay-stub
//	# then configure the API with:
//	#   RAZORPAY_API_BASE=http://127.0.0.1:19999
//	#   RAZORPAY_KEY_ID=rzp_test_local
//	#   RAZORPAY_KEY_SECRET=testsecret
//	#   RAZORPAY_WEBHOOK_SECRET=whsec
//
// It implements only what the app uses: create order, capture payment, refund.
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync/atomic"
	"time"
)

func main() {
	addr := os.Getenv("RAZORPAY_STUB_ADDR")
	if addr == "" {
		addr = "127.0.0.1:19999"
	}

	var counter int64
	nextID := func(prefix string) string {
		n := atomic.AddInt64(&counter, 1)
		return fmt.Sprintf("%s_%d%04d", prefix, time.Now().Unix(), n)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/v1/orders", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		if _, _, ok := r.BasicAuth(); !ok {
			writeJSON(w, http.StatusUnauthorized, map[string]any{"error": map[string]string{"description": "Authentication failed"}})
			return
		}
		var body struct {
			Amount   int64             `json:"amount"`
			Currency string            `json:"currency"`
			Receipt  string            `json:"receipt"`
			Notes    map[string]string `json:"notes"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]string{"description": "invalid json"}})
			return
		}
		id := nextID("order")
		log.Printf("created order %s amount=%d receipt=%s notes=%v", id, body.Amount, body.Receipt, body.Notes)
		writeJSON(w, http.StatusOK, map[string]any{
			"id": id, "entity": "order", "amount": body.Amount,
			"currency": body.Currency, "receipt": body.Receipt, "status": "created",
		})
	})

	mux.HandleFunc("/v1/payments/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		// /v1/payments/{id}/capture or /v1/payments/{id}/refund
		parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/v1/payments/"), "/")
		if len(parts) != 2 {
			http.NotFound(w, r)
			return
		}
		paymentID, action := parts[0], parts[1]
		switch action {
		case "capture":
			log.Printf("captured payment %s", paymentID)
			writeJSON(w, http.StatusOK, map[string]any{
				"id": paymentID, "entity": "payment", "status": "captured", "captured": true,
			})
		case "refund":
			id := nextID("rfnd")
			log.Printf("refunded payment %s as %s", paymentID, id)
			writeJSON(w, http.StatusOK, map[string]any{
				"id": id, "entity": "refund", "payment_id": paymentID, "status": "processed",
			})
		default:
			http.NotFound(w, r)
		}
	})

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	log.Printf("razorpay stub listening on http://%s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
