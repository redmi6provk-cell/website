package services

import (
	"backend/internal/models"
	"backend/internal/repository"
	"github.com/google/uuid"
)

type CategoryService interface {
	CreateCategory(name, description, imageURL string) (*models.Category, error)
	GetAllCategories() ([]models.Category, error)
	UpdateCategory(id uuid.UUID, name, description, imageURL string) (*models.Category, error)
	DeleteCategory(id uuid.UUID) error
}

type categoryService struct {
	repo repository.CategoryRepository
}

func NewCategoryService(repo repository.CategoryRepository) CategoryService {
	return &categoryService{repo}
}

func (s *categoryService) CreateCategory(name, description, imageURL string) (*models.Category, error) {
	cat := &models.Category{
		Name:        name,
		Description: description,
		ImageURL:    imageURL,
	}
	err := s.repo.Create(cat)
	return cat, err
}

func (s *categoryService) GetAllCategories() ([]models.Category, error) {
	return s.repo.GetAll()
}

func (s *categoryService) UpdateCategory(id uuid.UUID, name, description, imageURL string) (*models.Category, error) {
	category, err := s.repo.GetByID(id)
	if err != nil {
		return nil, err
	}

	category.Name = name
	category.Description = description
	category.ImageURL = imageURL

	if err := s.repo.Update(category); err != nil {
		return nil, err
	}

	return category, nil
}

func (s *categoryService) DeleteCategory(id uuid.UUID) error {
	return s.repo.Delete(id)
}
