package repository

import (
	"backend/internal/models"
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var ErrOfflineSaleStockConflict = errors.New("offline sale stock update would make product stock negative")

type OfflineSaleRepository struct {
	db *gorm.DB
}

func NewOfflineSaleRepository(db *gorm.DB) *OfflineSaleRepository {
	return &OfflineSaleRepository{db: db}
}

func (r *OfflineSaleRepository) GetAll() ([]models.OfflineSale, error) {
	var sales []models.OfflineSale
	err := r.db.Preload("Items").Order("sale_date desc, created_at desc").Find(&sales).Error
	return sales, err
}

func (r *OfflineSaleRepository) GetByID(id string) (*models.OfflineSale, error) {
	var sale models.OfflineSale
	if err := r.db.Preload("Items").First(&sale, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &sale, nil
}

func (r *OfflineSaleRepository) Create(sale *models.OfflineSale) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(sale).Error; err != nil {
			return err
		}

		for _, item := range sale.Items {
			result := tx.Model(&models.Product{}).
				Where("id = ? AND stock >= ?", item.ProductID, item.Quantity).
				Update("stock", gorm.Expr("stock - ?", item.Quantity))
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected == 0 {
				return ErrOfflineSaleStockConflict
			}
		}

		return nil
	})
}

func (r *OfflineSaleRepository) Update(sale *models.OfflineSale) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var existing models.OfflineSale
		if err := tx.Preload("Items").First(&existing, "id = ?", sale.ID).Error; err != nil {
			return err
		}

		existingQty := make(map[uuid.UUID]int)
		for _, item := range existing.Items {
			existingQty[item.ProductID] += item.Quantity
		}

		newQty := make(map[uuid.UUID]int)
		for _, item := range sale.Items {
			newQty[item.ProductID] += item.Quantity
		}

		productIDs := make(map[uuid.UUID]struct{})
		for id := range existingQty {
			productIDs[id] = struct{}{}
		}
		for id := range newQty {
			productIDs[id] = struct{}{}
		}

		for productID := range productIDs {
			delta := existingQty[productID] - newQty[productID]
			if delta == 0 {
				continue
			}

			if delta > 0 {
				result := tx.Model(&models.Product{}).
					Where("id = ?", productID).
					Update("stock", gorm.Expr("stock + ?", delta))
				if result.Error != nil {
					return result.Error
				}
				continue
			}

			result := tx.Model(&models.Product{}).
				Where("id = ? AND stock >= ?", productID, -delta).
				Update("stock", gorm.Expr("stock - ?", -delta))
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected == 0 {
				return ErrOfflineSaleStockConflict
			}
		}

		if err := tx.Model(&models.OfflineSale{}).Where("id = ?", sale.ID).Updates(map[string]interface{}{
			"bill_number":       sale.BillNumber,
			"sale_date":         sale.SaleDate,
			"customer_party_id": sale.CustomerPartyID,
			"customer_name":     sale.CustomerName,
			"customer_phone":    sale.CustomerPhone,
			"shop_name":         sale.ShopName,
			"payment_mode":      sale.PaymentMode,
			"notes":             sale.Notes,
			"subtotal":          sale.Subtotal,
			"discount_total":    sale.DiscountTotal,
			"final_total":       sale.FinalTotal,
			"amount_received":   sale.AmountReceived,
			"balance_due":       sale.BalanceDue,
			"status":            sale.Status,
			"created_by":        sale.CreatedBy,
		}).Error; err != nil {
			return err
		}

		if err := tx.Where("offline_sale_id = ?", sale.ID).Delete(&models.OfflineSaleItem{}).Error; err != nil {
			return err
		}

		for index := range sale.Items {
			sale.Items[index].OfflineSaleID = sale.ID
		}

		return tx.Create(&sale.Items).Error
	})
}

func (r *OfflineSaleRepository) Delete(id string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var sale models.OfflineSale
		if err := tx.Preload("Items").First(&sale, "id = ?", id).Error; err != nil {
			return err
		}

		for _, item := range sale.Items {
			result := tx.Model(&models.Product{}).
				Where("id = ?", item.ProductID).
				Update("stock", gorm.Expr("stock + ?", item.Quantity))
			if result.Error != nil {
				return result.Error
			}
		}

		return tx.Delete(&sale).Error
	})
}
