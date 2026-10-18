package events

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository interface {
	RecordEventTx(ctx context.Context, tx pgx.Tx, aggregateType, aggregateID, eventType, topic string, payload interface{}) error
	RecordEvent(ctx context.Context, aggregateType, aggregateID, eventType, topic string, payload interface{}) error
	FetchPending(ctx context.Context, limit int) ([]OutboxEvent, error)
	MarkPublished(ctx context.Context, id uuid.UUID) error
	MarkFailed(ctx context.Context, id uuid.UUID, errMsg string) error
	CountPending(ctx context.Context) (int64, error)
}

type PostgresRepository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *PostgresRepository {
	return &PostgresRepository{pool: pool}
}

func (r *PostgresRepository) RecordEventTx(
	ctx context.Context,
	tx pgx.Tx,
	aggregateType, aggregateID, eventType, topic string,
	payload interface{},
) error {
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	query := `
		INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, topic, payload, status)
		VALUES ($1, $2, $3, $4, $5, 'PENDING')
	`
	_, err = tx.Exec(ctx, query, aggregateType, aggregateID, eventType, topic, payloadBytes)
	return err
}

func (r *PostgresRepository) RecordEvent(
	ctx context.Context,
	aggregateType, aggregateID, eventType, topic string,
	payload interface{},
) error {
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	query := `
		INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, topic, payload, status)
		VALUES ($1, $2, $3, $4, $5, 'PENDING')
	`
	_, err = r.pool.Exec(ctx, query, aggregateType, aggregateID, eventType, topic, payloadBytes)
	return err
}

func (r *PostgresRepository) FetchPending(ctx context.Context, limit int) ([]OutboxEvent, error) {
	if limit <= 0 {
		limit = 50
	}

	query := `
		SELECT id, aggregate_type, aggregate_id, event_type, topic, payload, status, retry_count, last_error, created_at, published_at
		FROM outbox_events
		WHERE status = 'PENDING'
		ORDER BY created_at ASC
		LIMIT $1
	`

	rows, err := r.pool.Query(ctx, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []OutboxEvent
	for rows.Next() {
		var e OutboxEvent
		if err := rows.Scan(
			&e.ID,
			&e.AggregateType,
			&e.AggregateID,
			&e.EventType,
			&e.Topic,
			&e.Payload,
			&e.Status,
			&e.RetryCount,
			&e.LastError,
			&e.CreatedAt,
			&e.PublishedAt,
		); err != nil {
			return nil, err
		}
		events = append(events, e)
	}
	return events, rows.Err()
}

func (r *PostgresRepository) MarkPublished(ctx context.Context, id uuid.UUID) error {
	query := `
		UPDATE outbox_events
		SET status = 'PUBLISHED', published_at = NOW(), last_error = NULL
		WHERE id = $1
	`
	_, err := r.pool.Exec(ctx, query, id)
	return err
}

func (r *PostgresRepository) MarkFailed(ctx context.Context, id uuid.UUID, errMsg string) error {
	query := `
		UPDATE outbox_events
		SET retry_count = retry_count + 1,
		    last_error = $2,
		    status = CASE WHEN retry_count >= 5 THEN 'FAILED' ELSE 'PENDING' END
		WHERE id = $1
	`
	_, err := r.pool.Exec(ctx, query, id, errMsg)
	return err
}

func (r *PostgresRepository) CountPending(ctx context.Context) (int64, error) {
	var count int64
	err := r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM outbox_events WHERE status = 'PENDING'").Scan(&count)
	return count, err
}
