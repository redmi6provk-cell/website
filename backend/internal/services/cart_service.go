package services

import (
	"errors"
	"math"

	"backend/internal/models"
	"backend/internal/repository"

	"github.com/google/uuid"
)

type CartService struct {
	repo        *repository.CartRepository
	productRepo *repository.ProductRepository
}

func NewCartService(repo *repository.CartRepository, productRepo *repository.ProductRepository) *CartService {
	return &CartService{repo: repo, productRepo: productRepo}
}

func (s *CartService) GetCart(userID uuid.UUID) ([]models.Cart, error) {
	return s.repo.GetCartByUserID(userID)
}

func (s *CartService) AddToCart(userID, productID uuid.UUID, quantity int) error {
	product, err := s.productRepo.GetByID(productID.String())
	if err != nil {
		return errors.New("product not found")
	}
	if product.Stock < 1 {
		return errors.New("product is out of stock")
	}

	cartItems, err := s.repo.GetCartByUserID(userID)
	if err != nil {
		return err
	}

	currentQuantity := 0
	for _, item := range cartItems {
		if item.ProductID == productID {
			currentQuantity = item.Quantity
			break
		}
	}

	nextQuantity := int(math.Min(float64(product.Stock), float64(currentQuantity+quantity)))
	if nextQuantity <= 0 {
		return nil
	}

	cartItem := &models.Cart{
		UserID:    userID,
		ProductID: productID,
		Quantity:  nextQuantity,
	}
	return s.repo.SetCartQuantity(cartItem)
}

func (s *CartService) UpdateQuantity(cartID, userID uuid.UUID, quantity int) error {
	cartItem, err := s.repo.GetCartItem(cartID, userID)
	if err != nil {
		return err
	}
	if cartItem.Product.Stock < 1 {
		return s.repo.RemoveFromCart(cartID, userID)
	}
	cappedQuantity := int(math.Min(float64(quantity), float64(cartItem.Product.Stock)))
	return s.repo.UpdateQuantity(cartID, userID, cappedQuantity)
}

func (s *CartService) RemoveFromCart(cartID, userID uuid.UUID) error {
	return s.repo.RemoveFromCart(cartID, userID)
}

func (s *CartService) ClearCart(userID uuid.UUID) error {
	return s.repo.ClearCart(userID)
}

func (s *CartService) SyncCart(userID uuid.UUID, items []models.Cart) error {
	sanitizedItems := make([]models.Cart, 0, len(items))
	for _, item := range items {
		product, err := s.productRepo.GetByID(item.ProductID.String())
		if err != nil {
			return errors.New("product not found")
		}
		cappedQuantity := int(math.Min(float64(item.Quantity), float64(product.Stock)))
		if cappedQuantity <= 0 {
			continue
		}
		item.Quantity = cappedQuantity
		sanitizedItems = append(sanitizedItems, item)
	}
	return s.repo.SyncCart(userID, sanitizedItems)
}
