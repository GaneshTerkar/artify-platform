package orders

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	if pool == nil {
		panic("orders.NewRepository: pool is nil")
	}
	return &Repository{pool: pool}
}

type CreateOrderInput struct {
	UserID            uuid.UUID
	PaintingCategory  string
	ReferenceImageURL string
	Size              string
	PersonsIncluded   string
	DeliveryAddress   string
	CustomerNotes     *string
}

func (r *Repository) Create(ctx context.Context, in CreateOrderInput) (*Order, error) {
	var o Order
	var artistID *uuid.UUID
	var finalURL *string
	var notes *string

	err := r.pool.QueryRow(ctx, `
		INSERT INTO orders (
			user_id,
			painting_category,
			reference_image_url,
			size,
			persons_included,
			delivery_address,
			customer_notes,
			status,
			created_at,
			updated_at,
			updated_by
		) VALUES ($1, $2::painting_category, $3, $4::painting_size, $5::person_included, $6, $7, 'PLACED', NOW(), NOW(), $1)
		RETURNING
			order_id, user_id, artist_id, painting_category::text, reference_image_url,
			final_image_url, size::text, persons_included::text, status::text,
			delivery_address, total_price, customer_notes,
			COALESCE(created_at, NOW()), COALESCE(updated_at, NOW()), updated_by
	`, in.UserID, in.PaintingCategory, in.ReferenceImageURL, in.Size, in.PersonsIncluded,
		in.DeliveryAddress, in.CustomerNotes).Scan(
		&o.OrderID, &o.UserID, &artistID, &o.PaintingCategory, &o.ReferenceImageURL,
		&finalURL, &o.Size, &o.PersonsIncluded, &o.Status, &o.DeliveryAddress,
		&o.TotalPrice, &notes, &o.CreatedAt, &o.UpdatedAt, &o.UpdatedBy,
	)
	if err != nil {
		return nil, fmt.Errorf("create order: %w", err)
	}
	o.ArtistID = artistID
	o.FinalImageURL = finalURL
	o.CustomerNotes = notes
	return &o, nil
}

func (r *Repository) GetByID(ctx context.Context, orderID uuid.UUID) (*Order, error) {
	return r.scanOrder(r.pool.QueryRow(ctx, `
		SELECT
			order_id, user_id, artist_id, painting_category::text, reference_image_url,
			final_image_url, size::text, persons_included::text, status::text,
			delivery_address, total_price, customer_notes,
			COALESCE(created_at, NOW()), COALESCE(updated_at, NOW()), updated_by
		FROM orders WHERE order_id = $1
	`, orderID))
}

func (r *Repository) ListByUser(ctx context.Context, userID uuid.UUID) ([]Order, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT
			order_id, user_id, artist_id, painting_category::text, reference_image_url,
			final_image_url, size::text, persons_included::text, status::text,
			delivery_address, total_price, customer_notes,
			COALESCE(created_at, NOW()), COALESCE(updated_at, NOW()), updated_by
		FROM orders WHERE user_id = $1 ORDER BY created_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []Order
	for rows.Next() {
		o, err := scanOrderRow(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, *o)
	}
	return list, rows.Err()
}

