package dberrors

import (
	"errors"

	"github.com/jackc/pgx/v5/pgconn"
)

const (
	uniqueViolationCode  = "23505"
	usersEmailConstraint = "users_email_key"
)
var (
	ErrUserAlreadyExists = errors.New("user already exists")
	ErrInvalidRequestPayload = errors.New("invalid request payload")
	ErrInvalidCredential = errors.New("incorrect password")
	ErrUserNotFound = errors.New("user not found")
	ErrAccountNotActive = errors.New("account not active")
	ErrInvalidUserID = errors.New("invalid user id")
	ErrEmailAlreadyExists = errors.New("email already exist, please try again with unique email address")
	ErrGeneratingToken = errors.New("error generating token")
	
	ErrPaintingsNotFound = errors.New("artist has no paintings")
	ErrArtistProfileNotFound = errors.New("artist profile not found or not created or not verified")
	ErrUpdatingArtistAccountStatus = errors.New("error updating status of the artist")
	ErrAddingPainting = errors.New("error adding painting")
	ErrArtistNotFound        = errors.New("artist not found")
	ErrArtistAlreadyVerified = errors.New("artist already verified")
	ErrNoPaintings           = errors.New("artist has no paintings")
	ErrNotInReviewState = errors.New("artist not in review state as artist has no paintings to review")
	ErrArtistAlreadyRejected = errors.New("artist already verified or rejected")
	ErrInvalidArtistId = errors.New("invalid artist id")
	ErrInvalidCreateOrUpdateProfileRequest = errors.New("invalid request payload")
)

type ErrorResponse struct {
	Error string `json:"error" example:"error message"`
}

type MessageResponse struct {
	Message string `json:"message" example:"success"`
}

func IsEmailAlreadyExists(err error) bool {
	if err == nil {
		return false
	}

	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == uniqueViolationCode &&
			pgErr.ConstraintName == usersEmailConstraint
	}

	return false
}
