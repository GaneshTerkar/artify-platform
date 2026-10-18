package auth

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/ganeshterkar/artifyme-backend/cmd/internal/cache"
	dberrors "github.com/ganeshterkar/artifyme-backend/cmd/internal/errors"
	"github.com/ganeshterkar/artifyme-backend/cmd/internal/utils"
	"github.com/google/uuid"
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

func (s *AuthService) CreateSession(ctx context.Context, userID uuid.UUID, deviceID, deviceName, deviceType, ip, userAgent string) (uuid.UUID, string, error) {
	if deviceID == "" {
		deviceID = "default-" + uuid.New().String()
	}
	if deviceName == "" {
		deviceName = "Web Browser"
	}
	if deviceType == "" {
		deviceType = "DESKTOP"
	}

	rawRefreshToken, hash, err := utils.GenerateRefreshToken()
	if err != nil {
		return uuid.Nil, "", fmt.Errorf("failed to generate refresh token: %w", err)
	}

	session := &UserSession{
		SessionID:        uuid.New(),
		UserID:           userID,
		DeviceID:         deviceID,
		DeviceName:       deviceName,
		DeviceType:       deviceType,
		IPAddress:        ip,
		UserAgent:        userAgent,
		RefreshTokenHash: hash,
		ExpiresAt:        time.Now().Add(30 * 24 * time.Hour), // 30 days
	}

	sessionID, err := s.authRepo.CreateOrUpdateSession(ctx, session)
	if err != nil {
		return uuid.Nil, "", fmt.Errorf("failed to save session: %w", err)
	}

	return sessionID, rawRefreshToken, nil
}

func (s *AuthService) RefreshToken(ctx context.Context, rawRefreshToken, jwtSecret string) (string, string, *User, error) {
	if rawRefreshToken == "" {
		return "", "", nil, errors.New("refresh token is required")
	}

	hash := utils.HashToken(rawRefreshToken)
	session, err := s.authRepo.GetSessionByRefreshHash(ctx, hash)
	if err != nil || session == nil {
		return "", "", nil, errors.New("invalid or expired refresh token")
	}

	if session.IsRevoked {
		return "", "", nil, errors.New("session has been revoked, please log in again")
	}

	if session.ExpiresAt.Before(time.Now()) {
		return "", "", nil, errors.New("refresh token expired")
	}

	user, err := s.authRepo.GetUserByID(ctx, session.UserID)
	if err != nil || user == nil {
		return "", "", nil, errors.New("user not found")
	}

	if user.Status == "SUSPENDED" || user.Status == "REJECTED" {
		return "", "", nil, errors.New("account is not active")
	}

	// Refresh Token Rotation (RTR): issue brand new token & invalidate previous one
	newRawToken, newHash, err := utils.GenerateRefreshToken()
	if err != nil {
		return "", "", nil, fmt.Errorf("failed to generate new refresh token: %w", err)
	}

	newExpiresAt := time.Now().Add(30 * 24 * time.Hour)
	if err := s.authRepo.RotateRefreshToken(ctx, session.SessionID, newHash, newExpiresAt); err != nil {
		return "", "", nil, fmt.Errorf("failed to update session: %w", err)
	}

	newAccessToken, err := utils.GenerateJWT(user.UserID, string(user.Role), jwtSecret, string(user.Status), session.SessionID)
	if err != nil {
		return "", "", nil, fmt.Errorf("failed to generate access token: %w", err)
	}

	return newAccessToken, newRawToken, user, nil
}

func (s *AuthService) ListSessions(ctx context.Context, userID uuid.UUID, currentSessionID string) ([]UserSessionDTO, error) {
	sessions, err := s.authRepo.ListUserSessions(ctx, userID)
	if err != nil {
		return nil, err
	}

	for i := range sessions {
		if sessions[i].SessionID == currentSessionID {
			sessions[i].IsCurrent = true
		}
	}
	return sessions, nil
}

func (s *AuthService) RevokeSession(ctx context.Context, sessionID uuid.UUID, userID uuid.UUID) error {
	if err := s.authRepo.RevokeSession(ctx, sessionID, userID); err != nil {
		return err
	}

	// Blacklist session in Redis for sub-millisecond middleware validation
	_ = cache.Set(ctx, "session:revoked:"+sessionID.String(), "1", 24*time.Hour)
	return nil
}

func (s *AuthService) RevokeAllOtherSessions(ctx context.Context, currentSessionID uuid.UUID, userID uuid.UUID) error {
	revokedIDs, err := s.authRepo.RevokeAllOtherSessions(ctx, currentSessionID, userID)
	if err != nil {
		return err
	}

	for _, id := range revokedIDs {
		_ = cache.Set(ctx, "session:revoked:"+id.String(), "1", 24*time.Hour)
	}
	return nil
}
