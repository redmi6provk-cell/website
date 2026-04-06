package repository

import (
	"backend/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type CartRepository struct {
	db *gorm.DB
}

func NewCartRepository(db *gorm.DB) *CartRepository {
	return &CartRepository{db: db}
}

func (r *CartRepository) GetCartByUserID(userID uuid.UUID) ([]models.Cart, error) {
	var cartItems []models.Cart
	err := r.db.
		Preload("Product").
		Preload("Product.Brand").
		Preload("Product.Category").
		Where("user_id = ?", userID).
		Find(&cartItems).Error
	return cartItems, err
}

func (r *CartRepository) AddToCart(cartItem *models.Cart) error {
	return r.db.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "user_id"}, {Name: "product_id"}},
		DoUpdates: clause.Assignments(map[string]interface{}{
			"quantity": gorm.Expr("carts.quantity + ?", cartItem.Quantity),
		}),
	}).Create(cartItem).Error
}

func (r *CartRepository) SetCartQuantity(cartItem *models.Cart) error {
	return r.db.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "user_id"}, {Name: "product_id"}},
		DoUpdates: clause.Assignments(map[string]interface{}{
			"quantity": cartItem.Quantity,
		}),
	}).Create(cartItem).Error
}

func (r *CartRepository) UpdateQuantity(cartID uuid.UUID, userID uuid.UUID, quantity int) error {
	return r.db.Model(&models.Cart{}).Where("id = ? AND user_id = ?", cartID, userID).Update("quantity", quantity).Error
}

func (r *CartRepository) GetCartItem(cartID, userID uuid.UUID) (*models.Cart, error) {
	var cartItem models.Cart
	err := r.db.Preload("Product").Where("id = ? AND user_id = ?", cartID, userID).First(&cartItem).Error
	return &cartItem, err
}

func (r *CartRepository) RemoveFromCart(cartID uuid.UUID, userID uuid.UUID) error {
	return r.db.Where("id = ? AND user_id = ?", cartID, userID).Delete(&models.Cart{}).Error
}

func (r *CartRepository) ClearCart(userID uuid.UUID) error {
	return r.db.Where("user_id = ?", userID).Delete(&models.Cart{}).Error
}

func (r *CartRepository) SyncCart(userID uuid.UUID, items []models.Cart) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("user_id = ?", userID).Delete(&models.Cart{}).Error; err != nil {
			return err
		}

		if len(items) == 0 {
			return nil
		}

		for i := range items {
			items[i].UserID = userID
		}

		return tx.Create(&items).Error
	})
}
