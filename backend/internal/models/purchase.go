package models

import (
	"time"

	"github.com/google/uuid"
)

type Purchase struct {
	ID            uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Date          time.Time      `gorm:"type:date;not null" json:"date"`
	InvoiceNumber string         `gorm:"type:varchar(120)" json:"invoice_number"`
	SupplierPartyID *uuid.UUID   `gorm:"type:uuid" json:"supplier_party_id"`
	SupplierParty *Party         `gorm:"foreignKey:SupplierPartyID" json:"supplier_party,omitempty"`
	SupplierName  string         `gorm:"type:varchar(200);not null" json:"supplier_name"`
	PaymentStatus string         `gorm:"type:varchar(20);not null" json:"payment_status"`
	PaymentMethod string         `gorm:"type:varchar(20);not null" json:"payment_method"`
	Notes         string         `json:"notes"`
	TotalAmount   float64        `gorm:"type:decimal(15,2);not null;default:0.00" json:"total_amount"`
	CreatedBy     uuid.UUID      `gorm:"type:uuid" json:"created_by"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	Items         []PurchaseItem `gorm:"foreignKey:PurchaseID;constraint:OnDelete:CASCADE" json:"items"`
}

type PurchaseItem struct {
	ID         uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	PurchaseID uuid.UUID `gorm:"type:uuid;not null" json:"purchase_id"`
	ProductID  uuid.UUID `gorm:"type:uuid;not null" json:"product_id"`
	Product    Product   `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	ProductName string   `gorm:"type:varchar(200);not null" json:"product_name"`
	Quantity   int       `gorm:"not null" json:"quantity"`
	BuyPrice   float64   `gorm:"type:decimal(15,2);not null" json:"buy_price"`
	LineTotal  float64   `gorm:"type:decimal(15,2);not null" json:"line_total"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}
