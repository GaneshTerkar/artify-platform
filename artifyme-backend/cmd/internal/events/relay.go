package events

import (
	"context"
	"log/slog"
	"sync"
	"sync/atomic"
	"time"

	"github.com/segmentio/kafka-go"
)

type Relay struct {
	repo           Repository
	writer         *kafka.Writer
	brokers        []string
	defaultTopic   string
	enabled        bool
	publishedCount int64
	failedCount    int64
	stopCh         chan struct{}
	wg             sync.WaitGroup
}

func NewRelay(repo Repository, brokers []string, defaultTopic string, enabled bool) *Relay {
	var writer *kafka.Writer
	if enabled && len(brokers) > 0 {
		writer = &kafka.Writer{
			Addr:         kafka.TCP(brokers...),
			Balancer:     &kafka.LeastBytes{},
			BatchSize:    50,
			BatchTimeout: 10 * time.Millisecond,
			Async:                  false, // Synchronous write for guaranteed ack
			RequiredAcks:           kafka.RequireOne,
			AllowAutoTopicCreation: true,
		}
	}

	return &Relay{
		repo:         repo,
		writer:       writer,
		brokers:      brokers,
		defaultTopic: defaultTopic,
		enabled:      enabled,
		stopCh:       make(chan struct{}),
	}
}

func (r *Relay) Start() {
	if !r.enabled || r.writer == nil {
		slog.Info("Outbox Relay is disabled or writer unconfigured")
		return
	}

	slog.Info("Starting Transactional Outbox Relay", "brokers", r.brokers, "default_topic", r.defaultTopic)
	r.wg.Add(1)
	go r.run()
}

func (r *Relay) run() {
	defer r.wg.Done()
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-r.stopCh:
			slog.Info("Outbox Relay received stop signal, shutting down")
			return
		case <-ticker.C:
			r.processPendingBatch()
		}
	}
}

func (r *Relay) processPendingBatch() {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pending, err := r.repo.FetchPending(ctx, 50)
	if err != nil {
		slog.Error("Outbox Relay failed to fetch pending events", "error", err)
		return
	}

	if len(pending) == 0 {
		return
	}

	for _, event := range pending {
		topic := event.Topic
		if topic == "" {
			topic = r.defaultTopic
		}

		msg := kafka.Message{
			Topic: topic,
			Key:   []byte(event.AggregateID),
			Value: event.Payload,
			Time:  event.CreatedAt,
			Headers: []kafka.Header{
				{Key: "event_type", Value: []byte(event.EventType)},
				{Key: "aggregate_type", Value: []byte(event.AggregateType)},
				{Key: "event_id", Value: []byte(event.ID.String())},
			},
		}

		err := r.writer.WriteMessages(ctx, msg)
		if err != nil {
			slog.Error("Failed to publish event to Redpanda/Kafka",
				"event_id", event.ID,
				"topic", topic,
				"event_type", event.EventType,
				"error", err,
			)
			atomic.AddInt64(&r.failedCount, 1)
			_ = r.repo.MarkFailed(ctx, event.ID, err.Error())
		} else {
			slog.Debug("Successfully published outbox event",
				"event_id", event.ID,
				"topic", topic,
				"event_type", event.EventType,
			)
			atomic.AddInt64(&r.publishedCount, 1)
			_ = r.repo.MarkPublished(ctx, event.ID)
		}
	}
}

func (r *Relay) Stop() {
	if !r.enabled || r.writer == nil {
		return
	}

	close(r.stopCh)
	r.wg.Wait()

	if err := r.writer.Close(); err != nil {
		slog.Error("Error closing Outbox Relay Kafka writer", "error", err)
	} else {
		slog.Info("Outbox Relay Kafka writer closed cleanly")
	}
}

func (r *Relay) Stats(ctx context.Context) RelayStats {
	var pending int64
	if r.repo != nil {
		pending, _ = r.repo.CountPending(ctx)
	}

	return RelayStats{
		PublishedEvents: atomic.LoadInt64(&r.publishedCount),
		FailedEvents:    atomic.LoadInt64(&r.failedCount),
		PendingEvents:   pending,
		IsConnected:     r.enabled && r.writer != nil,
	}
}
