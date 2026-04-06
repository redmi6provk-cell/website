package handlers

import (
	"backend/internal/services"
	"backend/pkg/response"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"net/http"
)

type CategoryHandler struct {
	service services.CategoryService
}

func NewCategoryHandler(service services.CategoryService) *CategoryHandler {
	return &CategoryHandler{service}
}

func (h *CategoryHandler) CreateCategory(c *gin.Context) {
	var input struct {
		Name        string `json:"name" binding:"required"`
		Description string `json:"description"`
		ImageURL    string `json:"image_url"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	cat, err := h.service.CreateCategory(input.Name, input.Description, input.ImageURL)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.OK(c, "Category created successfully", cat)
}

func (h *CategoryHandler) GetAllCategories(c *gin.Context) {
	categories, err := h.service.GetAllCategories()
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.OK(c, "Categories fetched successfully", categories)
}

func (h *CategoryHandler) UpdateCategory(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	var input struct {
		Name        string `json:"name" binding:"required"`
		Description string `json:"description"`
		ImageURL    string `json:"image_url"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	category, err := h.service.UpdateCategory(id, input.Name, input.Description, input.ImageURL)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.OK(c, "Category updated successfully", category)
}

func (h *CategoryHandler) DeleteCategory(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.service.DeleteCategory(id); err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.OK(c, "Category deleted successfully", nil)
}