func (r *Repository) ListAll(ctx context.Context, status *string) ([]Order, error) {
	var rows pgx.Rows
	var err error
	if status != nil && *status != "" {
		rows, err = r.pool.Query(ctx, `
			SELECT
				order_id, user_id, artist_id, painting_category::text, reference_image_url,
				final_image_url, size::text, persons_included::text, status::text,
				delivery_address, total_price, customer_notes,
				COALESCE(created_at, NOW()), COALESCE(updated_at, NOW()), updated_by
			FROM orders WHERE status = $1::order_status ORDER BY created_at DESC
		`, *status)
	} else {
		rows, err = r.pool.Query(ctx, `
			SELECT
				order_id, user_id, artist_id, painting_category::text, reference_image_url,
				final_image_url, size::text, persons_included::text, status::text,
				delivery_address, total_price, customer_notes,
				COALESCE(created_at, NOW()), COALESCE(updated_at, NOW()), updated_by
			FROM orders ORDER BY created_at DESC
		`)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []Order
	for rows.Next() {
		o, err := scanOrderRow(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, *o)
	}
	return list, rows.Err()
}

func (r *Repository) UpdateDraft(ctx context.Context, orderID, userID uuid.UUID, fields map[string]interface{}) (*Order, error) {
	// Only allow updates while PLACED and owned by user.
	o, err := r.GetByID(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if o.UserID != userID {
		return nil, ErrForbidden
	}
	if o.Status != StatusPlaced {
		return nil, ErrInvalidTransition
	}

	category, _ := fields["painting_category"].(string)
	size, _ := fields["size"].(string)
	persons, _ := fields["persons_included"].(string)
	refURL, _ := fields["reference_image_url"].(string)
	address, _ := fields["delivery_address"].(string)
	var notes *string
	if n, ok := fields["customer_notes"].(string); ok {
		notes = &n
	}

	return r.scanOrder(r.pool.QueryRow(ctx, `
		UPDATE orders SET
			painting_category = COALESCE(NULLIF($3, ''), painting_category),
			size = COALESCE(NULLIF($4, '')::painting_size, size),
			persons_included = COALESCE(NULLIF($5, '')::person_included, persons_included),
			reference_image_url = COALESCE(NULLIF($6, ''), reference_image_url),
			delivery_address = COALESCE(NULLIF($7, ''), delivery_address),
			customer_notes = COALESCE($8, customer_notes),
			updated_at = NOW(),
			updated_by = $2
		WHERE order_id = $1 AND user_id = $2 AND status = 'PLACED'
		RETURNING
			order_id, user_id, artist_id, painting_category::text, reference_image_url,
			final_image_url, size::text, persons_included::text, status::text,
			delivery_address, total_price, customer_notes,
			COALESCE(created_at, NOW()), COALESCE(updated_at, NOW()), updated_by
	`, orderID, userID, category, size, persons, refURL, address, notes))
}

func (r *Repository) UpdateStatus(ctx context.Context, orderID uuid.UUID, newStatus OrderStatus, updatedBy uuid.UUID, artistID *uuid.UUID, finalURL *string) (*Order, error) {
	return r.scanOrder(r.pool.QueryRow(ctx, `
		UPDATE orders SET
			status = $2::order_status,
			artist_id = COALESCE($3, artist_id),
			final_image_url = COALESCE($4, final_image_url),
			updated_at = NOW(),
			updated_by = $5
		WHERE order_id = $1
		RETURNING
			order_id, user_id, artist_id, painting_category::text, reference_image_url,
			final_image_url, size::text, persons_included::text, status::text,
			delivery_address, total_price, customer_notes,
			COALESCE(created_at, NOW()), COALESCE(updated_at, NOW()), updated_by
	`, orderID, string(newStatus), artistID, finalURL, updatedBy))
}

func (r *Repository) StatusHistory(ctx context.Context, orderID uuid.UUID) ([]StatusHistoryEntry, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, order_id, old_status::text, new_status::text, changed_by, note, created_at
		FROM order_status_history WHERE order_id = $1 ORDER BY created_at ASC
	`, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []StatusHistoryEntry
	for rows.Next() {
		var e StatusHistoryEntry
		if err := rows.Scan(&e.ID, &e.OrderID, &e.OldStatus, &e.NewStatus, &e.ChangedBy, &e.Note, &e.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, e)
	}
	return list, rows.Err()
}

func (r *Repository) InsertPayment(ctx context.Context, orderID uuid.UUID, sessionID string, amount float64, currency string) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO payments (order_id, stripe_session_id, status, amount, currency)
		VALUES ($1, $2, 'pending', $3, $4)
		ON CONFLICT (stripe_session_id) DO NOTHING
	`, orderID, sessionID, amount, currency)
	return err
}

func (r *Repository) MarkPaymentPaid(ctx context.Context, sessionID string) (uuid.UUID, error) {
	var orderID uuid.UUID
	err := r.pool.QueryRow(ctx, `
		UPDATE payments SET status = 'paid', updated_at = NOW()
		WHERE stripe_session_id = $1
		RETURNING order_id
	`, sessionID).Scan(&orderID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return uuid.Nil, ErrPaymentNotFound
		}
		return uuid.Nil, err
	}
	return orderID, nil
}

