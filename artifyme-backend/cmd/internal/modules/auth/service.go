package auth

import (
	"context"
	"fmt"

	dberrors "github.com/ganeshterkar/artifyme-backend/cmd/internal/errors"
	"github.com/ganeshterkar/artifyme-backend/cmd/internal/utils"
)

type AuthService struct {
	authRepo *AuthRepository
}

func NewService(authRepo *AuthRepository) *AuthService {
	if authRepo == nil || authRepo.Pool == nil {
		panic("auth.NewService: repo or pool is nil")
	}
	return &AuthService{authRepo: authRepo}
}


func (s *AuthService) RegisterUserService(ctx context.Context, request *RegisterRequest) (*User, error) {

	user, err := s.authRepo.RegisterUser(ctx, request)
	if err != nil {
		return &User{}, err
	}
	
	return s.authRepo.GetUserByEmail(ctx, user.Email)
}

func (s *AuthService) LoginUserService(ctx context.Context,	request *LoginRequest) (*User, error) {

	user, err := s.authRepo.GetUserByEmail(ctx, request.Email)
	if err != nil {
		return nil, err
	}


	passwordHash, err := s.authRepo.GetUserPasswordHash(ctx, &user.UserID)
	if err != nil {
		return nil, fmt.Errorf("error getting password hash from user")
	}

	if err := utils.ComparePassword(passwordHash, request.Password); err != nil {
		return nil, dberrors.ErrInvalidCredential
	}

	if user.Status != "ACTIVE" && user.Status != "PENDING" && user.Status != "UNDER_REVIEW" {
		return nil, dberrors.ErrAccountNotActive
	}

	return user, nil
}
