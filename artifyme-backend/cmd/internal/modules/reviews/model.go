package reviews

import (
	"time"

	"github.com/google/uuid"
)

type Review struct {
	ReviewID         uuid.UUID  `json:"review_id"`
	OrderID          uuid.UUID  `json:"order_id"`
	CustomerID       uuid.UUID  `json:"customer_id"`
	CustomerName     string     `json:"customer_name,omitempty"`
	ArtistID         *uuid.UUID `json:"artist_id,omitempty"`
	ArtistName       string     `json:"artist_name,omitempty"`
	PaintingCategory string     `json:"painting_category,omitempty"`
	FinalImageURL    string     `json:"final_image_url,omitempty"`
	Rating           int        `json:"rating"`
	Title            string     `json:"title"`
	Comment          string     `json:"comment"`
	UnboxingPhotoURL *string    `json:"unboxing_photo_url,omitempty"`
	IsFeatured       bool       `json:"is_featured"`
	IsApproved       bool       `json:"is_approved"`
	AdminNotes       *string    `json:"admin_notes,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

type CreateReviewInput struct {
	OrderID          uuid.UUID `json:"order_id"`
	Rating           int       `json:"rating"`
	Title            string    `json:"title"`
	Comment          string    `json:"comment"`
	UnboxingPhotoURL *string   `json:"unboxing_photo_url,omitempty"`
}

type ModerateReviewInput struct {
	IsFeatured *bool   `json:"is_featured,omitempty"`
	IsApproved *bool   `json:"is_approved,omitempty"`
	AdminNotes *string `json:"admin_notes,omitempty"`
}

type ArtistRating struct {
	ArtistID      uuid.UUID `json:"artist_id"`
	ArtistName    string    `json:"artist_name"`
	TotalReviews  int       `json:"total_reviews"`
	AverageRating float64   `json:"average_rating"`
}

type ReviewStats struct {
	TotalReviews       int            `json:"total_reviews"`
	AverageRating      float64        `json:"average_rating"`
	CSATScorePercent   float64        `json:"csat_score_percent"`
	RatingDistribution map[string]int `json:"rating_distribution"`
	QualityAlertsCount int            `json:"quality_alerts_count"`
	ArtistLeaderboard  []ArtistRating `json:"artist_leaderboard"`
}
