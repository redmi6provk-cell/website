package config

import (
	"fmt"

	"github.com/google/uuid"
)

type fallbackAdminUser struct {
	ID uuid.UUID
}

// EnsureARPSchema aligns legacy ARP foreign keys with the app's auth model.
// Existing ARP records may still point at the retired admins table, so we
// backfill any invalid audit IDs to an existing admin user before adding the
// new constraints.
func EnsureARPSchema() error {
	var fallback fallbackAdminUser
	if err := DB.Raw(`
		SELECT id FROM users
		WHERE role IN ('SUPERADMIN', 'ADMIN', 'ACCOUNTANT')
		ORDER BY created_at ASC
		LIMIT 1
	`).Scan(&fallback).Error; err != nil {
		return fmt.Errorf("failed to find fallback admin user: %w", err)
	}

	if fallback.ID == uuid.Nil {
		return fmt.Errorf("failed to align ARP schema: no staff user found in users table")
	}

	statements := []string{
		`ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_created_by_fkey`,
		`ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_processed_by_fkey`,
		fmt.Sprintf(`
			UPDATE invoices
			SET created_by = '%s'
			WHERE created_by IS NULL
				OR created_by = '00000000-0000-0000-0000-000000000000'
				OR NOT EXISTS (SELECT 1 FROM users WHERE users.id = invoices.created_by)
		`, fallback.ID),
		fmt.Sprintf(`
			UPDATE payments
			SET processed_by = '%s'
			WHERE processed_by IS NULL
				OR processed_by = '00000000-0000-0000-0000-000000000000'
				OR NOT EXISTS (SELECT 1 FROM users WHERE users.id = payments.processed_by)
		`, fallback.ID),
		`ALTER TABLE invoices ADD CONSTRAINT invoices_created_by_fkey
			FOREIGN KEY (created_by) REFERENCES users(id)`,
		`ALTER TABLE payments ADD CONSTRAINT payments_processed_by_fkey
			FOREIGN KEY (processed_by) REFERENCES users(id)`,
	}

	for _, statement := range statements {
		if err := DB.Exec(statement).Error; err != nil {
			return fmt.Errorf("ARP schema alignment failed: %w", err)
		}
	}

	return nil
}

// CleanupLegacySchema removes retired tables that are no longer used by the
// application after auth/ERP ownership has been migrated to the users table.
func CleanupLegacySchema() error {
	statements := []string{
		`ALTER TABLE IF EXISTS users DROP COLUMN IF EXISTS password`,
		`ALTER TABLE IF EXISTS products DROP COLUMN IF EXISTS supplier_name`,
		`ALTER TABLE IF EXISTS products DROP COLUMN IF EXISTS purchase_price`,
		`ALTER TABLE IF EXISTS products DROP COLUMN IF EXISTS purchase_payment_method`,
		`DROP TABLE IF EXISTS admins`,
	}

	for _, statement := range statements {
		if err := DB.Exec(statement).Error; err != nil {
			return fmt.Errorf("legacy schema cleanup failed: %w", err)
		}
	}

	return nil
}

func EnsureOrderInvoiceNumberSchema() error {
	statements := []string{
		`ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_number varchar(120)`,
		`CREATE INDEX IF NOT EXISTS idx_orders_invoice_number ON orders(invoice_number)`,
		`UPDATE orders SET invoice_number = CONCAT('ORD-', UPPER(SUBSTRING(id::text, 1, 8))) WHERE invoice_number IS NULL OR TRIM(invoice_number) = ''`,
	}

	for _, statement := range statements {
		if err := DB.Exec(statement).Error; err != nil {
			return fmt.Errorf("order invoice number schema alignment failed: %w", err)
		}
	}

	var duplicateCount int64
	if err := DB.Raw(`
		SELECT COUNT(*) FROM (
			SELECT LOWER(TRIM(invoice_number))
			FROM orders
			WHERE invoice_number IS NOT NULL AND TRIM(invoice_number) <> ''
			GROUP BY LOWER(TRIM(invoice_number))
			HAVING COUNT(*) > 1
		) duplicates
	`).Scan(&duplicateCount).Error; err != nil {
		return fmt.Errorf("failed to validate order invoice uniqueness: %w", err)
	}

	if duplicateCount > 0 {
		return fmt.Errorf("order invoice number uniqueness alignment failed: found %d duplicate invoice number group(s)", duplicateCount)
	}

	if err := DB.Exec(`
		CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_invoice_number_unique
		ON orders ((LOWER(TRIM(invoice_number))))
		WHERE invoice_number IS NOT NULL AND TRIM(invoice_number) <> ''
	`).Error; err != nil {
		return fmt.Errorf("order invoice number unique index alignment failed: %w", err)
	}

	return nil
}

func EnsureSalesInvoiceSequenceSchema() error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS invoice_sequences (
			sequence_key varchar(80) PRIMARY KEY,
			last_number bigint NOT NULL,
			updated_at timestamptz DEFAULT now()
		)`,
		`INSERT INTO invoice_sequences (sequence_key, last_number)
		VALUES (
			'sales_invoice',
			GREATEST(
				14077,
				COALESCE((SELECT MAX(CASE WHEN TRIM(invoice_number) ~ '^[0-9]+$' THEN TRIM(invoice_number)::bigint END) FROM orders), 0),
				COALESCE((SELECT MAX(CASE WHEN TRIM(bill_number) ~ '^[0-9]+$' THEN TRIM(bill_number)::bigint END) FROM offline_sales), 0)
			)
		)
		ON CONFLICT (sequence_key) DO UPDATE
		SET last_number = GREATEST(
			invoice_sequences.last_number,
			EXCLUDED.last_number,
			COALESCE((SELECT MAX(CASE WHEN TRIM(invoice_number) ~ '^[0-9]+$' THEN TRIM(invoice_number)::bigint END) FROM orders), 0),
			COALESCE((SELECT MAX(CASE WHEN TRIM(bill_number) ~ '^[0-9]+$' THEN TRIM(bill_number)::bigint END) FROM offline_sales), 0)
		),
		updated_at = now()`,
	}

	for _, statement := range statements {
		if err := DB.Exec(statement).Error; err != nil {
			return fmt.Errorf("sales invoice sequence alignment failed: %w", err)
		}
	}

	return nil
}
