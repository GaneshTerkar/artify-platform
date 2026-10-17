package orders

import (
	"context"
	"fmt"

	"github.com/google/uuid"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
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

	return s.repo.UpdateStatus(ctx, orderID, newStatus, actorID, artistID, finalURL)
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
	return s.repo.UpdateStatus(ctx, orderID, StatusConfirmed, systemUserID, nil, nil)
}

func canTransition(role string, from, to OrderStatus) bool {
	if role == "ADMIN" {
		switch to {
		case StatusConfirmed, StatusInProgress, StatusCompleted, StatusCancelled:
			return true
		}
	}
	if role == "ARTIST" {
		if from == StatusConfirmed && to == StatusInProgress {
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
