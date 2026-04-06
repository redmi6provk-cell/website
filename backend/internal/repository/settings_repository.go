package repository

import (
	"backend/internal/models"
	"encoding/json"
	"strings"

	"gorm.io/gorm"
)

type SettingsRepository interface {
	Get() (*models.AdminSettings, error)
	Save(settings *models.AdminSettings) error
	ApplyCollectedPayment(amount float64, collectionMethod string) error
	AdjustPaymentBalance(amount float64, collectionMethod string) error
}

type settingsRepository struct {
	db *gorm.DB
}

func NewSettingsRepository(db *gorm.DB) SettingsRepository {
	return &settingsRepository{db: db}
}

func (r *settingsRepository) Get() (*models.AdminSettings, error) {
	var settings models.AdminSettings
	err := r.db.First(&settings).Error
	if err == nil {
		return &settings, nil
	}
	if err != gorm.ErrRecordNotFound {
		return nil, err
	}

	settings = models.AdminSettings{
		StoreName:                "FMCG Store",
		SupportPhone:             "+91 98765 43210",
		SupportEmail:             "support@fmcgstore.in",
		Address:                  "Main Market Road, Mumbai Badalpur",
		DeliveryCharge:           50,
		FreeDeliveryAbove:        1999,
		ServiceAreas:             "DADAR",
		EstimatedDelivery:        "30-45 minutes",
		MinOrderAmount:           199,
		DefaultOrderStatus:       "pending",
		CancellationWindow:       10,
		CODEnabled:               true,
		OnlinePaymentEnabled:     true,
		QRUPIID:                  "fmcgstore@upi",
		PaymentInstructions:      "Accept COD and verified UPI payments for all eligible orders.",
		CashBalance:              0,
		BankAccountsJSON:         "[]",
		SessionTimeout:           30,
		AllowMultiAdmin:          false,
		ManageProductsPermission: true,
		ManageOrdersPermission:   true,
		ManageSettingsPermission: true,
	}

	if err := r.db.Create(&settings).Error; err != nil {
		return nil, err
	}
	return &settings, nil
}

func (r *settingsRepository) Save(settings *models.AdminSettings) error {
	return r.db.Save(settings).Error
}

func (r *settingsRepository) ApplyCollectedPayment(amount float64, collectionMethod string) error {
	return r.AdjustPaymentBalance(amount, collectionMethod)
}

func (r *settingsRepository) AdjustPaymentBalance(amount float64, collectionMethod string) error {
	if amount == 0 {
		return nil
	}

	method := strings.TrimSpace(collectionMethod)
	if method == "" {
		return nil
	}
	if strings.EqualFold(method, "card") || strings.EqualFold(method, "mixed") || strings.EqualFold(method, "credit") {
		return nil
	}

	settings, err := r.Get()
	if err != nil {
		return err
	}

	if strings.EqualFold(method, "cash") {
		settings.CashBalance += amount
		return r.db.Save(settings).Error
	}

	type bankAccount struct {
		Name    string  `json:"name"`
		Balance float64 `json:"balance"`
	}

	accounts := []bankAccount{}
	if settings.BankAccountsJSON != "" {
		_ = json.Unmarshal([]byte(settings.BankAccountsJSON), &accounts)
	}

	matched := false
	for index := range accounts {
		if strings.EqualFold(strings.TrimSpace(accounts[index].Name), method) {
			accounts[index].Balance += amount
			matched = true
			break
		}
	}

	if !matched {
		accounts = append(accounts, bankAccount{Name: method, Balance: amount})
	}

	encoded, err := json.Marshal(accounts)
	if err != nil {
		return err
	}

	settings.BankAccountsJSON = string(encoded)
	return r.db.Save(settings).Error
}
