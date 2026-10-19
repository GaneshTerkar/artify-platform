package reviews

import (
	"context"
	"errors"
	"fmt"
	"math"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	if pool == nil {
		panic("reviews.NewRepository: pool is nil")
	}
	return &Repository{pool: pool}
}

func (r *Repository) CreateReview(ctx context.Context, customerID uuid.UUID, in CreateReviewInput) (*Review, error) {
	// Verify order ownership and completion status
	var artistID *uuid.UUID
	var status string
	err := r.pool.QueryRow(ctx, `
		SELECT artist_id, status::text 
		FROM orders 
		WHERE order_id = $1 AND user_id = $2
	`, in.OrderID, customerID).Scan(&artistID, &status)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("order not found or not owned by you")
		}
		return nil, err
	}

	if status != "COMPLETED" && status != "DELIVERED" && status != "PUBLISHED" {
		return nil, errors.New("reviews can only be submitted for completed or delivered orders")
	}

	var rev Review
	err = r.pool.QueryRow(ctx, `
		INSERT INTO reviews (
			order_id, customer_id, artist_id, rating, title, comment, unboxing_photo_url, is_featured, is_approved, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, TRUE, NOW(), NOW())
		RETURNING review_id, order_id, customer_id, artist_id, rating, title, comment, unboxing_photo_url, is_featured, is_approved, admin_notes, created_at, updated_at
	`, in.OrderID, customerID, artistID, in.Rating, in.Title, in.Comment, in.UnboxingPhotoURL).Scan(
		&rev.ReviewID, &rev.OrderID, &rev.CustomerID, &rev.ArtistID,
		&rev.Rating, &rev.Title, &rev.Comment, &rev.UnboxingPhotoURL,
		&rev.IsFeatured, &rev.IsApproved, &rev.AdminNotes,
		&rev.CreatedAt, &rev.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create review: %w", err)
	}

	return r.GetReviewByID(ctx, rev.ReviewID)
}

func (r *Repository) GetReviewByID(ctx context.Context, reviewID uuid.UUID) (*Review, error) {
	var rev Review
	err := r.pool.QueryRow(ctx, `
		SELECT 
			r.review_id, r.order_id, r.customer_id, COALESCE(u_cust.full_name, 'Verified Customer'),
			r.artist_id, COALESCE(u_art.full_name, 'Master Artist'),
			COALESCE(o.painting_category::text, ''), COALESCE(o.final_image_url, ''),
			r.rating, r.title, r.comment, r.unboxing_photo_url, r.is_featured, r.is_approved, r.admin_notes,
			r.created_at, r.updated_at
		FROM reviews r
		LEFT JOIN users u_cust ON r.customer_id = u_cust.user_id
		LEFT JOIN users u_art ON r.artist_id = u_art.user_id
		LEFT JOIN orders o ON r.order_id = o.order_id
		WHERE r.review_id = $1
	`, reviewID).Scan(
		&rev.ReviewID, &rev.OrderID, &rev.CustomerID, &rev.CustomerName,
		&rev.ArtistID, &rev.ArtistName,
		&rev.PaintingCategory, &rev.FinalImageURL,
		&rev.Rating, &rev.Title, &rev.Comment, &rev.UnboxingPhotoURL,
		&rev.IsFeatured, &rev.IsApproved, &rev.AdminNotes,
		&rev.CreatedAt, &rev.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("review not found")
		}
		return nil, err
	}
	return &rev, nil
}

