package models

import (
	"time"

	"github.com/google/uuid"
)

type Category struct {
	ID          uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Name        string    `gorm:"unique;not null" json:"name"`
	Description string    `json:"description"`
	ImageURL    string    `json:"image_url"`
	CreatedAt   time.Time `json:"created_at"`
}
