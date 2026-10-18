package orders

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/ganeshterkar/artifyme-backend/cmd/internal/cache"
	"github.com/ganeshterkar/artifyme-backend/cmd/internal/events"
	"github.com/ganeshterkar/artifyme-backend/cmd/internal/worker"
	"github.com/google/uuid"
)

type Service struct {
	repo       *Repository
	uploader   FileUploader
	baseURL    string
	pool       *worker.Pool
	eventsRepo events.Repository
	relay      *events.Relay
}

func NewService(repo *Repository, uploader FileUploader, baseURL string, pool *worker.Pool, eventsRepo events.Repository, relay *events.Relay) *Service {
	return &Service{
		repo:       repo,
		uploader:   uploader,
		baseURL:    baseURL,
		pool:       pool,
		eventsRepo: eventsRepo,
		relay:      relay,
	}
}

func (s *Service) emitEvent(ctx context.Context, aggregateID string, eventType string, payload map[string]interface{}) {
	if s.eventsRepo == nil {
		return
	}
	if err := s.eventsRepo.RecordEvent(ctx, "ORDER", aggregateID, eventType, events.TopicArtifyEvents, payload); err != nil {
		slog.Error("failed to record outbox event", "event_type", eventType, "aggregate_id", aggregateID, "error", err)
	}
}

func (s *Service) emitDeliveryEvent(ctx context.Context, o *Order, status OrderStatus, actorID uuid.UUID, role string) {
	var evt string
	switch status {
	case StatusInTransit:
		evt = events.EventOrderInTransit
	case StatusOutForDelivery:
		evt = events.EventOrderOutForDelivery
	case StatusDelivered:
		evt = events.EventOrderDelivered
	case StatusDeliveryFailed:
		evt = events.EventOrderDeliveryFailed
	}
	if evt != "" && o != nil {
		s.emitEvent(ctx, o.OrderID.String(), evt, map[string]interface{}{
			"order_id": o.OrderID.String(),
			"status":   string(o.Status),
			"version":  o.Version,
			"actor_id": actorID.String(),
			"role":     role,
		})
	}
}

func (s *Service) OutboxStats(ctx context.Context) *events.RelayStats {
	if s.relay == nil {
		return nil
	}
	stats := s.relay.Stats(ctx)
	return &stats
}

func (s *Service) WorkerStats() *worker.Stats {
	if s.pool == nil {
		return nil
	}
	stats := s.pool.Stats()
	return &stats
}

