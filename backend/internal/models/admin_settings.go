package models

import (
	"time"

	"github.com/google/uuid"
)

type AdminSettings struct {
	ID                       uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	StoreName                string    `gorm:"type:varchar(150);not null" json:"store_name"`
	SupportPhone             string    `gorm:"type:varchar(20)" json:"support_phone"`
	SupportEmail             string    `gorm:"type:varchar(120)" json:"support_email"`
	Address                  string    `gorm:"type:text" json:"address"`
	LogoURL                  string    `gorm:"type:text" json:"logo_url"`
	DeliveryCharge           int       `gorm:"default:0" json:"delivery_charge"`
	FreeDeliveryAbove        int       `gorm:"default:0" json:"free_delivery_above"`
	ServiceAreas             string    `gorm:"type:text" json:"service_areas"`
	EstimatedDelivery        string    `gorm:"type:varchar(100)" json:"estimated_delivery"`
	MinOrderAmount           int       `gorm:"default:0" json:"min_order_amount"`
	DefaultOrderStatus       string    `gorm:"type:varchar(50);default:'pending'" json:"default_order_status"`
	CancellationWindow       int       `gorm:"default:0" json:"cancellation_window"`
	CODEnabled               bool      `gorm:"default:true" json:"cod_enabled"`
	OnlinePaymentEnabled     bool      `gorm:"default:true" json:"online_payment_enabled"`
	QRUPIID                  string    `gorm:"type:varchar(120)" json:"qr_upi_id"`
	PaymentInstructions      string    `gorm:"type:text" json:"payment_instructions"`
	CashBalance              float64   `gorm:"type:decimal(15,2);default:0" json:"cash_balance"`
	BankAccountsJSON         string    `gorm:"type:text" json:"bank_accounts_json"`
	SessionTimeout           int       `gorm:"default:30" json:"session_timeout"`
	AllowMultiAdmin          bool      `gorm:"default:false" json:"allow_multi_admin"`
	ManageProductsPermission bool      `gorm:"default:true" json:"manage_products_permission"`
	ManageOrdersPermission   bool      `gorm:"default:true" json:"manage_orders_permission"`
	ManageSettingsPermission bool      `gorm:"default:true" json:"manage_settings_permission"`
	CreatedAt                time.Time `json:"created_at"`
	UpdatedAt                time.Time `json:"updated_at"`
}
