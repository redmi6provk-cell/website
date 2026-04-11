package config

import "fmt"

func EnsureProductImageSchema() error {
	statements := []string{
		`ALTER TABLE products ADD COLUMN IF NOT EXISTS secondary_image_url text`,
	}

	for _, statement := range statements {
		if err := DB.Exec(statement).Error; err != nil {
			return fmt.Errorf("product image schema alignment failed: %w", err)
		}
	}

	return nil
}