func (r *Repository) GetReviewByOrderID(ctx context.Context, orderID uuid.UUID) (*Review, error) {
	var rev Review
	err := r.pool.QueryRow(ctx, `
		SELECT 
			r.review_id, r.order_id, r.customer_id, COALESCE(u_cust.full_name, 'Verified Customer'),
			r.artist_id, COALESCE(u_art.full_name, 'Master Artist'),
			COALESCE(o.painting_category::text, ''), COALESCE(o.final_image_url, ''),
			r.rating, r.title, r.comment, r.unboxing_photo_url, r.is_featured, r.is_approved, r.admin_notes,
			r.created_at, r.updated_at
		FROM reviews r
		LEFT JOIN users u_cust ON r.customer_id = u_cust.user_id
		LEFT JOIN users u_art ON r.artist_id = u_art.user_id
		LEFT JOIN orders o ON r.order_id = o.order_id
		WHERE r.order_id = $1
	`, orderID).Scan(
		&rev.ReviewID, &rev.OrderID, &rev.CustomerID, &rev.CustomerName,
		&rev.ArtistID, &rev.ArtistName,
		&rev.PaintingCategory, &rev.FinalImageURL,
		&rev.Rating, &rev.Title, &rev.Comment, &rev.UnboxingPhotoURL,
		&rev.IsFeatured, &rev.IsApproved, &rev.AdminNotes,
		&rev.CreatedAt, &rev.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil // No review yet for this order
		}
		return nil, err
	}
	return &rev, nil
}

func (r *Repository) ListPublicReviews(ctx context.Context, limit int) ([]Review, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	rows, err := r.pool.Query(ctx, `
		SELECT 
			r.review_id, r.order_id, r.customer_id, COALESCE(u_cust.full_name, 'Verified Customer'),
			r.artist_id, COALESCE(u_art.full_name, 'Master Artist'),
			COALESCE(o.painting_category::text, ''), COALESCE(o.final_image_url, ''),
			r.rating, r.title, r.comment, r.unboxing_photo_url, r.is_featured, r.is_approved, r.admin_notes,
			r.created_at, r.updated_at
		FROM reviews r
		LEFT JOIN users u_cust ON r.customer_id = u_cust.user_id
		LEFT JOIN users u_art ON r.artist_id = u_art.user_id
		LEFT JOIN orders o ON r.order_id = o.order_id
		WHERE r.is_approved = TRUE
		ORDER BY r.is_featured DESC, r.rating DESC, r.created_at DESC
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []Review
	for rows.Next() {
		var rev Review
		if err := rows.Scan(
			&rev.ReviewID, &rev.OrderID, &rev.CustomerID, &rev.CustomerName,
			&rev.ArtistID, &rev.ArtistName,
			&rev.PaintingCategory, &rev.FinalImageURL,
			&rev.Rating, &rev.Title, &rev.Comment, &rev.UnboxingPhotoURL,
			&rev.IsFeatured, &rev.IsApproved, &rev.AdminNotes,
			&rev.CreatedAt, &rev.UpdatedAt,
		); err != nil {
			return nil, err
		}
		list = append(list, rev)
	}
	if list == nil {
		list = []Review{}
	}
	return list, rows.Err()
}

func (r *Repository) ListAdminReviews(ctx context.Context, minRating, maxRating *int, isFeatured, isApproved *bool) ([]Review, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT 
			r.review_id, r.order_id, r.customer_id, COALESCE(u_cust.full_name, 'Verified Customer'),
			r.artist_id, COALESCE(u_art.full_name, 'Master Artist'),
			COALESCE(o.painting_category::text, ''), COALESCE(o.final_image_url, ''),
			r.rating, r.title, r.comment, r.unboxing_photo_url, r.is_featured, r.is_approved, r.admin_notes,
			r.created_at, r.updated_at
		FROM reviews r
		LEFT JOIN users u_cust ON r.customer_id = u_cust.user_id
		LEFT JOIN users u_art ON r.artist_id = u_art.user_id
		LEFT JOIN orders o ON r.order_id = o.order_id
		WHERE ($1::int IS NULL OR r.rating >= $1)
		  AND ($2::int IS NULL OR r.rating <= $2)
		  AND ($3::boolean IS NULL OR r.is_featured = $3)
		  AND ($4::boolean IS NULL OR r.is_approved = $4)
		ORDER BY r.created_at DESC
	`, minRating, maxRating, isFeatured, isApproved)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []Review
	for rows.Next() {
		var rev Review
		if err := rows.Scan(
			&rev.ReviewID, &rev.OrderID, &rev.CustomerID, &rev.CustomerName,
			&rev.ArtistID, &rev.ArtistName,
			&rev.PaintingCategory, &rev.FinalImageURL,
			&rev.Rating, &rev.Title, &rev.Comment, &rev.UnboxingPhotoURL,
			&rev.IsFeatured, &rev.IsApproved, &rev.AdminNotes,
			&rev.CreatedAt, &rev.UpdatedAt,
		); err != nil {
			return nil, err
		}
		list = append(list, rev)
	}
	if list == nil {
		list = []Review{}
	}
	return list, rows.Err()
}

