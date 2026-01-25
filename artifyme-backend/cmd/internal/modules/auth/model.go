package auth

import (
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type UserRole string

const (
	Admin         UserRole = "ADMIN"
	Artist        UserRole = "ARTIST"
	Customer      UserRole = "CUSTOMER"
	DeliveryAgent UserRole = "DELIVERY_AGENT"
)

type PaintingCategory string
const (
	Pencil 		PaintingCategory 	= "PENCIL"
	Charcoal 	PaintingCategory 	= "CHARCOAL"
	Oil 		PaintingCategory 	= "OIL"
	Acrylic 	PaintingCategory 	= "ACRYLIC"
	WaterColor 	PaintingCategory 	= "WATERCOLOR"
)

type AccountStatus string


const (
	Pending   	AccountStatus 	= "PENDING"
	UnderReview AccountStatus 	= "UNDER_REVIEW"
	Active    	AccountStatus 	= "ACTIVE"
	Suspended 	AccountStatus 	= "SUSPENDED"
	Rejected 	AccountStatus 	= "REJECTED"
)

type User struct {
	UserID      uuid.UUID 
	FullName    string
	UserName    string
	Email       string
	Address     pgtype.Text
	PhoneNumber string
	Role        UserRole
	Status      AccountStatus
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

