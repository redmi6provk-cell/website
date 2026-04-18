package repository

import (
	"backend/internal/models"
	"strings"

	"gorm.io/gorm"
)

type FinanceTransactionRepository struct {
	db *gorm.DB
}

func NewFinanceTransactionRepository(db *gorm.DB) *FinanceTransactionRepository {
	return &FinanceTransactionRepository{db: db}
}

func (r *FinanceTransactionRepository) EnsureSchema() error {
	return r.db.Exec(`
		CREATE TABLE IF NOT EXISTS finance_transactions (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			source_module varchar(60) NOT NULL,
			source_id varchar(120) NOT NULL,
			transaction_date timestamptz NOT NULL,
			direction varchar(10) NOT NULL,
			payment_mode varchar(120) NOT NULL,
			amount numeric(15,2) NOT NULL,
			reference_id varchar(120),
			reference_label varchar(160),
			party_id varchar(120),
			party_name varchar(200),
			party_type varchar(40),
			remarks text,
			created_at timestamptz DEFAULT now(),
			updated_at timestamptz DEFAULT now(),
			CONSTRAINT finance_transactions_source_unique UNIQUE (source_module, source_id)
		)
	`).Error
}

func (r *FinanceTransactionRepository) Replace(entry *models.FinanceTransaction) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("source_module = ? AND source_id = ?", entry.SourceModule, entry.SourceID).
			Delete(&models.FinanceTransaction{}).Error; err != nil {
			return err
		}
		return tx.Create(entry).Error
	})
}

func (r *FinanceTransactionRepository) Create(entry *models.FinanceTransaction) error {
	return r.db.Create(entry).Error
}

func (r *FinanceTransactionRepository) DeleteBySource(sourceModule string, sourceID string) error {
	return r.db.Where("source_module = ? AND source_id = ?", sourceModule, sourceID).
		Delete(&models.FinanceTransaction{}).Error
}

func (r *FinanceTransactionRepository) GetPaymentModeTransactions(paymentMode string) ([]models.PaymentModeTransaction, error) {
	var transactions []models.PaymentModeTransaction
	normalizedMode := strings.TrimSpace(paymentMode)

	query := r.db.Table("finance_transactions").
		Select(`
			id::text AS payment_id,
			transaction_date AS payment_date,
			amount,
			payment_mode,
			remarks,
			COALESCE(reference_id, '') AS reference_id,
			COALESCE(reference_label, '') AS reference_label,
			COALESCE(party_id, '') AS party_id,
			COALESCE(party_name, '') AS party_name,
			COALESCE(party_type, '') AS party_type,
			source_module,
			direction
		`).
		Order("transaction_date DESC")

	if normalizedMode != "" && !strings.EqualFold(normalizedMode, "all") {
		query = query.Where("LOWER(TRIM(payment_mode)) = LOWER(TRIM(?))", normalizedMode)
	}

	err := query.Scan(&transactions).Error
	return transactions, err
}