func (s *Service) ListGalleryPaintings(ctx context.Context, category string) ([]PaintingItem, error) {
	normCat := strings.ToUpper(strings.TrimSpace(category))
	if normCat == "" {
		normCat = "ALL"
	}
	cacheKey := fmt.Sprintf("cache:gallery:%s", normCat)

	var cached []PaintingItem
	if cache.Get(ctx, cacheKey, &cached) {
		slog.Debug("Gallery cache HIT", "key", cacheKey, "count", len(cached))
		return cached, nil
	}

	paintings, err := s.repo.ListGalleryPaintings(ctx, category)
	if err != nil {
		return nil, err
	}

	// Cache in Redis for 10 minutes
	_ = cache.Set(ctx, cacheKey, paintings, 10*time.Minute)
	return paintings, nil
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
	o, err := s.repo.Create(ctx, in)
	if err != nil {
		return nil, err
	}
	s.emitEvent(ctx, o.OrderID.String(), events.EventOrderPlaced, map[string]interface{}{
		"order_id":         o.OrderID.String(),
		"user_id":          o.UserID.String(),
		"category":         string(o.PaintingCategory),
		"size":             string(o.Size),
		"persons_included": string(o.PersonsIncluded),
		"total_price":      o.TotalPrice,
		"status":           string(o.Status),
		"created_at":       o.CreatedAt,
	})
	return o, nil
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

func (s *Service) TransitionStatus(ctx context.Context, orderID uuid.UUID, actorID uuid.UUID, role string, newStatus OrderStatus, artistID *uuid.UUID, finalURL *string, failureReason *string, expectedVersion ...int) (*Order, error) {
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

	if role == "DELIVERY_AGENT" {
		if o.DeliveryAgentID == nil || *o.DeliveryAgentID != actorID {
			return nil, errors.New("you can only update status for delivery parcels assigned to you")
		}
		updated, err := s.repo.UpdateDeliveryStatus(ctx, orderID, newStatus, actorID, failureReason, expectedVersion...)
		if err != nil {
			return nil, err
		}
		s.emitDeliveryEvent(ctx, updated, newStatus, actorID, role)
		return updated, nil
	}

	if o.Status == StatusAssignedDeliveryAgent && newStatus == StatusCompleted {
		return s.repo.UnassignDeliveryAgent(ctx, orderID, actorID, expectedVersion...)
	}

	if newStatus == StatusPublished {
		return s.ConfirmGalleryPublish(ctx, orderID, actorID, role, expectedVersion...)
	}

	if newStatus == StatusDeliveryFailed || newStatus == StatusInTransit || newStatus == StatusOutForDelivery || newStatus == StatusDelivered {
		updated, err := s.repo.UpdateDeliveryStatus(ctx, orderID, newStatus, actorID, failureReason, expectedVersion...)
		if err != nil {
			return nil, err
		}
		s.emitDeliveryEvent(ctx, updated, newStatus, actorID, role)
		return updated, nil
	}

	var collageURL *string
	if newStatus == StatusCompleted {
		if finalURL == nil || *finalURL == "" {
			return nil, errors.New("a final sketch image URL or upload is required to complete the order")
		}

		if o.ReferenceImageURL != "" {
			finalURLVal := *finalURL
			refURLVal := o.ReferenceImageURL

			if s.pool != nil {
				// Non-blocking asynchronous collage processing in worker pool!
				s.pool.Enqueue(worker.Job{
					Name: fmt.Sprintf("collage-order-%s", orderID),
					Handler: func(ctx context.Context) error {
						cURL, err := GenerateCollage(ctx, orderID, finalURLVal, refURLVal, s.uploader, s.baseURL)
						if err != nil {
							slog.Error("failed to generate artwork collage in worker pool", "order_id", orderID, "error", err)
							return err
						}
						return s.repo.UpdateCollageURL(ctx, orderID, cURL)
					},
				})
			} else {
				cURL, err := GenerateCollage(ctx, orderID, finalURLVal, refURLVal, s.uploader, s.baseURL)
				if err != nil {
					slog.Error("failed to generate artwork collage", "order_id", orderID, "error", err)
				} else {
					collageURL = &cURL
				}
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

	updated, err := s.repo.UpdateStatus(ctx, orderID, newStatus, actorID, artistID, finalURL, collageURL, expectedVersion...)
	if err != nil {
		return nil, err
	}

	var eventType string
	switch newStatus {
	case StatusInProgress:
		eventType = events.EventOrderInProgress
	case StatusCompleted:
		eventType = events.EventOrderCompleted
	case StatusInTransit:
		eventType = events.EventOrderInTransit
	case StatusOutForDelivery:
		eventType = events.EventOrderOutForDelivery
	case StatusDelivered:
		eventType = events.EventOrderDelivered
	case StatusDeliveryFailed:
		eventType = events.EventOrderDeliveryFailed
	case StatusPublished:
		eventType = events.EventOrderPublished
	case StatusCancelled:
		eventType = events.EventOrderCancelled
	}

	if eventType != "" {
		s.emitEvent(ctx, updated.OrderID.String(), eventType, map[string]interface{}{
			"order_id": updated.OrderID.String(),
			"status":   string(updated.Status),
			"version":  updated.Version,
			"actor_id": actorID.String(),
			"role":     role,
		})
	}
	return updated, nil
}

func (s *Service) AssignOrder(ctx context.Context, orderID uuid.UUID, actorID uuid.UUID, role string, targetArtistID uuid.UUID, expectedVersion ...int) (*Order, error) {
	if role != "ADMIN" && role != "ARTIST" {
		return nil, ErrForbidden
	}

	// Distributed lock to prevent concurrent assignment race conditions
	lockKey := fmt.Sprintf("order:%s", orderID)
	lockToken := uuid.New().String()
	acquired, err := cache.AcquireLock(ctx, lockKey, lockToken, 5*time.Second)
	if err != nil || !acquired {
		return nil, errors.New("order is currently being modified by another request, please retry")
	}
	defer cache.ReleaseLock(ctx, lockKey, lockToken)

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

	updated, err := s.repo.AssignArtist(ctx, orderID, targetArtistID, actorID, newStatus, expectedVersion...)
	if err != nil {
		return nil, err
	}
	s.emitEvent(ctx, updated.OrderID.String(), events.EventOrderAssignedArtist, map[string]interface{}{
		"order_id":    updated.OrderID.String(),
		"artist_id":   targetArtistID.String(),
		"assigned_by": actorID.String(),
		"status":      string(updated.Status),
		"version":     updated.Version,
	})
	return updated, nil
}

func (s *Service) AssignDeliveryAgent(ctx context.Context, orderID uuid.UUID, actorID uuid.UUID, role string, targetAgentID uuid.UUID, expectedVersion ...int) (*Order, error) {
	if role != "ADMIN" {
		return nil, ErrForbidden
	}

	// Distributed lock to prevent concurrent delivery assignment race conditions
	lockKey := fmt.Sprintf("order:%s", orderID)
	lockToken := uuid.New().String()
	acquired, err := cache.AcquireLock(ctx, lockKey, lockToken, 5*time.Second)
	if err != nil || !acquired {
		return nil, errors.New("order is currently being modified by another request, please retry")
	}
	defer cache.ReleaseLock(ctx, lockKey, lockToken)

	o, err := s.repo.GetByID(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if o.Status != StatusCompleted && o.Status != StatusAssignedDeliveryAgent && o.Status != StatusInTransit && o.Status != StatusDeliveryFailed {
		return nil, errors.New("only completed or in-delivery orders can be assigned a delivery partner")
	}

	agents, err := s.repo.ListActiveDeliveryAgents(ctx)
	if err != nil {
		return nil, err
	}
	found := false
	for _, a := range agents {
		if a.UserID == targetAgentID {
			found = true
			break
		}
	}
	if !found {
		return nil, errors.New("selected delivery agent is not active or verified")
	}

	updated, err := s.repo.AssignDeliveryAgent(ctx, orderID, targetAgentID, actorID, expectedVersion...)
	if err != nil {
		return nil, err
	}
	s.emitEvent(ctx, updated.OrderID.String(), events.EventOrderAssignedDelivery, map[string]interface{}{
		"order_id":          updated.OrderID.String(),
		"delivery_agent_id": targetAgentID.String(),
		"assigned_by":       actorID.String(),
		"status":            string(updated.Status),
		"version":           updated.Version,
	})
	return updated, nil
}

func (s *Service) ListActiveDeliveryAgents(ctx context.Context) ([]ActiveDeliveryAgent, error) {
	return s.repo.ListActiveDeliveryAgents(ctx)
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
	updated, err := s.repo.UpdateStatus(ctx, orderID, StatusConfirmed, systemUserID, nil, nil, nil)
	if err != nil {
		return nil, err
	}
	s.emitEvent(ctx, updated.OrderID.String(), "order.paid", map[string]interface{}{
		"order_id":   updated.OrderID.String(),
		"session_id": sessionID,
		"status":     string(updated.Status),
		"version":    updated.Version,
	})
	return updated, nil
}

func canTransition(role string, from, to OrderStatus) bool {
	if role == "ADMIN" {
		switch to {
		case StatusConfirmed, StatusAssignedArtist, StatusInProgress, StatusCompleted,
			StatusAssignedDeliveryAgent, StatusInTransit, StatusOutForDelivery, StatusDeliveryFailed, StatusDelivered, StatusPublished, StatusCancelled:
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
	if role == "DELIVERY_AGENT" {
		// Assigned -> In Transit, Out for Delivery, or Decline back to Completed
		if from == StatusAssignedDeliveryAgent && (to == StatusInTransit || to == StatusOutForDelivery || to == StatusCompleted) {
			return true
		}
		// In Transit -> Out for Delivery
		if from == StatusInTransit && to == StatusOutForDelivery {
			return true
		}
		// Out for Delivery -> Delivered or Delivery Failed
		if from == StatusOutForDelivery && (to == StatusDelivered || to == StatusDeliveryFailed) {
			return true
		}
		// Delivery Failed -> Re-attempt Out for Delivery
		if from == StatusDeliveryFailed && (to == StatusOutForDelivery || to == StatusInTransit) {
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

func (s *Service) ConfirmGalleryPublish(ctx context.Context, orderID, actorID uuid.UUID, role string, expectedVersion ...int) (*Order, error) {
	if role != "ADMIN" {
		return nil, ErrForbidden
	}
	o, err := s.repo.GetByID(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if o.Status != StatusDelivered && o.Status != StatusCompleted && o.Status != StatusPublished {
		return nil, errors.New("artwork must be completed or doorstep delivered before publishing to gallery")
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

	res, err := s.repo.ConfirmGalleryPublish(ctx, orderID, actorID, expectedVersion...)
	if err == nil {
		_ = cache.DeletePattern(ctx, "cache:gallery:*")
		s.emitEvent(ctx, res.OrderID.String(), events.EventOrderPublished, map[string]interface{}{
			"order_id":  res.OrderID.String(),
			"status":    string(res.Status),
			"version":   res.Version,
			"published": true,
		})
	}
	return res, err
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


