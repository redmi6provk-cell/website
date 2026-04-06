package repository

import (
	"backend/internal/models"
	"errors"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrProductHasOrders = errors.New("product is linked to existing orders and cannot be deleted")

type ProductRepository struct {
	db *gorm.DB
}

func NewProductRepository(db *gorm.DB) *ProductRepository {
	return &ProductRepository{db: db}
}

func (r *ProductRepository) GetAll(category, brand, sort string, minPrice, maxPrice float64, offset, limit int) ([]models.Product, int64, error) {
	var products []models.Product
	var total int64

	query := r.db.Model(&models.Product{}).Preload("Category").Preload("Brand")

	if category != "" {
		query = query.Where("category_id = ?", category)
	}
	if brand != "" {
		query = query.Where("brand_id = ?", brand)
	}
	if minPrice > 0 {
		query = query.Where("price >= ?", minPrice)
	}
	if maxPrice > 0 {
		query = query.Where("price <= ?", maxPrice)
	}

	query.Count(&total)

	switch sort {
	case "price_asc":
		query = query.Order("price asc")
	case "price_desc":
		query = query.Order("price desc")
	case "newest":
		query = query.Order("created_at desc")
	}

	if limit > 0 {
		query = query.Offset(offset).Limit(limit)
	}

	err := query.Find(&products).Error
	return products, total, err
}

func (r *ProductRepository) GetByID(id string) (*models.Product, error) {
	var product models.Product
	if err := r.db.Preload("Category").Preload("Brand").Where("id = ?", id).First(&product).Error; err != nil {
		return nil, err
	}
	return &product, nil
}

func (r *ProductRepository) Create(product *models.Product) error {
	return r.db.Create(product).Error
}

func (r *ProductRepository) Update(product *models.Product) error {
	return r.db.Save(product).Error
}

func (r *ProductRepository) Delete(id string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var orderItemCount int64
		if err := tx.Model(&models.OrderItem{}).Where("product_id = ?", id).Count(&orderItemCount).Error; err != nil {
			return err
		}
		if orderItemCount > 0 {
			return ErrProductHasOrders
		}

		if err := tx.Where("product_id = ?", id).Delete(&models.Cart{}).Error; err != nil {
			return err
		}

		return tx.Where("id = ?", id).Delete(&models.Product{}).Error
	})
}

func (r *ProductRepository) UpdateStock(id string, stock int) error {
	return r.db.Model(&models.Product{}).Where("id = ?", id).Update("stock", stock).Error
}

func (r *ProductRepository) ReduceStock(id string, quantity int) error {
	result := r.db.Model(&models.Product{}).
		Where("id = ? AND stock >= ?", id, quantity).
		Update("stock", gorm.Expr("stock - ?", quantity))
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *ProductRepository) BulkUpsert(products []models.Product) error {
	return r.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "name"}},
		DoUpdates: clause.AssignmentColumns([]string{"price", "stock", "category_id", "brand_id", "unit", "discount", "description", "minimum_order_quantity", "quantity_discounts"}),
	}).Create(&products).Error
}
