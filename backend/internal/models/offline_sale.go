package models

import (
	"time"

	"github.com/google/uuid"
)

type OfflineSale struct {
	ID                   uuid.UUID               `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	BillNumber           string                  `gorm:"type:varchar(40);uniqueIndex;not null" json:"bill_number"`
	SaleDate             time.Time               `gorm:"type:date;not null" json:"sale_date"`
	CustomerPartyID      *uuid.UUID              `gorm:"type:uuid;index" json:"customer_party_id,omitempty"`
	CustomerName         string                  `gorm:"type:varchar(120);not null" json:"customer_name"`
	CustomerPhone        string                  `gorm:"type:varchar(20)" json:"customer_phone"`
	ShopName             string                  `gorm:"type:varchar(120)" json:"shop_name"`
	PaymentMode          string                  `gorm:"type:varchar(30);not null" json:"payment_mode"`
	Notes                string                  `json:"notes"`
	Subtotal             float64                 `gorm:"type:decimal(15,2);not null;default:0.00" json:"subtotal"`
	DiscountTotal        float64                 `gorm:"type:decimal(15,2);not null;default:0.00" json:"discount_total"`
	FinalTotal           float64                 `gorm:"type:decimal(15,2);not null;default:0.00" json:"final_total"`
	AmountReceived       float64                 `gorm:"type:decimal(15,2);not null;default:0.00" json:"amount_received"`
	BalanceDue           float64                 `gorm:"type:decimal(15,2);not null;default:0.00" json:"balance_due"`
	Status               string                  `gorm:"type:varchar(30);not null" json:"status"`
	PaymentBreakdownJSON string                  `gorm:"type:text" json:"payment_breakdown_json"`
	PaymentBreakdown     []PaymentBreakdownEntry `gorm:"-" json:"payment_breakdown,omitempty"`
	CreatedBy            uuid.UUID               `gorm:"type:uuid" json:"created_by"`
	CreatedAt            time.Time               `json:"created_at"`
	UpdatedAt            time.Time               `json:"updated_at"`
	Items                []OfflineSaleItem       `gorm:"foreignKey:OfflineSaleID;constraint:OnDelete:CASCADE" json:"items"`
}

type OfflineSaleItem struct {
	ID            uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	OfflineSaleID uuid.UUID `gorm:"type:uuid;not null" json:"offline_sale_id"`
	ProductID     uuid.UUID `gorm:"type:uuid;not null" json:"product_id"`
	Product       Product   `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	ProductName   string    `gorm:"type:varchar(200);not null" json:"product_name"`
	Quantity      int       `gorm:"not null" json:"quantity"`
	SellPrice     float64   `gorm:"type:decimal(15,2);not null" json:"sell_price"`
	DiscountValue float64   `gorm:"type:decimal(15,2);not null;default:0.00" json:"discount_value"`
	LineTotal     float64   `gorm:"type:decimal(15,2);not null" json:"line_total"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}
