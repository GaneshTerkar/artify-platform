package orders

import "errors"

var (
	ErrNotFound            = errors.New("order not found")
	ErrForbidden           = errors.New("forbidden")
	ErrInvalidTransition   = errors.New("invalid order status transition")
	ErrPaymentNotFound     = errors.New("payment not found")
	ErrArtistNotVerified   = errors.New("orders can only be assigned to a verified artist")
	ErrArtistNotAuthorized = errors.New("unverified artists cannot assign orders")
)

