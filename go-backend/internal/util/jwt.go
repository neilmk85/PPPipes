package util

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var jwtSecret string
var jwtExpiry string
var jwtRefreshExpiry string

func InitJWT(secret, expiry, refreshExpiry string) {
	jwtSecret = secret
	jwtExpiry = expiry
	jwtRefreshExpiry = refreshExpiry
}

type Claims struct {
	Email                string `json:"email"`
	Type                 string `json:"type"`
	ReplacementPairingID int    `json:"replacementPairingId,omitempty"` // >0 when this is a temp-credential session
	jwt.RegisteredClaims
}

func GenerateAccessToken(email string) (string, error) {
	return generateAccessTokenWithReplacement(email, 0)
}

func GenerateAccessTokenWithReplacement(email string, pairingID int) (string, error) {
	return generateAccessTokenWithReplacement(email, pairingID)
}

func generateAccessTokenWithReplacement(email string, pairingID int) (string, error) {
	duration, err := time.ParseDuration(jwtExpiry)
	if err != nil {
		return "", fmt.Errorf("invalid JWT_EXPIRY duration: %w", err)
	}

	claims := Claims{
		Email:                email,
		Type:                 "access",
		ReplacementPairingID: pairingID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(duration)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(jwtSecret))
}

func GenerateRefreshToken(email string) (string, error) {
	duration, err := time.ParseDuration(jwtRefreshExpiry)
	if err != nil {
		return "", fmt.Errorf("invalid JWT_REFRESH_EXPIRY duration: %w", err)
	}

	claims := Claims{
		Email: email,
		Type:  "refresh",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(duration)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(jwtSecret))
}

func VerifyToken(tokenString string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(jwtSecret), nil
	})

	if err != nil {
		return nil, err
	}

	if !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}

	return claims, nil
}

func DecodeToken(tokenString string) *Claims {
	claims, err := VerifyToken(tokenString)
	if err != nil {
		return nil
	}
	return claims
}
