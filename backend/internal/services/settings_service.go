package services

import (
	"encoding/json"
	"time"

	"backend/internal/models"
	"backend/internal/repository"
)

type SettingsService struct {
	settingsRepo repository.SettingsRepository
	userRepo     *repository.UserRepository
}

type BankAccount struct {
	Name    string  `json:"name"`
	Balance float64 `json:"balance"`
}

type SettingsPayload struct {
	StoreName                string        `json:"store_name" binding:"required"`
	SupportPhone             string        `json:"support_phone"`
	SupportEmail             string        `json:"support_email"`
	Address                  string        `json:"address"`
	LogoURL                  string        `json:"logo_url"`
	DeliveryCharge           int           `json:"delivery_charge"`
	FreeDeliveryAbove        int           `json:"free_delivery_above"`
	ServiceAreas             string        `json:"service_areas"`
	EstimatedDelivery        string        `json:"estimated_delivery"`
	MinOrderAmount           int           `json:"min_order_amount"`
	DefaultOrderStatus       string        `json:"default_order_status"`
	CancellationWindow       int           `json:"cancellation_window"`
	CODEnabled               bool          `json:"cod_enabled"`
	OnlinePaymentEnabled     bool          `json:"online_payment_enabled"`
	QRUPIID                  string        `json:"qr_upi_id"`
	PaymentInstructions      string        `json:"payment_instructions"`
	CashBalance              float64       `json:"cash_balance"`
	BankAccounts             []BankAccount `json:"bank_accounts"`
	AdminName                string        `json:"admin_name" binding:"required"`
	AdminPhone               string        `json:"admin_phone" binding:"required"`
	SessionTimeout           int           `json:"session_timeout"`
	AllowMultiAdmin          bool          `json:"allow_multi_admin"`
	ManageProductsPermission bool          `json:"manage_products_permission"`
	ManageOrdersPermission   bool          `json:"manage_orders_permission"`
	ManageSettingsPermission bool          `json:"manage_settings_permission"`
}

type SettingsResponse struct {
	StoreName                string        `json:"store_name"`
	SupportPhone             string        `json:"support_phone"`
	SupportEmail             string        `json:"support_email"`
	Address                  string        `json:"address"`
	LogoURL                  string        `json:"logo_url"`
	DeliveryCharge           int           `json:"delivery_charge"`
	FreeDeliveryAbove        int           `json:"free_delivery_above"`
	ServiceAreas             string        `json:"service_areas"`
	EstimatedDelivery        string        `json:"estimated_delivery"`
	MinOrderAmount           int           `json:"min_order_amount"`
	DefaultOrderStatus       string        `json:"default_order_status"`
	CancellationWindow       int           `json:"cancellation_window"`
	CODEnabled               bool          `json:"cod_enabled"`
	OnlinePaymentEnabled     bool          `json:"online_payment_enabled"`
	QRUPIID                  string        `json:"qr_upi_id"`
	PaymentInstructions      string        `json:"payment_instructions"`
	CashBalance              float64       `json:"cash_balance"`
	BankAccounts             []BankAccount `json:"bank_accounts"`
	AdminName                string        `json:"admin_name"`
	AdminPhone               string        `json:"admin_phone"`
	LastLoginAt              *time.Time    `json:"last_login_at,omitempty"`
	SessionTimeout           int           `json:"session_timeout"`
	AllowMultiAdmin          bool          `json:"allow_multi_admin"`
	ManageProductsPermission bool          `json:"manage_products_permission"`
	ManageOrdersPermission   bool          `json:"manage_orders_permission"`
	ManageSettingsPermission bool          `json:"manage_settings_permission"`
}

func NewSettingsService(settingsRepo repository.SettingsRepository, userRepo *repository.UserRepository) *SettingsService {
	return &SettingsService{settingsRepo: settingsRepo, userRepo: userRepo}
}

func (s *SettingsService) GetSettings(userID string) (*SettingsResponse, error) {
	settings, err := s.settingsRepo.Get()
	if err != nil {
		return nil, err
	}

	user, err := s.userRepo.FindByIDString(userID)
	if err != nil {
		return nil, err
	}

	return mapSettingsResponse(settings, user), nil
}

