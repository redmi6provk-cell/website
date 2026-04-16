package config

import "fmt"

func EnsureProductActiveSchema() error {
	statements := []string{
		`ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true`,
		`UPDATE products SET is_active = true WHERE is_active IS NULL`,
	}

	for _, statement := range statements {
		if err := DB.Exec(statement).Error; err != nil {
			return fmt.Errorf("product active schema alignment failed: %w", err)
		}
	}

	return nil
}
