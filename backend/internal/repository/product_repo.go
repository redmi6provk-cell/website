package repository

import (
	"backend/internal/models"
	"errors"

	"github.com/google/uuid"
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

func (r *ProductRepository) GetAll(category, brand, sort string, minPrice, maxPrice float64, offset, limit int, includeInactive bool) ([]models.Product, int64, error) {
	var products []models.Product
	var total int64

	query := r.db.Model(&models.Product{}).Preload("Category").Preload("Brand")
	if !includeInactive {
		query = query.Where("is_active = ?", true)
	}

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
	if err != nil {
		return nil, 0, err
	}

	if includeInactive {
		if err := r.attachDeleteAvailability(products); err != nil {
			return nil, 0, err
		}
	}

	return products, total, err
}

func (r *ProductRepository) GetByID(id string, includeInactive bool) (*models.Product, error) {
	var product models.Product
	query := r.db.Preload("Category").Preload("Brand").Where("id = ?", id)
	if !includeInactive {
		query = query.Where("is_active = ?", true)
	}
	if err := query.First(&product).Error; err != nil {
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

func (r *ProductRepository) SetActive(id string, isActive bool) error {
	return r.db.Model(&models.Product{}).Where("id = ?", id).Update("is_active", isActive).Error
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
		DoUpdates: clause.AssignmentColumns([]string{"price", "stock", "category_id", "brand_id", "unit", "discount", "description", "minimum_order_quantity", "quantity_discounts", "image_url", "secondary_image_url", "is_active"}),
	}).Create(&products).Error
}

func (r *ProductRepository) attachDeleteAvailability(products []models.Product) error {
	if len(products) == 0 {
		return nil
	}

	productIDs := make([]uuid.UUID, 0, len(products))
	for _, product := range products {
		productIDs = append(productIDs, product.ID)
	}

	type orderLinkCount struct {
		ProductID uuid.UUID
		Count     int64
	}

	var linked []orderLinkCount
	if err := r.db.Model(&models.OrderItem{}).
		Select("product_id, COUNT(*) as count").
		Where("product_id IN ?", productIDs).
		Group("product_id").
		Scan(&linked).Error; err != nil {
		return err
	}

	linkedMap := make(map[uuid.UUID]int64, len(linked))
	for _, item := range linked {
		linkedMap[item.ProductID] = item.Count
	}

	for i := range products {
		products[i].CanDelete = linkedMap[products[i].ID] == 0
	}

	return nil
}