func (s *SettingsService) UpdateSettings(userID string, payload SettingsPayload) (*SettingsResponse, error) {
	settings, err := s.settingsRepo.Get()
	if err != nil {
		return nil, err
	}

	user, err := s.userRepo.FindByIDString(userID)
	if err != nil {
		return nil, err
	}

	user.Name = payload.AdminName
	user.Phone = payload.AdminPhone

	settings.StoreName = payload.StoreName
	settings.SupportPhone = payload.SupportPhone
	settings.SupportEmail = payload.SupportEmail
	settings.Address = payload.Address
	settings.LogoURL = payload.LogoURL
	settings.DeliveryCharge = payload.DeliveryCharge
	settings.FreeDeliveryAbove = payload.FreeDeliveryAbove
	settings.ServiceAreas = payload.ServiceAreas
	settings.EstimatedDelivery = payload.EstimatedDelivery
	settings.MinOrderAmount = payload.MinOrderAmount
	settings.DefaultOrderStatus = payload.DefaultOrderStatus
	settings.CancellationWindow = payload.CancellationWindow
	settings.CODEnabled = payload.CODEnabled
	settings.OnlinePaymentEnabled = payload.OnlinePaymentEnabled
	settings.QRUPIID = payload.QRUPIID
	settings.PaymentInstructions = payload.PaymentInstructions
	settings.CashBalance = payload.CashBalance
	settings.BankAccountsJSON = marshalBankAccounts(payload.BankAccounts)
	settings.SessionTimeout = payload.SessionTimeout
	settings.AllowMultiAdmin = payload.AllowMultiAdmin
	settings.ManageProductsPermission = payload.ManageProductsPermission
	settings.ManageOrdersPermission = payload.ManageOrdersPermission
	settings.ManageSettingsPermission = payload.ManageSettingsPermission

	if err := s.userRepo.Update(user); err != nil {
		return nil, err
	}
	if err := s.settingsRepo.Save(settings); err != nil {
		return nil, err
	}

	return mapSettingsResponse(settings, user), nil
}

func (s *SettingsService) LogoutAllSessions(userID string) error {
	user, err := s.userRepo.FindByIDString(userID)
	if err != nil {
		return err
	}
	user.TokenVersion++
	return s.userRepo.Update(user)
}

func mapSettingsResponse(settings *models.AdminSettings, user *models.User) *SettingsResponse {
	return &SettingsResponse{
		StoreName:                settings.StoreName,
		SupportPhone:             settings.SupportPhone,
		SupportEmail:             settings.SupportEmail,
		Address:                  settings.Address,
		LogoURL:                  settings.LogoURL,
		DeliveryCharge:           settings.DeliveryCharge,
		FreeDeliveryAbove:        settings.FreeDeliveryAbove,
		ServiceAreas:             settings.ServiceAreas,
		EstimatedDelivery:        settings.EstimatedDelivery,
		MinOrderAmount:           settings.MinOrderAmount,
		DefaultOrderStatus:       settings.DefaultOrderStatus,
		CancellationWindow:       settings.CancellationWindow,
		CODEnabled:               settings.CODEnabled,
		OnlinePaymentEnabled:     settings.OnlinePaymentEnabled,
		QRUPIID:                  settings.QRUPIID,
		PaymentInstructions:      settings.PaymentInstructions,
		CashBalance:              settings.CashBalance,
		BankAccounts:             parseBankAccounts(settings.BankAccountsJSON),
		AdminName:                user.Name,
		AdminPhone:               user.Phone,
		LastLoginAt:              user.LastLoginAt,
		SessionTimeout:           settings.SessionTimeout,
		AllowMultiAdmin:          settings.AllowMultiAdmin,
		ManageProductsPermission: settings.ManageProductsPermission,
		ManageOrdersPermission:   settings.ManageOrdersPermission,
		ManageSettingsPermission: settings.ManageSettingsPermission,
	}
}

func parseBankAccounts(raw string) []BankAccount {
	if raw == "" {
		return []BankAccount{}
	}

	var accounts []BankAccount
	if err := json.Unmarshal([]byte(raw), &accounts); err != nil {
		return []BankAccount{}
	}

	cleaned := make([]BankAccount, 0, len(accounts))
	for _, account := range accounts {
		if account.Name == "" {
			continue
		}
		cleaned = append(cleaned, account)
	}
	return cleaned
}

func marshalBankAccounts(accounts []BankAccount) string {
	if len(accounts) == 0 {
		return "[]"
	}

	cleaned := make([]BankAccount, 0, len(accounts))
	for _, account := range accounts {
		if account.Name == "" {
			continue
		}
		cleaned = append(cleaned, account)
	}

	encoded, err := json.Marshal(cleaned)
	if err != nil {
		return "[]"
	}
	return string(encoded)
}

type PublicSettingsResponse struct {
	CODEnabled           bool   `json:"cod_enabled"`
	OnlinePaymentEnabled bool   `json:"online_payment_enabled"`
	QRUPIID              string `json:"qr_upi_id"`
	PaymentInstructions  string `json:"payment_instructions"`
	Address              string `json:"address"`
	DeliveryCharge       int    `json:"delivery_charge"`
	FreeDeliveryAbove    int    `json:"free_delivery_above"`
}

func (s *SettingsService) GetPublicSettings() (*PublicSettingsResponse, error) {
	settings, err := s.settingsRepo.Get()
	if err != nil {
		return nil, err
	}

	return &PublicSettingsResponse{
		CODEnabled:           settings.CODEnabled,
		OnlinePaymentEnabled: settings.OnlinePaymentEnabled,
		QRUPIID:              settings.QRUPIID,
		PaymentInstructions:  settings.PaymentInstructions,
		Address:              settings.Address,
		DeliveryCharge:       settings.DeliveryCharge,
		FreeDeliveryAbove:    settings.FreeDeliveryAbove,
	}, nil
}
