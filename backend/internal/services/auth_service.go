package services

import (
	"errors"
	"regexp"
	"strings"
	"time"

	"backend/internal/models"
	"backend/internal/repository"
	"backend/pkg/jwt"
)

type AuthService struct {
	repo    *repository.UserRepository
	arpRepo *repository.ARPRepository
}

func NewAuthService(repo *repository.UserRepository, arpRepo *repository.ARPRepository) *AuthService {
	return &AuthService{repo: repo, arpRepo: arpRepo}
}

var nonDigitRegex = regexp.MustCompile(`\D`)

func normalizePhone(phone string) (string, error) {
	digits := nonDigitRegex.ReplaceAllString(phone, "")
	if len(digits) == 12 && strings.HasPrefix(digits, "91") {
		digits = digits[2:]
	}
	if len(digits) != 10 {
		return "", errors.New("phone number must be a valid 10-digit Indian mobile number")
	}
	return digits, nil
}

func (s *AuthService) Register(name, shopName, phone string) (string, *models.User, bool, error) {
	normalizedPhone, err := normalizePhone(phone)
	if err != nil {
		return "", nil, false, err
	}

	user := &models.User{
		Name:     strings.TrimSpace(name),
		ShopName: strings.TrimSpace(shopName),
		Phone:    normalizedPhone,
		Role:     models.RoleUser,
	}

	authUser, created, err := s.repo.FindOrCreateByPhone(user)
	if err != nil {
		return "", nil, false, err
	}

	if authUser.Role == models.RoleUser && s.arpRepo != nil {
		if err := s.arpRepo.EnsureCustomerPartyForUser(authUser); err != nil {
			return "", nil, false, err
		}
	}

	now := time.Now()
	authUser.LastLoginAt = &now
	if err := s.repo.Update(authUser); err != nil {
		return "", nil, false, err
	}

	token, err := jwt.GenerateToken(authUser.ID, authUser.Role, authUser.TokenVersion)
	if err != nil {
		return "", nil, false, errors.New("failed to generate token after registration")
	}

	return token, authUser, created, nil
}

func (s *AuthService) Login(phone string) (string, *models.User, error) {
	normalizedPhone, err := normalizePhone(phone)
	if err != nil {
		return "", nil, err
	}

	user, err := s.repo.FindByPhone(normalizedPhone)
	if err != nil {
		return "", nil, errors.New("user not found")
	}

	if user.Role == models.RoleUser && s.arpRepo != nil {
		if err := s.arpRepo.EnsureCustomerPartyForUser(user); err != nil {
			return "", nil, err
		}
	}

	now := time.Now()
	user.LastLoginAt = &now
	if err := s.repo.Update(user); err != nil {
		return "", nil, err
	}

	// Generate JWT
	token, err := jwt.GenerateToken(user.ID, user.Role, user.TokenVersion)
	if err != nil {
		return "", nil, errors.New("failed to generate token")
	}

	return token, user, nil
}
