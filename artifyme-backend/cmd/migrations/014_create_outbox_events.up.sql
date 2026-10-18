-- 014_create_outbox_events.up.sql
-- Transactional Outbox Pattern for reliable event-driven messaging

CREATE TABLE IF NOT EXISTS outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_type VARCHAR(64) NOT NULL,
    aggregate_id VARCHAR(128) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    topic VARCHAR(128) NOT NULL DEFAULT 'artifyme.events',
    payload JSONB NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    retry_count INT NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ
);

-- Partial index for high-speed Outbox Relay polling of unpublished events
CREATE INDEX IF NOT EXISTS idx_outbox_events_pending 
ON outbox_events (created_at ASC) 
WHERE status = 'PENDING';

-- Index for auditing by aggregate entity
CREATE INDEX IF NOT EXISTS idx_outbox_events_aggregate 
ON outbox_events (aggregate_type, aggregate_id);
