package handlers

import (
	"net/http"
	"strings"

	"backend/internal/services"
	"backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type AuthHandler struct {
	authService *services.AuthService
}

func NewAuthHandler(authService *services.AuthService) *AuthHandler {
	return &AuthHandler{authService: authService}
}

type RegisterRequest struct {
	Name     string `json:"name" binding:"required"`
	ShopName string `json:"shop_name" binding:"required"`
	Phone    string `json:"phone" binding:"required,min=10,max=15"`
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "Invalid request format or missing fields")
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	req.ShopName = strings.TrimSpace(req.ShopName)
	if req.Name == "" || req.ShopName == "" {
		response.Fail(c, http.StatusBadRequest, "Full name and shop name are required")
		return
	}

	token, user, created, err := h.authService.Register(req.Name, req.ShopName, req.Phone)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	status := http.StatusCreated
	message := "User registered successfully"
	if !created {
		status = http.StatusOK
		message = "Existing user logged in successfully"
	}

	c.JSON(status, response.APIResponse{Success: true, Message: message, Data: gin.H{
		"token": token,
		"user":  user,
	}})
}

type LoginRequest struct {
	Phone string `json:"phone" binding:"required"`
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "Invalid request format or missing fields")
		return
	}

	token, user, err := h.authService.Login(req.Phone)
	if err != nil {
		status := http.StatusBadRequest
		if err.Error() == "user not found" {
			status = http.StatusNotFound
		}
		response.Fail(c, status, err.Error())
		return
	}

	response.OK(c, "Login successful", gin.H{
		"token": token,
		"user":  user,
	})
}
