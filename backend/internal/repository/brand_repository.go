package repository

import (
	"backend/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type BrandRepository interface {
	Create(brand *models.Brand) error
	GetAll() ([]models.Brand, error)
	GetByID(id uuid.UUID) (*models.Brand, error)
	Update(brand *models.Brand) error
	Delete(id uuid.UUID) error
}

type brandRepository struct {
	db *gorm.DB
}

func NewBrandRepository(db *gorm.DB) BrandRepository {
	return &brandRepository{db}
}

func (r *brandRepository) Create(brand *models.Brand) error {
	return r.db.Create(brand).Error
}

func (r *brandRepository) GetAll() ([]models.Brand, error) {
	var brands []models.Brand
	err := r.db.Find(&brands).Error
	return brands, err
}

func (r *brandRepository) GetByID(id uuid.UUID) (*models.Brand, error) {
	var brand models.Brand
	err := r.db.First(&brand, "id = ?", id).Error
	return &brand, err
}

func (r *brandRepository) Update(brand *models.Brand) error {
	return r.db.Save(brand).Error
}

func (r *brandRepository) Delete(id uuid.UUID) error {
	return r.db.Delete(&models.Brand{}, "id = ?", id).Error
}
