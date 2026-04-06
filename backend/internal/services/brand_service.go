package services

import (
	"backend/internal/models"
	"backend/internal/repository"
	"github.com/google/uuid"
)

type BrandService interface {
	CreateBrand(name, logoURL string) (*models.Brand, error)
	GetAllBrands() ([]models.Brand, error)
	UpdateBrand(id uuid.UUID, name, logoURL string) (*models.Brand, error)
	DeleteBrand(id uuid.UUID) error
}

type brandService struct {
	repo repository.BrandRepository
}

func NewBrandService(repo repository.BrandRepository) BrandService {
	return &brandService{repo}
}

func (s *brandService) CreateBrand(name, logoURL string) (*models.Brand, error) {
	brand := &models.Brand{
		Name:    name,
		LogoURL: logoURL,
	}
	err := s.repo.Create(brand)
	return brand, err
}

func (s *brandService) GetAllBrands() ([]models.Brand, error) {
	return s.repo.GetAll()
}

func (s *brandService) UpdateBrand(id uuid.UUID, name, logoURL string) (*models.Brand, error) {
	brand, err := s.repo.GetByID(id)
	if err != nil {
		return nil, err
	}

	brand.Name = name
	brand.LogoURL = logoURL

	if err := s.repo.Update(brand); err != nil {
		return nil, err
	}

	return brand, nil
}

func (s *brandService) DeleteBrand(id uuid.UUID) error {
	return s.repo.Delete(id)
}
