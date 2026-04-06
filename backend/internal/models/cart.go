package models

import "github.com/google/uuid"

type Cart struct {
	ID        uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID    uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_user_product" json:"user_id"`
	ProductID uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_user_product" json:"product_id"`
	Product   Product   `gorm:"foreignKey:ProductID" json:"product"`
	Quantity  int       `gorm:"default:1" json:"quantity"`
}
