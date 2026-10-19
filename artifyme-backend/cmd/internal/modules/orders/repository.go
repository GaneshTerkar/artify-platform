package orders

import (
	"context"
	"errors"
	"strings"
	"time"

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

const orderColumns = `
	order_id, user_id, artist_id, delivery_agent_id, painting_category::text, reference_image_url,
	final_image_url, collage_image_url, original_final_image_url, is_published_to_gallery,
	size::text, persons_included::text, status::text,
	delivery_address, COALESCE(delivery_attempts, 0), delivery_failure_reason, last_delivery_attempt_at, total_price, customer_notes,
	courier_partner, tracking_number, estimated_delivery_at, admin_dispatch_notes,
	COALESCE(created_at, NOW()), COALESCE(updated_at, NOW()), updated_by, COALESCE(version, 1)
`

type CreateOrderInput struct {
	UserID            uuid.UUID
	PaintingCategory  string
	ReferenceImageURL string
	Size              string
	PersonsIncluded   string
	DeliveryAddress   string
	CustomerNotes     *string
}

func (r *Repository) scanAndEnrichOrder(ctx context.Context, row pgx.Row) (*Order, error) {
	o, err := r.scanOrder(row)
	if err != nil {
		return nil, err
	}
	_ = r.enrichOrders(ctx, []*Order{o})
	return o, nil
}

func (r *Repository) enrichOrders(ctx context.Context, orders []*Order) error {
	if len(orders) == 0 {
		return nil
	}

	idMap := make(map[uuid.UUID]bool)
	for _, o := range orders {
		if o == nil {
			continue
		}
		if o.UserID != uuid.Nil {
			idMap[o.UserID] = true
		}
		if o.ArtistID != nil && *o.ArtistID != uuid.Nil {
			idMap[*o.ArtistID] = true
		}
		if o.DeliveryAgentID != nil && *o.DeliveryAgentID != uuid.Nil {
			idMap[*o.DeliveryAgentID] = true
		}
	}

	if len(idMap) == 0 {
		return nil
	}

	ids := make([]uuid.UUID, 0, len(idMap))
	for id := range idMap {
		ids = append(ids, id)
	}

	rows, err := r.pool.Query(ctx, `
		SELECT user_id, full_name, COALESCE(phone_number, '')
		FROM users
		WHERE user_id = ANY($1)
	`, ids)
	if err != nil {
		return err
	}
	defer rows.Close()

	type userInfo struct {
		name  string
		phone string
	}
	users := make(map[uuid.UUID]userInfo)
	for rows.Next() {
		var uid uuid.UUID
		var u userInfo
		if err := rows.Scan(&uid, &u.name, &u.phone); err == nil {
			users[uid] = u
		}
	}

	for _, o := range orders {
		if o == nil {
			continue
		}
		if u, ok := users[o.UserID]; ok {
			o.CustomerName = u.name
			o.CustomerPhone = u.phone
		}
		if o.ArtistID != nil {
			if u, ok := users[*o.ArtistID]; ok {
				name := u.name
				phone := u.phone
				o.ArtistName = &name
				o.ArtistPhone = &phone
			}
		}
		if o.DeliveryAgentID != nil {
			if u, ok := users[*o.DeliveryAgentID]; ok {
				name := u.name
				phone := u.phone
				o.DeliveryAgentName = &name
				o.DeliveryAgentPhone = &phone
			}
		}
	}

	return nil
}

func (r *Repository) Create(ctx context.Context, in CreateOrderInput) (*Order, error) {
	return r.scanAndEnrichOrder(ctx, r.pool.QueryRow(ctx, `
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
		RETURNING `+orderColumns, in.UserID, in.PaintingCategory, in.ReferenceImageURL, in.Size, in.PersonsIncluded,
		in.DeliveryAddress, in.CustomerNotes))
}

func (r *Repository) GetByID(ctx context.Context, orderID uuid.UUID) (*Order, error) {
	return r.scanAndEnrichOrder(ctx, r.pool.QueryRow(ctx, `
		SELECT `+orderColumns+`
		FROM orders WHERE order_id = $1
	`, orderID))
}

func (r *Repository) ListByUser(ctx context.Context, userID uuid.UUID) ([]Order, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT `+orderColumns+`
		FROM orders WHERE user_id = $1 OR artist_id = $1 OR delivery_agent_id = $1 ORDER BY created_at DESC
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
	if err := rows.Err(); err != nil {
		return nil, err
	}
	ptrs := make([]*Order, len(list))
	for i := range list {
		ptrs[i] = &list[i]
	}
	_ = r.enrichOrders(ctx, ptrs)
	return list, nil
}

func (r *Repository) ListAll(ctx context.Context, status *string) ([]Order, error) {
	var rows pgx.Rows
	var err error
	if status != nil && *status != "" {
		rows, err = r.pool.Query(ctx, `
			SELECT `+orderColumns+`
			FROM orders WHERE status = $1::order_status ORDER BY created_at DESC
		`, *status)
	} else {
		rows, err = r.pool.Query(ctx, `
			SELECT `+orderColumns+`
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
	if err := rows.Err(); err != nil {
		return nil, err
	}
	ptrs := make([]*Order, len(list))
	for i := range list {
		ptrs[i] = &list[i]
	}
	_ = r.enrichOrders(ctx, ptrs)
	return list, nil
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

	return r.scanAndEnrichOrder(ctx, r.pool.QueryRow(ctx, `
		UPDATE orders SET
			painting_category = COALESCE(NULLIF($3, ''), painting_category),
			size = COALESCE(NULLIF($4, '')::painting_size, size),
			persons_included = COALESCE(NULLIF($5, '')::person_included, persons_included),
			reference_image_url = COALESCE(NULLIF($6, ''), reference_image_url),
			delivery_address = COALESCE(NULLIF($7, ''), delivery_address),
			customer_notes = COALESCE($8, customer_notes),
			version = version + 1,
			updated_at = NOW(),
			updated_by = $2
		WHERE order_id = $1 AND user_id = $2 AND status = 'PLACED'
		RETURNING `+orderColumns, orderID, userID, category, size, persons, refURL, address, notes))
}

func (r *Repository) checkConflictOrNotFound(ctx context.Context, orderID uuid.UUID, expectedVersion int, originalErr error) error {
	if errors.Is(originalErr, ErrNotFound) && expectedVersion > 0 {
		var currentVer int
		err := r.pool.QueryRow(ctx, "SELECT COALESCE(version, 1) FROM orders WHERE order_id = $1", orderID).Scan(&currentVer)
		if err == nil {
			return ErrConflict
		}
	}
	return originalErr
}

func (r *Repository) UpdateStatus(ctx context.Context, orderID uuid.UUID, newStatus OrderStatus, updatedBy uuid.UUID, artistID *uuid.UUID, finalURL *string, collageURL *string, expectedVersion ...int) (*Order, error) {
	expVer := 0
	if len(expectedVersion) > 0 && expectedVersion[0] > 0 {
		expVer = expectedVersion[0]
	}

	row := r.pool.QueryRow(ctx, `
		UPDATE orders SET
			status = $2::order_status,
			artist_id = CASE
				WHEN $2::order_status IN ('CONFIRMED', 'PLACED') THEN NULL
				ELSE COALESCE($3, artist_id)
			END,
			final_image_url = COALESCE($4, final_image_url),
			collage_image_url = COALESCE($5, collage_image_url),
			original_final_image_url = CASE 
				WHEN $2::order_status = 'COMPLETED' AND $4 IS NOT NULL AND $4 != '' THEN COALESCE(original_final_image_url, $4)
				ELSE original_final_image_url 
			END,
			version = version + 1,
			updated_at = NOW(),
			updated_by = $6
		WHERE order_id = $1 AND ($7 = 0 OR version = $7)
		RETURNING `+orderColumns, orderID, string(newStatus), artistID, finalURL, collageURL, updatedBy, expVer)

	o, err := r.scanAndEnrichOrder(ctx, row)
	if err != nil {
		return nil, r.checkConflictOrNotFound(ctx, orderID, expVer, err)
	}
	return o, nil
}

func (r *Repository) ConfirmGalleryPublish(ctx context.Context, orderID, adminID uuid.UUID, expectedVersion ...int) (*Order, error) {
	expVer := 0
	if len(expectedVersion) > 0 && expectedVersion[0] > 0 {
		expVer = expectedVersion[0]
	}
	row := r.pool.QueryRow(ctx, `
		UPDATE orders SET
			original_final_image_url = COALESCE(original_final_image_url, final_image_url),
			final_image_url = COALESCE(collage_image_url, final_image_url),
			is_published_to_gallery = TRUE,
			status = 'PUBLISHED'::order_status,
			version = version + 1,
			updated_at = NOW(),
			updated_by = $2
		WHERE order_id = $1 AND (status = 'DELIVERED' OR status = 'COMPLETED' OR status = 'PUBLISHED') AND ($3 = 0 OR version = $3)
		RETURNING `+orderColumns, orderID, adminID, expVer)

	o, err := r.scanAndEnrichOrder(ctx, row)
	if err != nil {
		return nil, r.checkConflictOrNotFound(ctx, orderID, expVer, err)
	}
	return o, nil
}

func (r *Repository) UpdateCollageURL(ctx context.Context, orderID uuid.UUID, collageURL string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE orders SET
			collage_image_url = $2,
			updated_at = NOW()
		WHERE order_id = $1
	`, orderID, collageURL)
	return err
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
	var deliveryAgentID *uuid.UUID
	var finalURL *string
	var collageURL *string
	var origFinalURL *string
	var isPublished bool
	var failureReason *string
	var lastAttempt *time.Time
	var notes *string
	var courierPartner *string
	var trackingNumber *string
	var estimatedDeliveryAt *time.Time
	var adminDispatchNotes *string
	err := row.Scan(
		&o.OrderID, &o.UserID, &artistID, &deliveryAgentID, &o.PaintingCategory, &o.ReferenceImageURL,
		&finalURL, &collageURL, &origFinalURL, &isPublished,
		&o.Size, &o.PersonsIncluded, &o.Status, &o.DeliveryAddress,
		&o.DeliveryAttempts, &failureReason, &lastAttempt,
		&o.TotalPrice, &notes,
		&courierPartner, &trackingNumber, &estimatedDeliveryAt, &adminDispatchNotes,
		&o.CreatedAt, &o.UpdatedAt, &o.UpdatedBy, &o.Version,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	o.ArtistID = artistID
	o.DeliveryAgentID = deliveryAgentID
	o.FinalImageURL = finalURL
	o.CollageImageURL = collageURL
	o.OriginalFinalImageURL = origFinalURL
	o.IsPublishedToGallery = isPublished
	o.DeliveryFailureReason = failureReason
	o.LastDeliveryAttemptAt = lastAttempt
	o.CustomerNotes = notes
	o.CourierPartner = courierPartner
	o.TrackingNumber = trackingNumber
	o.EstimatedDeliveryAt = estimatedDeliveryAt
	o.AdminDispatchNotes = adminDispatchNotes
	return &o, nil
}

type scannable interface {
	Scan(dest ...any) error
}

func scanOrderRow(row scannable) (*Order, error) {
	var o Order
	var artistID *uuid.UUID
	var deliveryAgentID *uuid.UUID
	var finalURL *string
	var collageURL *string
	var origFinalURL *string
	var isPublished bool
	var failureReason *string
	var lastAttempt *time.Time
	var notes *string
	var courierPartner *string
	var trackingNumber *string
	var estimatedDeliveryAt *time.Time
	var adminDispatchNotes *string
	err := row.Scan(
		&o.OrderID, &o.UserID, &artistID, &deliveryAgentID, &o.PaintingCategory, &o.ReferenceImageURL,
		&finalURL, &collageURL, &origFinalURL, &isPublished,
		&o.Size, &o.PersonsIncluded, &o.Status, &o.DeliveryAddress,
		&o.DeliveryAttempts, &failureReason, &lastAttempt,
		&o.TotalPrice, &notes,
		&courierPartner, &trackingNumber, &estimatedDeliveryAt, &adminDispatchNotes,
		&o.CreatedAt, &o.UpdatedAt, &o.UpdatedBy, &o.Version,
	)
	if err != nil {
		return nil, err
	}
	o.ArtistID = artistID
	o.DeliveryAgentID = deliveryAgentID
	o.FinalImageURL = finalURL
	o.CollageImageURL = collageURL
	o.OriginalFinalImageURL = origFinalURL
	o.IsPublishedToGallery = isPublished
	o.DeliveryFailureReason = failureReason
	o.LastDeliveryAttemptAt = lastAttempt
	o.CustomerNotes = notes
	o.CourierPartner = courierPartner
	o.TrackingNumber = trackingNumber
	o.EstimatedDeliveryAt = estimatedDeliveryAt
	o.AdminDispatchNotes = adminDispatchNotes
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
					COALESCE(o.collage_image_url, o.final_image_url) AS image_url,
					COALESCE(u.full_name, 'Ganesh Artist') AS artist_name,
					'COMPLETED_ORDER' AS source,
					COALESCE(o.updated_at, o.created_at, NOW()) AS created_at
				FROM orders o
				INNER JOIN artist_profiles ap ON o.artist_id = ap.artist_id
				LEFT JOIN users u ON o.artist_id = u.user_id
				WHERE (o.status = 'COMPLETED' OR o.status = 'DELIVERED' OR o.status = 'PUBLISHED')
				  AND o.is_published_to_gallery = TRUE
				  AND o.final_image_url IS NOT NULL 
				  AND TRIM(o.final_image_url) != ''
				  AND (o.reference_image_url IS NULL OR o.final_image_url != o.reference_image_url)
				  AND ap.verified = TRUE
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
	if list == nil {
		list = []PaintingItem{}
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
			COALESCE(u.phone_number, ''),
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
		if err := rows.Scan(&a.ArtistID, &a.FullName, &a.Email, &a.PhoneNumber, &a.ExperienceYears, &a.Bio); err != nil {
			return nil, err
		}
		list = append(list, a)
	}
	return list, rows.Err()
}

func (r *Repository) AssignArtist(ctx context.Context, orderID uuid.UUID, artistID uuid.UUID, updatedBy uuid.UUID, newStatus OrderStatus, expectedVersion ...int) (*Order, error) {
	expVer := 0
	if len(expectedVersion) > 0 && expectedVersion[0] > 0 {
		expVer = expectedVersion[0]
	}
	row := r.pool.QueryRow(ctx, `
		UPDATE orders SET
			artist_id = $2,
			status = $3::order_status,
			version = version + 1,
			updated_at = NOW(),
			updated_by = $4
		WHERE order_id = $1 AND ($5 = 0 OR version = $5)
		RETURNING `+orderColumns, orderID, artistID, string(newStatus), updatedBy, expVer)
	o, err := r.scanAndEnrichOrder(ctx, row)
	if err != nil {
		return nil, r.checkConflictOrNotFound(ctx, orderID, expVer, err)
	}
	return o, nil
}

func (r *Repository) AssignDeliveryAgent(ctx context.Context, orderID uuid.UUID, agentID uuid.UUID, updatedBy uuid.UUID, expectedVersion ...int) (*Order, error) {
	expVer := 0
	if len(expectedVersion) > 0 && expectedVersion[0] > 0 {
		expVer = expectedVersion[0]
	}
	row := r.pool.QueryRow(ctx, `
		UPDATE orders SET
			delivery_agent_id = $2,
			status = 'ASSIGNED_DELIVERY_AGENT'::order_status,
			version = version + 1,
			updated_at = NOW(),
			updated_by = $3
		WHERE order_id = $1 AND ($4 = 0 OR version = $4)
		RETURNING `+orderColumns, orderID, agentID, updatedBy, expVer)
	o, err := r.scanAndEnrichOrder(ctx, row)
	if err != nil {
		return nil, r.checkConflictOrNotFound(ctx, orderID, expVer, err)
	}
	return o, nil
}

func (r *Repository) UnassignDeliveryAgent(ctx context.Context, orderID uuid.UUID, updatedBy uuid.UUID, expectedVersion ...int) (*Order, error) {
	expVer := 0
	if len(expectedVersion) > 0 && expectedVersion[0] > 0 {
		expVer = expectedVersion[0]
	}
	row := r.pool.QueryRow(ctx, `
		UPDATE orders SET
			delivery_agent_id = NULL,
			status = 'COMPLETED'::order_status,
			version = version + 1,
			updated_at = NOW(),
			updated_by = $2
		WHERE order_id = $1 AND ($3 = 0 OR version = $3)
		RETURNING `+orderColumns, orderID, updatedBy, expVer)
	o, err := r.scanAndEnrichOrder(ctx, row)
	if err != nil {
		return nil, r.checkConflictOrNotFound(ctx, orderID, expVer, err)
	}
	return o, nil
}

func (r *Repository) ListActiveDeliveryAgents(ctx context.Context) ([]ActiveDeliveryAgent, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT 
			user_id,
			full_name,
			email,
			COALESCE(phone_number, ''),
			COALESCE(address, ''),
			status::text
		FROM users
		WHERE role = 'DELIVERY_AGENT' AND status = 'ACTIVE'
		ORDER BY full_name ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []ActiveDeliveryAgent
	for rows.Next() {
		var a ActiveDeliveryAgent
		if err := rows.Scan(&a.UserID, &a.FullName, &a.Email, &a.PhoneNumber, &a.Address, &a.Status); err != nil {
			return nil, err
		}
		list = append(list, a)
	}
	if list == nil {
		list = []ActiveDeliveryAgent{}
	}
	return list, rows.Err()
}

func (r *Repository) UpdateDeliveryStatus(ctx context.Context, orderID uuid.UUID, newStatus OrderStatus, actorID uuid.UUID, failureReason *string, expectedVersion ...int) (*Order, error) {
	expVer := 0
	if len(expectedVersion) > 0 && expectedVersion[0] > 0 {
		expVer = expectedVersion[0]
	}

	var row pgx.Row
	if newStatus == StatusDeliveryFailed {
		reason := "Customer unavailable / delivery attempt unsuccessful"
		if failureReason != nil && *failureReason != "" {
			reason = *failureReason
		}
		row = r.pool.QueryRow(ctx, `
			UPDATE orders SET
				status = $2::order_status,
				delivery_attempts = delivery_attempts + 1,
				delivery_failure_reason = $3,
				last_delivery_attempt_at = NOW(),
				version = version + 1,
				updated_at = NOW(),
				updated_by = $4
			WHERE order_id = $1 AND ($5 = 0 OR version = $5)
			RETURNING `+orderColumns, orderID, string(newStatus), reason, actorID, expVer)
	} else if newStatus == StatusOutForDelivery {
		row = r.pool.QueryRow(ctx, `
			UPDATE orders SET
				status = $2::order_status,
				last_delivery_attempt_at = NOW(),
				version = version + 1,
				updated_at = NOW(),
				updated_by = $3
			WHERE order_id = $1 AND ($4 = 0 OR version = $4)
			RETURNING `+orderColumns, orderID, string(newStatus), actorID, expVer)
	} else {
		row = r.pool.QueryRow(ctx, `
			UPDATE orders SET
				status = $2::order_status,
				version = version + 1,
				updated_at = NOW(),
				updated_by = $3
			WHERE order_id = $1 AND ($4 = 0 OR version = $4)
			RETURNING `+orderColumns, orderID, string(newStatus), actorID, expVer)
	}
	o, err := r.scanAndEnrichOrder(ctx, row)
	if err != nil {
		return nil, r.checkConflictOrNotFound(ctx, orderID, expVer, err)
	}
	return o, nil
}

func (r *Repository) ListAllUsers(ctx context.Context) ([]UserItemDTO, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT 
			u.user_id,
			u.full_name,
			COALESCE(u.user_name, ''),
			u.email,
			COALESCE(u.address, ''),
			COALESCE(u.phone_number, ''),
			u.role::text,
			u.status::text,
			COALESCE(ap.verified, FALSE),
			COALESCE(ap.experience_years, 0),
			COALESCE(ap.bio, ''),
			(SELECT COUNT(*) FROM orders o WHERE o.user_id = u.user_id),
			(SELECT COUNT(*) FROM orders o WHERE o.artist_id = u.user_id),
			COALESCE(u.created_at, NOW())
		FROM users u
		LEFT JOIN artist_profiles ap ON u.user_id = ap.artist_id
		ORDER BY u.created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []UserItemDTO
	for rows.Next() {
		var item UserItemDTO
		var uid uuid.UUID
		if err := rows.Scan(
			&uid,
			&item.FullName,
			&item.UserName,
			&item.Email,
			&item.Address,
			&item.PhoneNumber,
			&item.Role,
			&item.Status,
			&item.IsVerifiedArtist,
			&item.ExperienceYears,
			&item.Bio,
			&item.OrdersCount,
			&item.AssignedOrdersCount,
			&item.CreatedAt,
		); err != nil {
			return nil, err
		}
		item.UserID = uid.String()
		list = append(list, item)
	}
	if list == nil {
		list = []UserItemDTO{}
	}
	return list, rows.Err()
}

func (r *Repository) UpdateUserStatus(ctx context.Context, userID uuid.UUID, status string) error {
	_, err := r.pool.Exec(ctx, `UPDATE users SET status = $1, updated_at = NOW() WHERE user_id = $2`, status, userID)
	return err
}

func (r *Repository) UpdateUserRole(ctx context.Context, userID uuid.UUID, newRole string) error {
	_, err := r.pool.Exec(ctx, `UPDATE users SET role = $1, updated_at = NOW() WHERE user_id = $2`, newRole, userID)
	return err
}

func (r *Repository) GetUserRole(ctx context.Context, userID uuid.UUID) (string, error) {
	var role string
	err := r.pool.QueryRow(ctx, `SELECT role::text FROM users WHERE user_id = $1`, userID).Scan(&role)
	return role, err
}

func (r *Repository) GetArtistCompletedAndStalledCount(ctx context.Context, artistID uuid.UUID) (completed int, stalled int, err error) {
	err = r.pool.QueryRow(ctx, `
		SELECT 
			COUNT(*) FILTER (WHERE status = 'COMPLETED' OR status = 'ASSIGNED_DELIVERY_AGENT' OR status = 'IN_TRANSIT' OR status = 'OUT_FOR_DELIVERY' OR status = 'DELIVERED' OR status = 'PUBLISHED') AS completed_count,
			COUNT(*) FILTER (WHERE status = 'ASSIGNED_ARTIST') AS stalled_count
		FROM orders 
		WHERE artist_id = $1
	`, artistID).Scan(&completed, &stalled)
	return completed, stalled, err
}

func (r *Repository) UpdateLogistics(ctx context.Context, orderID uuid.UUID, courierPartner *string, trackingNumber *string, estimatedDeliveryAt *time.Time, adminDispatchNotes *string, actorID uuid.UUID) (*Order, error) {
	row := r.pool.QueryRow(ctx, `
		UPDATE orders SET
			courier_partner = CASE WHEN $2::boolean THEN $3 ELSE courier_partner END,
			tracking_number = CASE WHEN $4::boolean THEN $5 ELSE tracking_number END,
			estimated_delivery_at = CASE WHEN $6::boolean THEN $7::timestamptz ELSE estimated_delivery_at END,
			admin_dispatch_notes = CASE WHEN $8::boolean THEN $9 ELSE admin_dispatch_notes END,
			version = version + 1,
			updated_at = NOW(),
			updated_by = $10
		WHERE order_id = $1
		RETURNING `+orderColumns,
		orderID,
		courierPartner != nil, courierPartner,
		trackingNumber != nil, trackingNumber,
		estimatedDeliveryAt != nil, estimatedDeliveryAt,
		adminDispatchNotes != nil, adminDispatchNotes,
		actorID,
	)
	return r.scanAndEnrichOrder(ctx, row)
}
