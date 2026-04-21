package models

import (
	"time"

	"github.com/google/uuid"
)

type Party struct {
	PartyID   uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"party_id"`
	Name      string         `gorm:"type:varchar;not null" json:"name"`
	ShopName  string         `gorm:"type:varchar(120);default:''" json:"shop_name"`
	Type      string         `gorm:"type:varchar(20);not null" json:"type"` // customer, supplier
	CreatedAt time.Time      `json:"created_at"`
	Contacts  []PartyContact `gorm:"foreignKey:PartyID" json:"contacts,omitempty"`
}

type PartyContact struct {
	ContactID    uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"contact_id"`
	PartyID      uuid.UUID `gorm:"not null" json:"party_id"`
	ContactName  string    `gorm:"type:varchar" json:"contact_name"`
	ContactType  string    `gorm:"type:varchar(20);not null" json:"contact_type"` // phone, email, mobile, whatsapp
	ContactValue string    `gorm:"type:varchar;not null" json:"contact_value"`
	IsPrimary    bool      `gorm:"default:false" json:"is_primary"`
	CreatedAt    time.Time `json:"created_at"`
}

type Invoice struct {
	InvoiceID   uuid.UUID     `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"invoice_id"`
	PartyID     uuid.UUID     `gorm:"not null" json:"party_id"`
	InvoiceNo   string        `gorm:"unique;not null" json:"invoice_no"`
	InvoiceDate time.Time     `gorm:"type:date;not null" json:"invoice_date"`
	DueDate     time.Time     `gorm:"type:date;not null" json:"due_date"`
	Status      string        `gorm:"type:varchar(20);not null" json:"status"` // draft, unpaid, partially_paid, paid, overdue, cancelled
	TotalAmount float64       `gorm:"type:decimal(15,2);not null;default:0.00" json:"total_amount"`
	CreatedBy   uuid.UUID     `json:"created_by"`
	CreatedAt   time.Time     `json:"created_at"`
	Items       []InvoiceItem `gorm:"foreignKey:InvoiceID" json:"items,omitempty"`
	Party       *Party        `gorm:"foreignKey:PartyID" json:"party,omitempty"`
}

type InvoiceItem struct {
	ItemID      uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"item_id"`
	InvoiceID   uuid.UUID `gorm:"not null" json:"invoice_id"`
	Description string    `gorm:"not null" json:"description"`
	Quantity    float64   `gorm:"type:decimal(12,4);not null" json:"quantity"`
	Rate        float64   `gorm:"type:decimal(15,2);not null" json:"rate"`
	Amount      float64   `gorm:"type:decimal(15,2);not null" json:"amount"`
	CreatedAt   time.Time `json:"created_at"`
}

type Payment struct {
	PaymentID   uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"payment_id"`
	InvoiceID   uuid.UUID `gorm:"not null" json:"invoice_id"`
	PaymentDate time.Time `gorm:"type:date;not null" json:"payment_date"`
	Amount      float64   `gorm:"type:decimal(15,2);not null" json:"amount"`
	PaymentMode string    `gorm:"type:varchar(20);not null" json:"payment_mode"` // cash, bank_transfer, cheque, upi, credit_note
	Remarks     string    `json:"remarks"`
	ProcessedBy uuid.UUID `json:"processed_by"`
	CreatedAt   time.Time `json:"created_at"`
}

type PartyLedger struct {
	PartyID            uuid.UUID `json:"party_id"`
	PartyName          string    `json:"party_name"`
	PartyType          string    `json:"party_type"`
	TotalInvoiced      float64   `json:"total_invoiced"`
	TotalPaid          float64   `json:"total_paid"`
	OutstandingBalance float64   `json:"outstanding_balance"`
}

type Transaction struct {
	Date        time.Time `json:"date"`
	Type        string    `json:"type"` // invoice, payment
	RefID       string    `json:"ref_id"`
	InvoiceID   string    `json:"invoice_id,omitempty"`
	PaymentID   string    `json:"payment_id,omitempty"`
	SourceModule string   `json:"source_module,omitempty"`
	Amount      float64   `json:"amount"`
	Balance     float64   `json:"balance"`
	PaymentMode string    `json:"payment_mode,omitempty"`
	Remarks     string    `json:"remarks"`
}

type PaymentModeTransaction struct {
	PaymentID      string    `json:"payment_id"`
	PaymentDate    time.Time `json:"payment_date"`
	Amount         float64   `json:"amount"`
	PaymentMode    string    `json:"payment_mode"`
	Remarks        string    `json:"remarks"`
	ReferenceID    string    `json:"reference_id"`
	ReferenceLabel string    `json:"reference_label"`
	PartyID        string    `json:"party_id"`
	PartyName      string    `json:"party_name"`
	PartyType      string    `json:"party_type"`
	SourceModule   string    `json:"source_module"`
	Direction      string    `json:"direction"`
}
