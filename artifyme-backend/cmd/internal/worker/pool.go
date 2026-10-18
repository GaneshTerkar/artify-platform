package worker

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"sync/atomic"
	"time"
)

type Job struct {
	Name    string
	Handler func(ctx context.Context) error
}

type Stats struct {
	Workers       int   `json:"workers"`
	QueueCapacity int   `json:"queue_capacity"`
	QueuedJobs    int   `json:"queued_jobs"`
	CompletedJobs int64 `json:"completed_jobs"`
	FailedJobs    int64 `json:"failed_jobs"`
}

type Pool struct {
	workerCount   int
	queueCapacity int
	jobQueue      chan Job
	wg            sync.WaitGroup
	ctx           context.Context
	cancel        context.CancelFunc

	completedJobs atomic.Int64
	failedJobs    atomic.Int64
}

// NewPool creates an asynchronous worker pool with bounded capacity.
func NewPool(workerCount, queueCapacity int) *Pool {
	if workerCount <= 0 {
		workerCount = 4
	}
	if queueCapacity <= 0 {
		queueCapacity = 100
	}

	ctx, cancel := context.WithCancel(context.Background())
	return &Pool{
		workerCount:   workerCount,
		queueCapacity: queueCapacity,
		jobQueue:      make(chan Job, queueCapacity),
		ctx:           ctx,
		cancel:        cancel,
	}
}

// Start begins processing jobs with background worker goroutines.
func (p *Pool) Start() {
	slog.Info("Starting asynchronous worker pool", "workers", p.workerCount, "queue_capacity", p.queueCapacity)
	for i := 1; i <= p.workerCount; i++ {
		p.wg.Add(1)
		go p.worker(i)
	}
}

func (p *Pool) worker(id int) {
	defer p.wg.Done()
	slog.Debug("Worker started", "worker_id", id)

	for {
		select {
		case <-p.ctx.Done():
			slog.Debug("Worker stopping due to shutdown", "worker_id", id)
			return
		case job, ok := <-p.jobQueue:
			if !ok {
				slog.Debug("Job queue drained and closed, worker exiting", "worker_id", id)
				return
			}

			start := time.Now()
			slog.Info("Worker picked up job", "worker_id", id, "job", job.Name)

			jobCtx, jobCancel := context.WithTimeout(p.ctx, 3*time.Minute)
			err := job.Handler(jobCtx)
			jobCancel()

			duration := time.Since(start)
			if err != nil {
				p.failedJobs.Add(1)
				slog.Error("Worker job failed", "worker_id", id, "job", job.Name, "duration", duration, "error", err)
			} else {
				p.completedJobs.Add(1)
				slog.Info("Worker job completed successfully", "worker_id", id, "job", job.Name, "duration", duration)
			}
		}
	}
}

// Enqueue submits a job for asynchronous execution without blocking HTTP threads.
// If the bounded queue is saturated, it logs a warning and returns false.
func (p *Pool) Enqueue(job Job) bool {
	select {
	case p.jobQueue <- job:
		slog.Debug("Job enqueued successfully", "job", job.Name, "queued_now", len(p.jobQueue))
		return true
	default:
		slog.Warn("Worker queue is full! Backpressure triggered", "job", job.Name)
		return false
	}
}

// Stats returns live metrics of the worker pool.
func (p *Pool) Stats() Stats {
	return Stats{
		Workers:       p.workerCount,
		QueueCapacity: p.queueCapacity,
		QueuedJobs:    len(p.jobQueue),
		CompletedJobs: p.completedJobs.Load(),
		FailedJobs:    p.failedJobs.Load(),
	}
}

// Stop gracefully waits for in-flight jobs to complete and closes worker threads.
func (p *Pool) Stop() {
	slog.Info("Worker pool shutting down, draining queue...")
	close(p.jobQueue)
	p.wg.Wait()
	p.cancel()
	slog.Info("Worker pool stopped cleanly")
}

func (p *Pool) String() string {
	stats := p.Stats()
	return fmt.Sprintf("WorkerPool[workers=%d, queued=%d, completed=%d, failed=%d]",
		stats.Workers, stats.QueuedJobs, stats.CompletedJobs, stats.FailedJobs)
}
