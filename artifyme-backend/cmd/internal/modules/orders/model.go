package orders

import (
	"time"

	"github.com/google/uuid"
)

type OrderStatus string

const (
	StatusPlaced         OrderStatus = "PLACED"
	StatusConfirmed      OrderStatus = "CONFIRMED"
	StatusAssignedArtist OrderStatus = "ASSIGNED_ARTIST"
	StatusInProgress     OrderStatus = "IN_PROGRESS"
	StatusCompleted      OrderStatus = "COMPLETED"
	StatusCancelled      OrderStatus = "CANCELLED"
)

type VerifiedArtist struct {
	ArtistID        uuid.UUID `json:"artist_id"`
	FullName        string    `json:"full_name"`
	Email           string    `json:"email"`
	ExperienceYears int       `json:"experience_years"`
	Bio             string    `json:"bio"`
}


type PaintingCategory string
type PaintingSize string
type PersonIncluded string

type Order struct {
	OrderID           uuid.UUID
	UserID            uuid.UUID
	ArtistID          *uuid.UUID
	PaintingCategory  PaintingCategory
	ReferenceImageURL string
	FinalImageURL     *string
	CollageImageURL   *string
	Size              PaintingSize
	PersonsIncluded   PersonIncluded
	Status            OrderStatus
	DeliveryAddress   string
	TotalPrice        float64
	CustomerNotes     *string
	CreatedAt         time.Time
	UpdatedAt         time.Time
	UpdatedBy         uuid.UUID
}

type StatusHistoryEntry struct {
	ID        uuid.UUID
	OrderID   uuid.UUID
	OldStatus OrderStatus
	NewStatus OrderStatus
	ChangedBy uuid.UUID
	Note      *string
	CreatedAt time.Time
}
