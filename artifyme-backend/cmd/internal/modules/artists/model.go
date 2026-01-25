package artists

import (
	"time"

	"github.com/ganeshterkar/artifyme-backend/cmd/internal/modules/auth"
	"github.com/google/uuid"
)

type ErrorResponse struct {
	Error string `json:"error" example:"error message"`
}

type MessageResponse struct {
	Message string `json:"message" example:"success"`
}

type AddPaintingRequest struct {
	Title       string 					`json:"title" binding:"required"`
	Description string 					`json:"description"`
	Category    auth.PaintingCategory 	`json:"category" binding:"required"`
	ImageURL    string 					`json:"image_url" binding:"required,url"`
}

type ArtistProfileRequest struct {
	Bio             string `json:"bio" binding:"required"`
	ExperienceYears int    `json:"experience_years" binding:"gte=0,lte=60"`
}
type ArtistProfileResponse struct {
	ArtistProfileID uuid.UUID `json:"artist_profile_id"`
	ArtistID        uuid.UUID `json:"artist_id"`

	FullName string `json:"full_name"`
	UserName string `json:"user_name"`
	Email    string `json:"email"`

	Bio             string    `json:"bio"`
	ExperienceYears int       `json:"experience_years"`
	Verified        bool      `json:"verified"`

	CreatedAt *time.Time `json:"created_at,omitempty"`
	UpdatedAt *time.Time `json:"updated_at,omitempty"`
}

type ArtistPainting struct {
	PaintingID  uuid.UUID 	`json:"painting_id"`
	ArtistID    uuid.UUID 	`json:"artist_id"`
	Title       string		`json:"title"`
	Description string		`json:"description"`
	Category    string		`json:"category"`
	ImageURL    string		`json:"image_url"`
	CreatedAt *time.Time `json:"created_at,omitempty"`
	UpdatedAt *time.Time `json:"updated_at,omitempty"`
}

type AdminArtistReviewItem struct {
	ArtistID        uuid.UUID 	`json:"artist_id"`
	FullName        string		`json:"full_name"`
	UserName        string		`json:"user_name"`
	Bio             string		`json:"bio"`
	ExperienceYears int			`json:"experience_years"`
	PaintingsCount  int			`json:"paintings_count"`
	CreatedAt       time.Time	`json:"created_at"`
}

type RejectArtistRequest struct {
	Reason string `json:"reason" binding:"required,min=10"`
}

type ArtistReviewStatusResponse struct {
	Status          string     `json:"status"`
	Verified        bool       `json:"verified"`
	RejectedReason  *string    `json:"rejected_reason,omitempty"`
	RejectedAt      *time.Time `json:"rejected_at,omitempty"`
}