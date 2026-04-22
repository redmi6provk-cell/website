package services

import (
	"errors"
	"mime/multipart"

	"backend/internal/models"
	"backend/internal/repository"
	"backend/pkg/csv"
)

type ProductService struct {
	repo *repository.ProductRepository
}

func NewProductService(repo *repository.ProductRepository) *ProductService {
	return &ProductService{repo: repo}
}

func (s *ProductService) GetAll(category, brand, sort string, minPrice, maxPrice float64, offset, limit int) ([]models.Product, int64, error) {
	return s.repo.GetAll(category, brand, sort, minPrice, maxPrice, offset, limit, false)
}

func (s *ProductService) GetByID(id string) (*models.Product, error) {
	return s.repo.GetByID(id, false)
}

func (s *ProductService) GetAllForAdmin(category, brand, sort string, minPrice, maxPrice float64, offset, limit int) ([]models.Product, int64, error) {
	return s.repo.GetAll(category, brand, sort, minPrice, maxPrice, offset, limit, true)
}

func (s *ProductService) GetByIDForAdmin(id string) (*models.Product, error) {
	return s.repo.GetByID(id, true)
}

func (s *ProductService) GetTransactions(id string) ([]models.ProductTransaction, error) {
	return s.repo.GetTransactions(id)
}

func (s *ProductService) Create(product *models.Product) error {
	product.NormalizePricingRules()
	if err := product.ValidatePricingRules(); err != nil {
		return err
	}
	return s.repo.Create(product)
}

func (s *ProductService) Update(product *models.Product) error {
	product.NormalizePricingRules()
	if err := product.ValidatePricingRules(); err != nil {
		return err
	}
	return s.repo.Update(product)
}

func (s *ProductService) Delete(id string) error {
	return s.repo.Delete(id)
}

func (s *ProductService) SetActive(id string, isActive bool) error {
	return s.repo.SetActive(id, isActive)
}

func (s *ProductService) IsProductDeleteBlocked(err error) bool {
	return errors.Is(err, repository.ErrProductHasOrders)
}

func (s *ProductService) UpdateStock(id string, stock int) error {
	return s.repo.UpdateStock(id, stock)
}

func (s *ProductService) ReduceStock(id string, quantity int) error {
	return s.repo.ReduceStock(id, quantity)
}

func (s *ProductService) BulkUploadCSV(file multipart.File) ([]string, error) {
	products, parseErrors := csv.ParseProductCSV(file)
	if len(products) > 0 {
		if err := s.repo.BulkUpsert(products); err != nil {
			parseErrors = append(parseErrors, "Database upsert failed: "+err.Error())
		}
	}
	return parseErrors, nil
}