func (r *Repository) scanOrder(row pgx.Row) (*Order, error) {
	var o Order
	var artistID *uuid.UUID
	var finalURL *string
	var notes *string
	err := row.Scan(
		&o.OrderID, &o.UserID, &artistID, &o.PaintingCategory, &o.ReferenceImageURL,
		&finalURL, &o.Size, &o.PersonsIncluded, &o.Status, &o.DeliveryAddress,
		&o.TotalPrice, &notes, &o.CreatedAt, &o.UpdatedAt, &o.UpdatedBy,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	o.ArtistID = artistID
	o.FinalImageURL = finalURL
	o.CustomerNotes = notes
	return &o, nil
}

type scannable interface {
	Scan(dest ...any) error
}

func scanOrderRow(row scannable) (*Order, error) {
	var o Order
	var artistID *uuid.UUID
	var finalURL *string
	var notes *string
	err := row.Scan(
		&o.OrderID, &o.UserID, &artistID, &o.PaintingCategory, &o.ReferenceImageURL,
		&finalURL, &o.Size, &o.PersonsIncluded, &o.Status, &o.DeliveryAddress,
		&o.TotalPrice, &notes, &o.CreatedAt, &o.UpdatedAt, &o.UpdatedBy,
	)
	if err != nil {
		return nil, err
	}
	o.ArtistID = artistID
	o.FinalImageURL = finalURL
	o.CustomerNotes = notes
	return &o, nil
}

func (r *Repository) ListGalleryPaintings(ctx context.Context, category string) ([]PaintingItem, error) {
	category = strings.ToUpper(strings.TrimSpace(category))
	var catParam *string
	if category != "" && category != "ALL" {
		catParam = &category
	}

	query := `
		SELECT 
			g.id,
			g.title,
			g.category,
			g.description,
			g.image_url,
			g.artist_name,
			g.source,
			g.created_at
		FROM (
			SELECT DISTINCT ON (sub.image_url)
				sub.id,
				sub.title,
				sub.category,
				sub.description,
				sub.image_url,
				sub.artist_name,
				sub.source,
				sub.created_at
			FROM (
				SELECT 
					o.order_id::text AS id,
					CONCAT('Commissioned ', INITCAP(o.painting_category::text), ' Portrait') AS title,
					o.painting_category::text AS category,
					COALESCE(NULLIF(o.customer_notes, ''), 'Custom commissioned artwork completed for customer.') AS description,
					o.final_image_url AS image_url,
					COALESCE(u.full_name, 'Ganesh Artist') AS artist_name,
					'COMPLETED_ORDER' AS source,
					COALESCE(o.updated_at, o.created_at, NOW()) AS created_at
				FROM orders o
				INNER JOIN artist_profiles ap ON o.artist_id = ap.artist_id
				LEFT JOIN users u ON o.artist_id = u.user_id
				WHERE o.status = 'COMPLETED' 
				  AND o.final_image_url IS NOT NULL 
				  AND TRIM(o.final_image_url) != ''
				  AND ap.verified = TRUE

				UNION ALL

				SELECT 
					ap.painting_id::text AS id,
					ap.title AS title,
					ap.category::text AS category,
					COALESCE(ap.description, '') AS description,
					ap.image_url AS image_url,
					COALESCE(u.full_name, 'Ganesh Artist') AS artist_name,
					'SHOWCASE' AS source,
					COALESCE(ap.created_at, NOW()) AS created_at
				FROM artist_paintings ap
				INNER JOIN artist_profiles apf ON ap.artist_id = apf.artist_id
				LEFT JOIN users u ON ap.artist_id = u.user_id
				WHERE apf.verified = TRUE
			) sub
			ORDER BY sub.image_url, sub.source ASC, sub.created_at DESC
		) g
		WHERE ($1::text IS NULL OR g.category = $1)
		ORDER BY g.created_at DESC;
	`

	rows, err := r.pool.Query(ctx, query, catParam)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []PaintingItem
	for rows.Next() {
		var p PaintingItem
		if err := rows.Scan(
			&p.ID,
			&p.Title,
			&p.Category,
			&p.Description,
			&p.ImageURL,
			&p.ArtistName,
			&p.Source,
			&p.CreatedAt,
		); err != nil {
			return nil, err
		}
		p.CategoryLabel = CategoryLabel(p.Category)
		p.StartingPrice = CategoryStartingPrice(p.Category)
		list = append(list, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(list) == 0 && (catParam == nil || *catParam == "") {
		return FallbackGalleryPaintings(category), nil
	}
	return list, nil
}

func (r *Repository) IsArtistVerified(ctx context.Context, artistID uuid.UUID) (bool, error) {
	var verified bool
	err := r.pool.QueryRow(ctx, `
		SELECT COALESCE(ap.verified, FALSE)
		FROM artist_profiles ap
		INNER JOIN users u ON ap.artist_id = u.user_id
		WHERE ap.artist_id = $1 AND u.role = 'ARTIST'
	`, artistID).Scan(&verified)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil
		}
		return false, err
	}
	return verified, nil
}

func (r *Repository) ListVerifiedArtists(ctx context.Context) ([]VerifiedArtist, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT 
			u.user_id,
			u.full_name,
			u.email,
			COALESCE(ap.experience_years, 0),
			COALESCE(ap.bio, '')
		FROM artist_profiles ap
		INNER JOIN users u ON ap.artist_id = u.user_id
		WHERE ap.verified = TRUE AND u.role = 'ARTIST'
		ORDER BY u.full_name ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []VerifiedArtist
	for rows.Next() {
		var a VerifiedArtist
		if err := rows.Scan(&a.ArtistID, &a.FullName, &a.Email, &a.ExperienceYears, &a.Bio); err != nil {
			return nil, err
		}
		list = append(list, a)
	}
	return list, rows.Err()
}

func (r *Repository) AssignArtist(ctx context.Context, orderID uuid.UUID, artistID uuid.UUID, updatedBy uuid.UUID, newStatus OrderStatus) (*Order, error) {
	return r.scanOrder(r.pool.QueryRow(ctx, `
		UPDATE orders SET
			artist_id = $2,
			status = $3::order_status,
			updated_at = NOW(),
			updated_by = $4
		WHERE order_id = $1
		RETURNING
			order_id, user_id, artist_id, painting_category::text, reference_image_url,
			final_image_url, size::text, persons_included::text, status::text,
			delivery_address, total_price, customer_notes,
			COALESCE(created_at, NOW()), COALESCE(updated_at, NOW()), updated_by
	`, orderID, artistID, string(newStatus), updatedBy))
}


