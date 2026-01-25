package artists

import (
	"context"
	"errors"
	"fmt"

	dberrors "github.com/ganeshterkar/artifyme-backend/cmd/internal/errors"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ArtistRepository struct {
	Pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *ArtistRepository {
	if pool == nil {
		panic("pgx pool is nil in auth.NewRepository")
	}
	return &ArtistRepository{
		Pool: pool,
	}
}

func (r *ArtistRepository) AddPainting(
	ctx context.Context,
	artistID uuid.UUID,
	req *AddPaintingRequest,
) (*ArtistPainting, error) {

	if r.Pool == nil {
		panic("artist.ArtistRepository.Pool is nil")
	}

	tx, err := r.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var p ArtistPainting

	// Insert painting (USE tx, not pool)
	err = tx.QueryRow(ctx, `
		INSERT INTO artist_paintings (
			artist_id,
			title,
			description,
			category,
			image_url,
			created_at,
			updated_at
		)
		VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
		RETURNING
			painting_id,
			artist_id,
			title,
			description,
			category,
			image_url,
			created_at,
			updated_at
	`,
		artistID,
		req.Title,
		req.Description,
		req.Category,
		req.ImageURL,
	).Scan(
		&p.PaintingID,
		&p.ArtistID,
		&p.Title,
		&p.Description,
		&p.Category,
		&p.ImageURL,
		&p.CreatedAt,
		&p.UpdatedAt,
	)
	if err != nil {
		return nil, dberrors.ErrAddingPainting
	}

	// Move artist to UNDER_REVIEW if currently PENDING
	_, err = tx.Exec(ctx, `
		UPDATE users
		SET status = 'UNDER_REVIEW', updated_at = NOW()
		WHERE user_id = $1
		  AND status = 'PENDING'
	`, artistID)
	if err != nil {
		return nil, dberrors.ErrUpdatingArtistAccountStatus
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("error committing transaction: %w", err)
	}

	return &p, nil
}


func (r *ArtistRepository) GetArtistPaintings(
	ctx context.Context,
	artistID uuid.UUID,
) ([]ArtistPainting, error) {

	if r.Pool == nil {
		panic("artist.ArtistRepository.Pool is nil")
	}

	rows, err := r.Pool.Query(ctx, `
		SELECT
			painting_id,
			artist_id,
			title,
			description,
			category,
			image_url,
			created_at,
			updated_at
		FROM artist_paintings
		WHERE artist_id = $1
		ORDER BY created_at DESC
	`, artistID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var paintings []ArtistPainting
	for rows.Next() {
		var p ArtistPainting
		if err := rows.Scan(
			&p.PaintingID,
			&p.ArtistID,
			&p.Title,
			&p.Description,
			&p.Category,
			&p.ImageURL,
			&p.CreatedAt,
			&p.UpdatedAt,
		); err != nil {
			if err == pgx.ErrNoRows {
				return nil, dberrors.ErrPaintingsNotFound
			}
			return nil, err
		}
		
		paintings = append(paintings, p)
	}

	return paintings, nil
}

func (r *ArtistRepository) GetArtistProfile(
	ctx context.Context,
	artistID uuid.UUID,
) (*ArtistProfileResponse, error) {

	const q = `
	SELECT
		ap.artist_prof_id,
		ap.artist_id,

		u.full_name,
		u.user_name,
		u.email,

		ap.bio,
		ap.experience_years,
		ap.verified,
		ap.created_at,
		ap.updated_at
	FROM artist_profiles ap
	JOIN users u ON u.user_id = ap.artist_id
	WHERE ap.artist_id = $1;
	`

	var p ArtistProfileResponse

	err := r.Pool.QueryRow(ctx, q, artistID).Scan(
		&p.ArtistProfileID,
		&p.ArtistID,

		&p.FullName,
		&p.UserName,
		&p.Email,

		&p.Bio,
		&p.ExperienceYears,
		&p.Verified,
		&p.CreatedAt,
		&p.UpdatedAt,
	)

	if err != nil {
		if err == pgx.ErrNoRows{
			return nil, dberrors.ErrArtistProfileNotFound
		}
		return nil, err
	}

	return &p, nil
}

func (r *ArtistRepository) CreateOrUpdateProfile(
	ctx context.Context,
	artistID uuid.UUID,
	req *ArtistProfileRequest,
) (*ArtistProfileResponse, error) {

	if r.Pool == nil {
		panic("artist.ArtistRepository.Pool is nil")
	}

	tx, err := r.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	const q = `
	INSERT INTO artist_profiles (
		artist_id,
		bio,
		experience_years,
		created_at,
		updated_at
	)
	VALUES ($1, $2, $3, NOW(), NOW())
	ON CONFLICT (artist_id)
	DO UPDATE SET
		bio = EXCLUDED.bio,
		experience_years = EXCLUDED.experience_years,
		updated_at = NOW()
	RETURNING artist_id;
	`
	var id uuid.UUID
	if err := r.Pool.QueryRow(
		ctx,
		q,
		artistID,
		req.Bio,
		req.ExperienceYears,
	).Scan(&id); err != nil {
		return nil, err
	}
	
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("error committing transaction: %w", err)
	}

	return r.GetArtistProfile(ctx, artistID)
}

func (r *ArtistRepository) CanVerifyArtist(
	ctx context.Context,
	artistID uuid.UUID,
) (bool, error) {

	var count int
	err := r.Pool.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM artist_paintings
		WHERE artist_id = $1
	`, artistID).Scan(&count)

	if err != nil {
		return false, err
	}

	return count > 0, nil
}

func (r *ArtistRepository) VerifyArtist(
	ctx context.Context,
	artistID uuid.UUID,
) error {

	tx, err := r.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var verified bool
	err = r.Pool.QueryRow(ctx, `
		SELECT verified
		FROM artist_profiles
		WHERE artist_id = $1
	`, artistID).Scan(&verified)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return dberrors.ErrArtistNotFound
		}
		return err
	}

	if verified {
		return dberrors.ErrArtistAlreadyVerified
	}

	ok, err := r.CanVerifyArtist(ctx, artistID)
	if err != nil {
		return err
	}
	if !ok {
		return dberrors.ErrNoPaintings
	}

	// verify artist profile
	cmd, err := r.Pool.Exec(ctx, `
		UPDATE artist_profiles
		SET verified = TRUE, updated_at = NOW()
		WHERE artist_id = $1 AND verified = FALSE
	`, artistID)

	if err != nil {
		return err
	}

	if cmd.RowsAffected() == 0 {
		return dberrors.ErrArtistProfileNotFound
	}
	// activate user account
	_, err = tx.Exec(ctx, `
		UPDATE users
		SET status = 'ACTIVE', updated_at = NOW()
		WHERE user_id = $1
	`, artistID)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (r *ArtistRepository) GetVerifiedArtistProfile(
	ctx context.Context,
	artistID uuid.UUID,
) (*ArtistProfileResponse, error) {

	var p ArtistProfileResponse

	err := r.Pool.QueryRow(ctx, `
		SELECT
			ap.artist_prof_id,
			ap.artist_id,
			ap.bio,
			ap.experience_years,
			ap.verified,
			u.full_name,
			u.user_name,
			u.email
		FROM artist_profiles ap
		JOIN users u ON u.user_id = ap.artist_id
		WHERE ap.artist_id = $1 AND ap.verified = TRUE
	`, artistID).Scan(
		&p.ArtistProfileID,
		&p.ArtistID,
		&p.Bio,
		&p.ExperienceYears,
		&p.Verified,
		&p.FullName,
		&p.UserName,
		&p.Email,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, dberrors.ErrArtistProfileNotFound
		}
		return nil, err
	}

	return &p, nil
}

func (r *ArtistRepository) GetArtistsForReview(
	ctx context.Context,
) ([]AdminArtistReviewItem, error) {

	rows, err := r.Pool.Query(ctx, `
		SELECT
			u.user_id,
			u.full_name,
			u.user_name,
			ap.bio,
			ap.experience_years,
			COUNT(p.painting_id) AS paintings_count,
			ap.created_at
		FROM users u
		JOIN artist_profiles ap ON ap.artist_id = u.user_id
		JOIN artist_paintings p ON p.artist_id = u.user_id
		WHERE
			u.status = 'UNDER_REVIEW'
			AND ap.verified = FALSE
		GROUP BY
			u.user_id,
			u.full_name,
			u.user_name,
			ap.bio,
			ap.experience_years,
			ap.created_at
		ORDER BY ap.created_at ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	artists := make([]AdminArtistReviewItem, 0)

	for rows.Next() {
		var a AdminArtistReviewItem
		if err := rows.Scan(
			&a.ArtistID,
			&a.FullName,
			&a.UserName,
			&a.Bio,
			&a.ExperienceYears,
			&a.PaintingsCount,
			&a.CreatedAt,
		); err != nil {
			return nil, err
		}
		artists = append(artists, a)
	}

	return artists, nil
}

func (r *ArtistRepository) RejectArtist(
	ctx context.Context,
	artistID uuid.UUID,
	reason string,
) error {

	tx, err := r.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// lock artist row
	var status string
	err = tx.QueryRow(ctx, `
		SELECT status
		FROM users
		WHERE user_id = $1
		FOR UPDATE
	`, artistID).Scan(&status)
	if err != nil {
		return err
	}

	if status != "UNDER_REVIEW" {
		return dberrors.ErrNotInReviewState
	}

	// update profile
	res, err := tx.Exec(ctx, `
		UPDATE artist_profiles
		SET
			rejected_reason = $2,
			rejected_at = NOW()
		WHERE artist_id = $1
		  AND verified = FALSE
	`, artistID, reason)
	if err != nil {
		return err
	}

	if res.RowsAffected() == 0 {
		return dberrors.ErrArtistAlreadyRejected
	}

	// update user status
	_, err = tx.Exec(ctx, `
		UPDATE users
		SET status = 'REJECTED', updated_at = NOW()
		WHERE user_id = $1
	`, artistID)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (r *ArtistRepository) GetMyReviewStatus(
	ctx context.Context,
	artistID uuid.UUID,
) (*ArtistReviewStatusResponse, error) {

	var resp ArtistReviewStatusResponse

	err := r.Pool.QueryRow(ctx, `
		SELECT
			u.status,
			COALESCE(ap.verified, FALSE),
			ap.rejected_reason,
			ap.rejected_at
		FROM users u
		LEFT JOIN artist_profiles ap
			ON ap.artist_id = u.user_id
		WHERE u.user_id = $1
	`, artistID).Scan(
		&resp.Status,
		&resp.Verified,
		&resp.RejectedReason,
		&resp.RejectedAt,
	)

	if err != nil {
		if err == pgx.ErrNoRows{
			return nil, dberrors.ErrInvalidArtistId
		}
		return nil, err
	}

	return &resp, nil
}
