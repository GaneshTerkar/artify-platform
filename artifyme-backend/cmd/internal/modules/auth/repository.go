package auth

import (
	"context"
	"errors"
	"fmt"

	dberrors "github.com/ganeshterkar/artifyme-backend/cmd/internal/errors"
	"github.com/ganeshterkar/artifyme-backend/cmd/internal/utils"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type AuthRepository struct {
	Pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *AuthRepository {
	if pool == nil {
		panic("pgx pool is nil in auth.NewRepository")
	}
	return &AuthRepository{
		Pool: pool,
	}
}

func (r *AuthRepository) RegisterUser(ctx context.Context, req *RegisterRequest) (*User, error) {

	if r.Pool == nil {
		panic("auth.Repository.Pool is nil")
	}

	tx, err := r.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	address := pgtype.Text{
	String: req.Address,
	Valid:  true,
}

	passwordHash, err := utils.HashPassword(req.Password)
	if err != nil{
		return &User{}, fmt.Errorf("error hashing password: %w", err)
	}

	var user User

	err = tx.QueryRow(ctx, `
		INSERT INTO users (
			full_name,
			email,
			address,
			phone_number,
			password_hash,
			role,
			created_at,
			updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
		RETURNING 
			user_id,
			full_name,
			email,
			address,
			phone_number,
			role,
			status,
			created_at,
			updated_at
	`,
		req.FullName,
		req.Email,
		address,
		req.PhoneNumber,
		passwordHash,
		req.Role,
	).Scan(
		&user.UserID,
		&user.FullName,
		&user.Email,
		&user.Address,
		&user.PhoneNumber,
		&user.Role,
		&user.Status,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		if dberrors.IsEmailAlreadyExists(err){
			err = dberrors.ErrEmailAlreadyExists
			return nil, err
		}
		return nil, fmt.Errorf("error registering user: %w", err)
	}

	if user.Role == UserRole(Customer) || user.Role == UserRole(Admin){
		newStatus := AccountStatus(Active)
		newUser, err := r.UpdateUserAccountStatus(ctx, tx, user.UserID, newStatus)
		if err != nil{
			return nil, fmt.Errorf("error updating user account status: %w", err)
		}
		user.Status = newUser.Status
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("error committing transaction: %w", err)
	}

	return &user, nil
}

func (r *AuthRepository) UpdateUserAccountStatus(
	ctx context.Context,
	tx pgx.Tx,
	userId uuid.UUID,
	newStatus AccountStatus,
) (*User, error) {

	var updatedUser User

	err := tx.QueryRow(ctx, `
		UPDATE users
		SET status = $1, updated_at = NOW()
		WHERE user_id = $2
		RETURNING 
			user_id,
			full_name,
			email,
			address,
			phone_number,
			role,
			status,
			created_at,
			updated_at
	`, newStatus, userId).Scan(
		&updatedUser.UserID,
		&updatedUser.FullName,
		&updatedUser.Email,
		&updatedUser.Address,
		&updatedUser.PhoneNumber,
		&updatedUser.Role,
		&updatedUser.Status,
		&updatedUser.CreatedAt,
		&updatedUser.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, dberrors.ErrUserNotFound
		}
		return nil, err
	}

	return &updatedUser, nil
}


func (r *AuthRepository) GetUserByEmail(ctx context.Context, email string) (*User, error) {
	if r.Pool == nil {
		panic("GetUserByEmail: r.Pool is nil")
	}
	row := r.Pool.QueryRow(ctx, `
		SELECT 
			user_id,
			full_name,
			user_name,
			email,
			address,
			phone_number,
			role,
			status,
			created_at,
			updated_at
		FROM users
		WHERE email = $1
	`, email)

	var u User
	err := row.Scan(
		&u.UserID,
		&u.FullName,
		&u.UserName,
		&u.Email,
		&u.Address,
		&u.PhoneNumber,
		&u.Role,
		&u.Status,
		&u.CreatedAt,
		&u.UpdatedAt,
	)

	if err != nil {
		if err == pgx.ErrNoRows{
			return nil, dberrors.ErrUserNotFound
		}
		return nil, err
	}

	return &u, nil
}

func (r *AuthRepository) GetUserPasswordHash(ctx context.Context, userId *uuid.UUID) (string, error){
	if userId == nil || *userId == uuid.Nil {
		return "", errors.New("user id is required")
	}

	var hash string
	row := r.Pool.QueryRow(ctx, `
		SELECT password_hash
		FROM users
		WHERE user_id = $1
	`, userId)

	err := row.Scan(&hash)
	if err != nil {
		return "", err
	}
	return hash, nil
}