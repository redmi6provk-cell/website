package repository

import (
	"strconv"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const salesInvoiceSequenceKey = "sales_invoice"
const salesInvoiceBaseNumber int64 = 14077

type InvoiceSequence struct {
	SequenceKey string `gorm:"primaryKey;column:sequence_key"`
	LastNumber  int64  `gorm:"column:last_number"`
}

type InvoiceSequenceRepository struct {
	db *gorm.DB
}

func NewInvoiceSequenceRepository(db *gorm.DB) *InvoiceSequenceRepository {
	return &InvoiceSequenceRepository{db: db}
}

func (r *InvoiceSequenceRepository) PeekNextSalesInvoiceNumber() (string, error) {
	var sequence InvoiceSequence
	if err := r.db.Where("sequence_key = ?", salesInvoiceSequenceKey).First(&sequence).Error; err != nil {
		return "", err
	}
	currentMax, err := r.currentSalesInvoiceMax(r.db)
	if err != nil {
		return "", err
	}
	nextNumber := maxInt64(sequence.LastNumber, currentMax) + 1
	return strconv.FormatInt(nextNumber, 10), nil
}

func (r *InvoiceSequenceRepository) NextSalesInvoiceNumber() (string, error) {
	var nextNumber int64

	err := r.db.Transaction(func(tx *gorm.DB) error {
		var sequence InvoiceSequence
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("sequence_key = ?", salesInvoiceSequenceKey).
			First(&sequence).Error; err != nil {
			return err
		}

		currentMax, err := r.currentSalesInvoiceMax(tx)
		if err != nil {
			return err
		}
		nextNumber = maxInt64(sequence.LastNumber, currentMax) + 1
		return tx.Model(&InvoiceSequence{}).
			Where("sequence_key = ?", salesInvoiceSequenceKey).
			Update("last_number", nextNumber).Error
	})
	if err != nil {
		return "", err
	}

	return strconv.FormatInt(nextNumber, 10), nil
}

func (r *InvoiceSequenceRepository) IsSalesInvoiceNumberInUse(invoiceNumber string, excludeOrderID string, excludeOfflineSaleID string) (bool, error) {
	var result struct {
		Count int64
	}

	err := r.db.Raw(`
		SELECT COUNT(*) AS count
		FROM (
			SELECT id::text AS record_id, 'order' AS source
			FROM orders
			WHERE invoice_number IS NOT NULL
				AND TRIM(invoice_number) <> ''
				AND LOWER(TRIM(invoice_number)) = LOWER(TRIM(?))
				AND (? = '' OR id::text <> ?)

			UNION ALL

			SELECT id::text AS record_id, 'offline_sale' AS source
			FROM offline_sales
			WHERE bill_number IS NOT NULL
				AND TRIM(bill_number) <> ''
				AND LOWER(TRIM(bill_number)) = LOWER(TRIM(?))
				AND (? = '' OR id::text <> ?)
		) AS invoice_matches
	`, invoiceNumber, excludeOrderID, excludeOrderID, invoiceNumber, excludeOfflineSaleID, excludeOfflineSaleID).Scan(&result).Error
	if err != nil {
		return false, err
	}

	return result.Count > 0, nil
}

func (r *InvoiceSequenceRepository) currentSalesInvoiceMax(db *gorm.DB) (int64, error) {
	var result struct {
		Value int64
	}

	err := db.Raw(`
		SELECT GREATEST(
			?,
			COALESCE((SELECT MAX(last_number) FROM invoice_sequences WHERE sequence_key = ?), 0),
			COALESCE((SELECT MAX(CASE WHEN TRIM(invoice_number) ~ '^[0-9]+$' THEN TRIM(invoice_number)::bigint END) FROM orders), 0),
			COALESCE((SELECT MAX(CASE WHEN TRIM(bill_number) ~ '^[0-9]+$' THEN TRIM(bill_number)::bigint END) FROM offline_sales), 0)
		) AS value
	`, salesInvoiceBaseNumber, salesInvoiceSequenceKey).Scan(&result).Error
	if err != nil {
		return 0, err
	}

	return result.Value, nil
}

func maxInt64(left int64, right int64) int64 {
	if left > right {
		return left
	}
	return right
}
