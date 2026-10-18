package orders

import (
	"time"

	"github.com/google/uuid"
)

type OrderStatus string

const (
	StatusPlaced                OrderStatus = "PLACED"
	StatusConfirmed             OrderStatus = "CONFIRMED"
	StatusAssignedArtist        OrderStatus = "ASSIGNED_ARTIST"
	StatusInProgress            OrderStatus = "IN_PROGRESS"
	StatusCompleted             OrderStatus = "COMPLETED"
	StatusAssignedDeliveryAgent OrderStatus = "ASSIGNED_DELIVERY_AGENT"
	StatusInTransit             OrderStatus = "IN_TRANSIT"
	StatusOutForDelivery        OrderStatus = "OUT_FOR_DELIVERY"
	StatusDeliveryFailed        OrderStatus = "DELIVERY_FAILED"
	StatusDelivered             OrderStatus = "DELIVERED"
	StatusPublished             OrderStatus = "PUBLISHED"
	StatusCancelled             OrderStatus = "CANCELLED"
)

type VerifiedArtist struct {
	ArtistID        uuid.UUID `json:"artist_id"`
	FullName        string    `json:"full_name"`
	Email           string    `json:"email"`
	ExperienceYears int       `json:"experience_years"`
	Bio             string    `json:"bio"`
}

type ActiveDeliveryAgent struct {
	UserID      uuid.UUID `json:"user_id"`
	FullName    string    `json:"full_name"`
	Email       string    `json:"email"`
	PhoneNumber string    `json:"phone_number"`
	Address     string    `json:"address"`
	Status      string    `json:"status"`
}

type PaintingCategory string
type PaintingSize string
type PersonIncluded string

type Order struct {
	OrderID               uuid.UUID
	UserID                uuid.UUID
	ArtistID              *uuid.UUID
	DeliveryAgentID       *uuid.UUID
	PaintingCategory      PaintingCategory
	ReferenceImageURL     string
	FinalImageURL         *string
	CollageImageURL       *string
	OriginalFinalImageURL *string
	IsPublishedToGallery  bool
	Size                  PaintingSize
	PersonsIncluded       PersonIncluded
	Status                OrderStatus
	DeliveryAddress       string
	DeliveryAttempts      int
	DeliveryFailureReason *string
	LastDeliveryAttemptAt *time.Time
	TotalPrice            float64
	CustomerNotes         *string
	CreatedAt             time.Time
	UpdatedAt             time.Time
	UpdatedBy             uuid.UUID
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
