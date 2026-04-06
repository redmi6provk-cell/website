package handlers

import (
	"backend/internal/services"
	"backend/pkg/response"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"net/http"
)

type BrandHandler struct {
	service services.BrandService
}

func NewBrandHandler(service services.BrandService) *BrandHandler {
	return &BrandHandler{service}
}

func (h *BrandHandler) CreateBrand(c *gin.Context) {
	var input struct {
		Name    string `json:"name" binding:"required"`
		LogoURL string `json:"logo_url"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	brand, err := h.service.CreateBrand(input.Name, input.LogoURL)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.OK(c, "Brand created successfully", brand)
}

func (h *BrandHandler) GetAllBrands(c *gin.Context) {
	brands, err := h.service.GetAllBrands()
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.OK(c, "Brands fetched successfully", brands)
}

func (h *BrandHandler) UpdateBrand(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	var input struct {
		Name    string `json:"name" binding:"required"`
		LogoURL string `json:"logo_url"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	brand, err := h.service.UpdateBrand(id, input.Name, input.LogoURL)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.OK(c, "Brand updated successfully", brand)
}

func (h *BrandHandler) DeleteBrand(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.service.DeleteBrand(id); err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.OK(c, "Brand deleted successfully", nil)
}
