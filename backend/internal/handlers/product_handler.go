package handlers

import (
	"net/http"
	"strconv"

	"backend/internal/models"
	"backend/internal/services"
	"backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type ProductHandler struct {
	productService *services.ProductService
}

func NewProductHandler(productService *services.ProductService) *ProductHandler {
	return &ProductHandler{productService: productService}
}

func (h *ProductHandler) GetProducts(c *gin.Context) {
	category := c.Query("category")
	brand := c.Query("brand")
	sort := c.Query("sort")
	minPrice, _ := strconv.ParseFloat(c.Query("minPrice"), 64)
	maxPrice, _ := strconv.ParseFloat(c.Query("maxPrice"), 64)

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset := (page - 1) * limit

	products, total, err := h.productService.GetAll(category, brand, sort, minPrice, maxPrice, offset, limit)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "Failed to fetch products")
		return
	}

	response.OK(c, "Products fetched successfully", gin.H{
		"items": products,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

func (h *ProductHandler) GetProductByID(c *gin.Context) {
	id := c.Param("id")
	product, err := h.productService.GetByID(id)
	if err != nil {
		response.Fail(c, http.StatusNotFound, "Product not found")
		return
	}
	response.OK(c, "Product details", product)
}

// Admin Endpoints Below

func (h *ProductHandler) CreateProduct(c *gin.Context) {
	var product models.Product
	if err := c.ShouldBindJSON(&product); err != nil {
		response.Fail(c, http.StatusBadRequest, "Invalid request payload")
		return
	}
	if err := h.productService.Create(&product); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}
	response.Created(c, "Product created successfully", product)
}

func (h *ProductHandler) UpdateProduct(c *gin.Context) {
	id := c.Param("id")
	product, err := h.productService.GetByID(id)
	if err != nil {
		response.Fail(c, http.StatusNotFound, "Product not found")
		return
	}

	if err := c.ShouldBindJSON(&product); err != nil {
		response.Fail(c, http.StatusBadRequest, "Invalid request payload")
		return
	}

	if err := h.productService.Update(product); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}
	response.OK(c, "Product updated successfully", product)
}

func (h *ProductHandler) DeleteProduct(c *gin.Context) {
	id := c.Param("id")
	if err := h.productService.Delete(id); err != nil {
		if h.productService.IsProductDeleteBlocked(err) {
			response.Fail(c, http.StatusConflict, "Product delete nahi ho sakta because ye existing orders me use ho chuka hai.")
			return
		}
		response.Fail(c, http.StatusInternalServerError, "Failed to delete product")
		return
	}
	response.OK(c, "Product deleted successfully", nil)
}

func (h *ProductHandler) UpdateStock(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Stock int `json:"stock"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "Invalid stock value")
		return
	}
	if err := h.productService.UpdateStock(id, req.Stock); err != nil {
		response.Fail(c, http.StatusInternalServerError, "Failed to update stock")
		return
	}
	response.OK(c, "Stock updated successfully", nil)
}

func (h *ProductHandler) BulkUploadCSV(c *gin.Context) {
	file, _, err := c.Request.FormFile("file")
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "Failed to retrieve file from request")
		return
	}
	defer file.Close()

	errors, err := h.productService.BulkUploadCSV(file)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	if len(errors) > 0 {
		response.OK(c, "CSV processed with some errors", gin.H{"errors": errors})
		return
	}

	response.OK(c, "Bulk upload successful", nil)
}