func (r *Repository) ModerateReview(ctx context.Context, reviewID uuid.UUID, in ModerateReviewInput) (*Review, error) {
	_, err := r.pool.Exec(ctx, `
		UPDATE reviews SET
			is_featured = CASE WHEN $2::boolean THEN $3 ELSE is_featured END,
			is_approved = CASE WHEN $4::boolean THEN $5 ELSE is_approved END,
			admin_notes = CASE WHEN $6::boolean THEN $7 ELSE admin_notes END,
			updated_at = NOW()
		WHERE review_id = $1
	`, reviewID,
		in.IsFeatured != nil, in.IsFeatured != nil && *in.IsFeatured,
		in.IsApproved != nil, in.IsApproved != nil && *in.IsApproved,
		in.AdminNotes != nil, in.AdminNotes,
	)
	if err != nil {
		return nil, err
	}
	return r.GetReviewByID(ctx, reviewID)
}

func (r *Repository) GetReviewStats(ctx context.Context) (*ReviewStats, error) {
	stats := &ReviewStats{
		RatingDistribution: map[string]int{
			"5": 0, "4": 0, "3": 0, "2": 0, "1": 0,
		},
		ArtistLeaderboard: []ArtistRating{},
	}

	var total int
	var avgRating *float64
	var csatCount int
	var alertCount int
	err := r.pool.QueryRow(ctx, `
		SELECT 
			COUNT(*),
			AVG(rating),
			COUNT(*) FILTER (WHERE rating >= 4),
			COUNT(*) FILTER (WHERE rating <= 3)
		FROM reviews
		WHERE is_approved = TRUE
	`).Scan(&total, &avgRating, &csatCount, &alertCount)
	if err != nil {
		return nil, err
	}

	stats.TotalReviews = total
	if avgRating != nil {
		stats.AverageRating = math.Round(*avgRating*10) / 10
	}
	if total > 0 {
		stats.CSATScorePercent = math.Round(float64(csatCount)/float64(total)*1000) / 10
	}
	stats.QualityAlertsCount = alertCount

	// Rating distribution
	distRows, err := r.pool.Query(ctx, `
		SELECT rating, COUNT(*)
		FROM reviews
		WHERE is_approved = TRUE
		GROUP BY rating
	`)
	if err == nil {
		defer distRows.Close()
		for distRows.Next() {
			var star int
			var cnt int
			if err := distRows.Scan(&star, &cnt); err == nil {
				stats.RatingDistribution[fmt.Sprintf("%d", star)] = cnt
			}
		}
	}

	// Artist Leaderboard
	leadRows, err := r.pool.Query(ctx, `
		SELECT 
			u.user_id,
			COALESCE(u.full_name, 'Artist'),
			COUNT(r.review_id) as total_revs,
			ROUND(AVG(r.rating)::numeric, 1) as avg_rating
		FROM reviews r
		INNER JOIN users u ON r.artist_id = u.user_id
		WHERE r.is_approved = TRUE
		GROUP BY u.user_id, u.full_name
		ORDER BY avg_rating DESC, total_revs DESC
		LIMIT 10
	`)
	if err == nil {
		defer leadRows.Close()
		for leadRows.Next() {
			var item ArtistRating
			if err := leadRows.Scan(&item.ArtistID, &item.ArtistName, &item.TotalReviews, &item.AverageRating); err == nil {
				stats.ArtistLeaderboard = append(stats.ArtistLeaderboard, item)
			}
		}
	}

	return stats, nil
}
