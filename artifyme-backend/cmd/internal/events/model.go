package events

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// Event types supported across the ArtifyMe domain
const (
	TopicArtifyEvents = "artifyme.events"

	// Event Type Constants
	EventOrderPlaced          = "order.placed"
	EventOrderConfirmed       = "order.confirmed"
	EventOrderAssignedArtist  = "order.assigned_artist"
	EventOrderInProgress      = "order.in_progress"
	EventOrderCompleted       = "order.completed"
	EventOrderAssignedDelivery= "order.assigned_delivery"
	EventOrderInTransit       = "order.in_transit"
	EventOrderOutForDelivery  = "order.out_for_delivery"
	EventOrderDelivered       = "order.delivered"
	EventOrderDeliveryFailed  = "order.delivery_failed"
	EventOrderPublished       = "order.published_gallery"
	EventOrderCancelled       = "order.cancelled"
)

// OutboxEvent represents a persisted domain event awaiting Kafka/Redpanda publication
type OutboxEvent struct {
	ID            uuid.UUID       `json:"id"`
	AggregateType string          `json:"aggregate_type"`
	AggregateID   string          `json:"aggregate_id"`
	EventType     string          `json:"event_type"`
	Topic         string          `json:"topic"`
	Payload       json.RawMessage `json:"payload"`
	Status        string          `json:"status"` // PENDING, PUBLISHED, FAILED
	RetryCount    int             `json:"retry_count"`
	LastError     *string         `json:"last_error,omitempty"`
	CreatedAt     time.Time       `json:"created_at"`
	PublishedAt   *time.Time      `json:"published_at,omitempty"`
}

// RelayStats tracks operational metrics for event publishing
type RelayStats struct {
	PublishedEvents int64 `json:"published_events"`
	FailedEvents    int64 `json:"failed_events"`
	PendingEvents   int64 `json:"pending_events"`
	IsConnected     bool  `json:"is_connected"`
}
