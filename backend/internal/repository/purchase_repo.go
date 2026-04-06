package repository

import (
	"backend/internal/models"
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var ErrPurchaseStockConflict = errors.New("purchase stock update would make product stock negative")

type PurchaseRepository struct {
	db *gorm.DB
}

func NewPurchaseRepository(db *gorm.DB) *PurchaseRepository {
	return &PurchaseRepository{db: db}
}

func (r *PurchaseRepository) GetAll() ([]models.Purchase, error) {
	var purchases []models.Purchase
	err := r.db.Preload("Items").Preload("SupplierParty").Order("date desc, created_at desc").Find(&purchases).Error
	return purchases, err
}

func (r *PurchaseRepository) GetByID(id string) (*models.Purchase, error) {
	var purchase models.Purchase
	if err := r.db.Preload("Items").Preload("SupplierParty").First(&purchase, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &purchase, nil
}

func (r *PurchaseRepository) Create(purchase *models.Purchase) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		purchase.TotalAmount = 0
		for _, item := range purchase.Items {
			purchase.TotalAmount += item.LineTotal
		}

		if err := tx.Create(purchase).Error; err != nil {
			return err
		}

		for _, item := range purchase.Items {
			if err := tx.Model(&models.Product{}).
				Where("id = ?", item.ProductID).
				Update("stock", gorm.Expr("stock + ?", item.Quantity)).Error; err != nil {
				return err
			}
		}

		return nil
	})
}

func (r *PurchaseRepository) Update(purchase *models.Purchase) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var existing models.Purchase
		if err := tx.Preload("Items").First(&existing, "id = ?", purchase.ID).Error; err != nil {
			return err
		}

		existingQty := make(map[uuid.UUID]int)
		for _, item := range existing.Items {
			existingQty[item.ProductID] += item.Quantity
		}

		newQty := make(map[uuid.UUID]int)
		totalAmount := 0.0
		for _, item := range purchase.Items {
			newQty[item.ProductID] += item.Quantity
			totalAmount += item.LineTotal
		}
		purchase.TotalAmount = totalAmount

		productIDs := make(map[uuid.UUID]struct{})
		for id := range existingQty {
			productIDs[id] = struct{}{}
		}
		for id := range newQty {
			productIDs[id] = struct{}{}
		}

		for productID := range productIDs {
			delta := newQty[productID] - existingQty[productID]
			if delta == 0 {
				continue
			}

			result := tx.Model(&models.Product{}).
				Where("id = ? AND stock + ? >= 0", productID, delta).
				Update("stock", gorm.Expr("stock + ?", delta))
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected == 0 {
				return ErrPurchaseStockConflict
			}
		}

		if err := tx.Model(&models.Purchase{}).Where("id = ?", purchase.ID).Updates(map[string]interface{}{
			"date":           purchase.Date,
			"invoice_number": purchase.InvoiceNumber,
			"supplier_party_id": purchase.SupplierPartyID,
			"supplier_name":  purchase.SupplierName,
			"payment_status": purchase.PaymentStatus,
			"payment_method": purchase.PaymentMethod,
			"notes":          purchase.Notes,
			"total_amount":   purchase.TotalAmount,
			"created_by":     purchase.CreatedBy,
		}).Error; err != nil {
			return err
		}

		if err := tx.Where("purchase_id = ?", purchase.ID).Delete(&models.PurchaseItem{}).Error; err != nil {
			return err
		}

		for index := range purchase.Items {
			purchase.Items[index].PurchaseID = purchase.ID
		}

		return tx.Create(&purchase.Items).Error
	})
}

func (r *PurchaseRepository) Delete(id string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var purchase models.Purchase
		if err := tx.Preload("Items").First(&purchase, "id = ?", id).Error; err != nil {
			return err
		}

		for _, item := range purchase.Items {
			result := tx.Model(&models.Product{}).
				Where("id = ? AND stock >= ?", item.ProductID, item.Quantity).
				Update("stock", gorm.Expr("stock - ?", item.Quantity))
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected == 0 {
				return ErrPurchaseStockConflict
			}
		}

		return tx.Delete(&purchase).Error
	})
}
