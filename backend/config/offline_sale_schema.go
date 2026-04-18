package config

import "fmt"

func EnsureOfflineSalePartySchema() error {
	statements := []string{
		`ALTER TABLE offline_sales ADD COLUMN IF NOT EXISTS customer_party_id uuid`,
		`CREATE INDEX IF NOT EXISTS idx_offline_sales_customer_party_id ON offline_sales(customer_party_id)`,
		`UPDATE offline_sales AS os
		SET customer_party_id = pc.party_id
		FROM party_contacts AS pc
		JOIN parties AS pa ON pa.party_id = pc.party_id
		WHERE os.customer_party_id IS NULL
			AND pa.type = 'customer'
			AND pc.contact_type = 'phone'
			AND TRIM(COALESCE(pc.contact_value, '')) <> ''
			AND TRIM(COALESCE(os.customer_phone, '')) <> ''
			AND TRIM(pc.contact_value) = TRIM(os.customer_phone)`,
	}

	for _, statement := range statements {
		if err := DB.Exec(statement).Error; err != nil {
			return fmt.Errorf("offline sale party schema alignment failed: %w", err)
		}
	}

	return nil
}
