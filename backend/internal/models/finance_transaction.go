package models

import (
	"time"

	"github.com/google/uuid"
)

type FinanceTransaction struct {
	ID              uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	SourceModule    string    `gorm:"type:varchar(60);not null;index:idx_finance_source,unique" json:"source_module"`
	SourceID        string    `gorm:"type:varchar(120);not null;index:idx_finance_source,unique" json:"source_id"`
	TransactionDate time.Time `gorm:"not null;index" json:"transaction_date"`
	Direction       string    `gorm:"type:varchar(10);not null" json:"direction"`
	PaymentMode     string    `gorm:"type:varchar(120);not null;index" json:"payment_mode"`
	Amount          float64   `gorm:"type:decimal(15,2);not null" json:"amount"`
	ReferenceID     string    `gorm:"type:varchar(120)" json:"reference_id"`
	ReferenceLabel  string    `gorm:"type:varchar(160)" json:"reference_label"`
	PartyID         string    `gorm:"type:varchar(120)" json:"party_id"`
	PartyName       string    `gorm:"type:varchar(200)" json:"party_name"`
	PartyType       string    `gorm:"type:varchar(40)" json:"party_type"`
	Remarks         string    `gorm:"type:text" json:"remarks"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}
