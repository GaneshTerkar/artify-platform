package orders

import "errors"

var (
	ErrNotFound          = errors.New("order not found")
	ErrForbidden         = errors.New("forbidden")
	ErrInvalidTransition = errors.New("invalid order status transition")
	ErrPaymentNotFound   = errors.New("payment not found")
)
