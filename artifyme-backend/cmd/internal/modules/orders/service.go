package orders

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"github.com/google/uuid"
)

type Service struct {
	repo     *Repository
	uploader FileUploader
	baseURL  string
}

func NewService(repo *Repository, uploader FileUploader, baseURL string) *Service {
	return &Service{
		repo:     repo,
		uploader: uploader,
		baseURL:  baseURL,
	}
}

func (s *Service) ListGalleryPaintings(ctx context.Context, category string) ([]PaintingItem, error) {
	return s.repo.ListGalleryPaintings(ctx, category)
}

func (s *Service) ListProducts() []Product {
	return []Product{DefaultPortraitProduct()}
}

func (s *Service) GetProduct(id string) (*Product, error) {
	p := DefaultPortraitProduct()
	if id != "" && id != p.ID {
		return nil, ErrNotFound
	}
	return &p, nil
}

func (s *Service) CreateOrder(ctx context.Context, userID uuid.UUID, in CreateOrderInput) (*Order, error) {
	if in.ReferenceImageURL == "" || in.DeliveryAddress == "" {
		return nil, fmt.Errorf("reference_image_url and delivery_address are required")
	}
	return s.repo.Create(ctx, in)
}

func (s *Service) GetOrder(ctx context.Context, orderID, userID uuid.UUID, role string) (*Order, error) {
	o, err := s.repo.GetByID(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if role != "ADMIN" && o.UserID != userID {
		return nil, ErrForbidden
	}
	return o, nil
}

func (s *Service) ListMyOrders(ctx context.Context, userID uuid.UUID) ([]Order, error) {
	return s.repo.ListByUser(ctx, userID)
}

func (s *Service) ListAdminOrders(ctx context.Context, status *string) ([]Order, error) {
	return s.repo.ListAll(ctx, status)
}

func (s *Service) UpdateDraft(ctx context.Context, orderID, userID uuid.UUID, fields map[string]interface{}) (*Order, error) {
	return s.repo.UpdateDraft(ctx, orderID, userID, fields)
}

func (s *Service) TransitionStatus(ctx context.Context, orderID uuid.UUID, actorID uuid.UUID, role string, newStatus OrderStatus, artistID *uuid.UUID, finalURL *string) (*Order, error) {
	o, err := s.repo.GetByID(ctx, orderID)
	if err != nil {
		return nil, err
	}

	if !canTransition(role, o.Status, newStatus) {
		return nil, ErrInvalidTransition
	}

	if role == "ARTIST" {
		if o.ArtistID == nil || *o.ArtistID != actorID {
			return nil, errors.New("you can only update status for orders assigned to you")
		}
	}

	var collageURL *string
	if newStatus == StatusCompleted {
		if finalURL == nil || *finalURL == "" {
			return nil, errors.New("a final sketch image URL or upload is required to complete the order")
		}

		if o.ReferenceImageURL != "" {
			cURL, err := GenerateCollage(ctx, orderID, *finalURL, o.ReferenceImageURL, s.uploader, s.baseURL)
			if err != nil {
				slog.Error("failed to generate artwork collage", "order_id", orderID, "error", err)
			} else {
				collageURL = &cURL
			}
		}
	}

	if artistID != nil {
		verified, err := s.repo.IsArtistVerified(ctx, *artistID)
		if err != nil {
			return nil, err
		}
		if !verified {
			return nil, ErrArtistNotVerified
		}
	}

	return s.repo.UpdateStatus(ctx, orderID, newStatus, actorID, artistID, finalURL, collageURL)
}

func (s *Service) AssignOrder(ctx context.Context, orderID uuid.UUID, actorID uuid.UUID, role string, targetArtistID uuid.UUID) (*Order, error) {
	if role != "ADMIN" && role != "ARTIST" {
		return nil, ErrForbidden
	}

	if role == "ARTIST" {
		callerVerified, err := s.repo.IsArtistVerified(ctx, actorID)
		if err != nil {
			return nil, err
		}
		if !callerVerified {
			return nil, ErrArtistNotAuthorized
		}
	}

	targetVerified, err := s.repo.IsArtistVerified(ctx, targetArtistID)
	if err != nil {
		return nil, err
	}
	if !targetVerified {
		return nil, ErrArtistNotVerified
	}

	o, err := s.repo.GetByID(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if o.Status == StatusPlaced {
		return nil, errors.New("cannot assign an artist until order payment is confirmed")
	}
	if o.Status == StatusCompleted || o.Status == StatusCancelled {
		return nil, errors.New("cannot assign an order that is already completed or cancelled")
	}
	if o.ArtistID != nil && *o.ArtistID == targetArtistID {
		return nil, errors.New("cannot reassign order to the same artist already assigned")
	}

	newStatus := StatusAssignedArtist
	if o.Status == StatusInProgress {
		newStatus = StatusInProgress
	}

	return s.repo.AssignArtist(ctx, orderID, targetArtistID, actorID, newStatus)
}

func (s *Service) ListVerifiedArtists(ctx context.Context) ([]VerifiedArtist, error) {
	return s.repo.ListVerifiedArtists(ctx)
}

func (s *Service) History(ctx context.Context, orderID, userID uuid.UUID, role string) ([]StatusHistoryEntry, error) {
	o, err := s.repo.GetByID(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if role != "ADMIN" && o.UserID != userID {
		return nil, ErrForbidden
	}
	return s.repo.StatusHistory(ctx, orderID)
}

func (s *Service) RecordPendingPayment(ctx context.Context, orderID uuid.UUID, sessionID string, amount float64, currency string) error {
	return s.repo.InsertPayment(ctx, orderID, sessionID, amount, currency)
}

func (s *Service) ConfirmPaid(ctx context.Context, sessionID string, systemUserID uuid.UUID) (*Order, error) {
	orderID, err := s.repo.MarkPaymentPaid(ctx, sessionID)
	if err != nil {
		return nil, err
	}
	return s.repo.UpdateStatus(ctx, orderID, StatusConfirmed, systemUserID, nil, nil, nil)
}

func canTransition(role string, from, to OrderStatus) bool {
	if role == "ADMIN" {
		switch to {
		case StatusConfirmed, StatusAssignedArtist, StatusInProgress, StatusCompleted, StatusCancelled:
			return true
		}
	}
	if role == "ARTIST" {
		if from == StatusAssignedArtist && to == StatusConfirmed {
			return true
		}
		if (from == StatusConfirmed || from == StatusAssignedArtist) && to == StatusInProgress {
			return true
		}
		if from == StatusInProgress && to == StatusCompleted {
			return true
		}
	}
	if role == "CUSTOMER" {
		if from == StatusPlaced && to == StatusCancelled {
			return true
		}
	}
	return false
}

func (s *Service) ConfirmGalleryPublish(ctx context.Context, orderID, actorID uuid.UUID, role string) (*Order, error) {
	if role != "ADMIN" {
		return nil, ErrForbidden
	}
	o, err := s.repo.GetByID(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if o.Status != StatusCompleted {
		return nil, errors.New("only completed orders can be confirmed and published to gallery")
	}

	sketchURL := ""
	if o.OriginalFinalImageURL != nil && *o.OriginalFinalImageURL != "" {
		sketchURL = *o.OriginalFinalImageURL
	} else if o.FinalImageURL != nil {
		sketchURL = *o.FinalImageURL
	}

	// Ensure collage is generated using this order's exact reference photo and finished sketch
	if (o.CollageImageURL == nil || *o.CollageImageURL == "") && o.ReferenceImageURL != "" && sketchURL != "" {
		cURL, err := GenerateCollage(ctx, orderID, sketchURL, o.ReferenceImageURL, s.uploader, s.baseURL)
		if err == nil {
			_ = s.repo.UpdateCollageURL(ctx, orderID, cURL)
		} else {
			slog.Error("failed to generate artwork collage during admin confirmation", "order_id", orderID, "error", err)
		}
	}

	return s.repo.ConfirmGalleryPublish(ctx, orderID, actorID)
}

func (s *Service) ListAllUsers(ctx context.Context, role string) ([]UserItemDTO, error) {
	if role != "ADMIN" {
		return nil, ErrForbidden
	}
	return s.repo.ListAllUsers(ctx)
}

func (s *Service) UpdateUserStatus(ctx context.Context, actorRole string, targetUserID uuid.UUID, status string) error {
	if actorRole != "ADMIN" {
		return ErrForbidden
	}
	if status != "ACTIVE" && status != "SUSPENDED" {
		return fmt.Errorf("invalid status, must be ACTIVE or SUSPENDED")
	}
	return s.repo.UpdateUserStatus(ctx, targetUserID, status)
}

func (s *Service) ElevateArtistToAdmin(ctx context.Context, actorRole string, actorID, targetUserID uuid.UUID) error {
	if actorRole != "ADMIN" {
		return ErrForbidden
	}
	if actorID == targetUserID {
		return fmt.Errorf("cannot modify your own role")
	}
	role, err := s.repo.GetUserRole(ctx, targetUserID)
	if err != nil {
		return err
	}
	if role != "ARTIST" {
		return fmt.Errorf("only artists can be promoted to Admin")
	}

	completed, stalled, err := s.repo.GetArtistCompletedAndStalledCount(ctx, targetUserID)
	if err != nil {
		return err
	}
	if completed < 2 {
		return fmt.Errorf("artist must have completed at least 2 portrait commissions to qualify for Admin (current: %d)", completed)
	}
	if stalled > 0 {
		return fmt.Errorf("artist has %d unconfirmed/stalled assignment(s) and cannot be promoted", stalled)
	}

	return s.repo.UpdateUserRole(ctx, targetUserID, "ADMIN")
}


