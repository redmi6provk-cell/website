package models

import (
	"time"

	"github.com/google/uuid"
)

type Expense struct {
	ID            uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Date          time.Time `gorm:"type:date;not null" json:"date"`
	Description   string    `gorm:"type:text;not null" json:"description"`
	Category      string    `gorm:"type:varchar(120);not null" json:"category"`
	PaymentMethod string    `gorm:"type:varchar(120);not null" json:"payment_method"`
	Amount        float64   `gorm:"type:decimal(15,2);not null" json:"amount"`
	Note          string    `gorm:"type:text" json:"note"`
	CreatedBy     uuid.UUID `gorm:"type:uuid;not null" json:"created_by"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}
