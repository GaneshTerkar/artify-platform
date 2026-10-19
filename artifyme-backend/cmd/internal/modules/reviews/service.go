package reviews

import (
	"context"
	"errors"
	"strings"

	"github.com/ganeshterkar/artifyme-backend/cmd/internal/events"
	"github.com/google/uuid"
)

type Service struct {
	repo       *Repository
	eventsRepo events.Repository
}

func NewService(repo *Repository, eventsRepo events.Repository) *Service {
	return &Service{
		repo:       repo,
		eventsRepo: eventsRepo,
	}
}

func (s *Service) CreateReview(ctx context.Context, customerID uuid.UUID, in CreateReviewInput) (*Review, error) {
	if in.OrderID == uuid.Nil {
		return nil, errors.New("order_id is required")
	}
	if in.Rating < 1 || in.Rating > 5 {
		return nil, errors.New("rating must be between 1 and 5")
	}
	in.Comment = strings.TrimSpace(in.Comment)
	if in.Comment == "" {
		return nil, errors.New("review comment cannot be empty")
	}
	in.Title = strings.TrimSpace(in.Title)
	if in.Title == "" {
		in.Title = "Verified Commission Review"
	}

	rev, err := s.repo.CreateReview(ctx, customerID, in)
	if err != nil {
		return nil, err
	}

	if s.eventsRepo != nil {
		_ = s.eventsRepo.RecordEvent(ctx, "REVIEW", rev.ReviewID.String(), "review.submitted", events.TopicArtifyEvents, map[string]interface{}{
			"review_id":   rev.ReviewID.String(),
			"order_id":    rev.OrderID.String(),
			"customer_id": rev.CustomerID.String(),
			"rating":      rev.Rating,
		})
	}

	return rev, nil
}

func (s *Service) GetReviewByOrderID(ctx context.Context, orderID uuid.UUID) (*Review, error) {
	if orderID == uuid.Nil {
		return nil, errors.New("invalid order id")
	}
	return s.repo.GetReviewByOrderID(ctx, orderID)
}

func (s *Service) ListPublicReviews(ctx context.Context, limit int) ([]Review, error) {
	return s.repo.ListPublicReviews(ctx, limit)
}

func (s *Service) ListAdminReviews(ctx context.Context, minRating, maxRating *int, isFeatured, isApproved *bool) ([]Review, error) {
	return s.repo.ListAdminReviews(ctx, minRating, maxRating, isFeatured, isApproved)
}

func (s *Service) ModerateReview(ctx context.Context, reviewID uuid.UUID, in ModerateReviewInput) (*Review, error) {
	if reviewID == uuid.Nil {
		return nil, errors.New("invalid review id")
	}
	return s.repo.ModerateReview(ctx, reviewID, in)
}

func (s *Service) GetReviewStats(ctx context.Context) (*ReviewStats, error) {
	return s.repo.GetReviewStats(ctx)
}
