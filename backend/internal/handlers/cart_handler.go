package handlers

import (
	"net/http"

	"backend/internal/models"
	"backend/internal/services"
	"backend/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type CartHandler struct {
	cartService *services.CartService
}

func NewCartHandler(cartService *services.CartService) *CartHandler {
	return &CartHandler{cartService: cartService}
}

func getUserID(c *gin.Context) (uuid.UUID, bool) {
	val, exists := c.Get("userID")
	if !exists {
		return uuid.Nil, false
	}
	return val.(uuid.UUID), true
}

func (h *CartHandler) GetCart(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		response.Fail(c, http.StatusUnauthorized, "Unauthorized")
		return
	}

	cart, err := h.cartService.GetCart(userID)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "Failed to fetch cart")
		return
	}
	response.OK(c, "Cart fetched successfully", cart)
}

func (h *CartHandler) AddToCart(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		response.Fail(c, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req struct {
		ProductID string `json:"product_id" binding:"required"`
		Quantity  int    `json:"quantity" binding:"required,min=1"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "Invalid request payload")
		return
	}

	productUUID, err := uuid.Parse(req.ProductID)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "Invalid product ID")
		return
	}

	if err := h.cartService.AddToCart(userID, productUUID, req.Quantity); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	response.OK(c, "Product added to cart", nil)
}

func (h *CartHandler) UpdateCart(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		response.Fail(c, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req struct {
		CartID   string `json:"cart_id" binding:"required"`
		Quantity int    `json:"quantity" binding:"required,min=1"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "Invalid request payload")
		return
	}

	cartUUID, err := uuid.Parse(req.CartID)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "Invalid cart ID")
		return
	}

	if err := h.cartService.UpdateQuantity(cartUUID, userID, req.Quantity); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}
	response.OK(c, "Cart updated successfully", nil)
}

func (h *CartHandler) RemoveFromCart(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		response.Fail(c, http.StatusUnauthorized, "Unauthorized")
		return
	}

	cartID := c.Param("id")
	cartUUID, err := uuid.Parse(cartID)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "Invalid cart ID")
		return
	}

	if err := h.cartService.RemoveFromCart(cartUUID, userID); err != nil {
		response.Fail(c, http.StatusInternalServerError, "Failed to remove item")
		return
	}
	response.OK(c, "Item removed from cart", nil)
}

func (h *CartHandler) SyncCart(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		response.Fail(c, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req struct {
		Items []struct {
			ProductID string `json:"product_id" binding:"required"`
			Quantity  int    `json:"quantity" binding:"required,min=1"`
		} `json:"items"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "Invalid request payload")
		return
	}

	cartItems := make([]models.Cart, 0, len(req.Items))
	for _, item := range req.Items {
		productUUID, err := uuid.Parse(item.ProductID)
		if err != nil {
			response.Fail(c, http.StatusBadRequest, "Invalid product ID")
			return
		}
		cartItems = append(cartItems, models.Cart{
			UserID:    userID,
			ProductID: productUUID,
			Quantity:  item.Quantity,
		})
	}

	if err := h.cartService.SyncCart(userID, cartItems); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	response.OK(c, "Cart synced successfully", nil)
}
