package jwt

import (
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type Claims struct {
	UserID       uuid.UUID `json:"user_id"`
	Role         string    `json:"role"`
	TokenVersion int       `json:"token_version"`
	jwt.RegisteredClaims
}

func GenerateToken(userID uuid.UUID, role string, tokenVersion int) (string, error) {
	claims := Claims{
		UserID:       userID,
		Role:         role,
		TokenVersion: tokenVersion,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(os.Getenv("JWT_SECRET")))
}

func ValidateToken(tokenStr string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
		return []byte(os.Getenv("JWT_SECRET")), nil
	})
	if err != nil || !token.Valid {
		return nil, err
	}
	return claims, nil
}
