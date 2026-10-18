package orders

import "errors"

var (
	ErrNotFound            = errors.New("order not found")
	ErrForbidden           = errors.New("you are not allowed to perform this action: access forbidden for your account")
	ErrInvalidTransition   = errors.New("you are not allowed to perform this action: invalid order status transition")
	ErrPaymentNotFound     = errors.New("payment not found")
	ErrArtistNotVerified   = errors.New("you are not allowed to perform this action: orders can only be assigned to a verified artist")
	ErrArtistNotAuthorized = errors.New("you are not allowed to perform this action: unverified artists cannot assign orders")
	ErrConflict            = errors.New("conflict: order was modified concurrently by another process or user, please refresh and retry")
)


