package utils

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

func GenerateJWT(userID uuid.UUID, role, secrete, status string, sessionID ...uuid.UUID) (string, error) {
	claims := jwt.MapClaims{
		"user_id": userID.String(),
		"role":    role,
		"status":  status,
		"exp":     time.Now().Add(24 * time.Hour).Unix(),
		"iat":     time.Now().Unix(),
	}

	if len(sessionID) > 0 && sessionID[0] != uuid.Nil {
		claims["session_id"] = sessionID[0].String()
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secrete))
}

// GenerateRefreshToken generates a secure 32-byte cryptographically random token and its SHA-256 hash.
func GenerateRefreshToken() (string, string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", "", err
	}
	rawToken := hex.EncodeToString(b)
	hash := sha256.Sum256([]byte(rawToken))
	return rawToken, hex.EncodeToString(hash[:]), nil
}

// HashToken computes the SHA-256 hex string of a refresh token.
func HashToken(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}
