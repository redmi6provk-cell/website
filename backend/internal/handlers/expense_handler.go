package handlers

import (
	"net/http"
	"time"

	"backend/internal/models"
	"backend/internal/services"
	"backend/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type ExpenseHandler struct {
	service *services.ExpenseService
}

type expenseRequest struct {
	Date          string  `json:"date"`
	Description   string  `json:"description"`
	Category      string  `json:"category"`
	PaymentMethod string  `json:"payment_method"`
	Amount        float64 `json:"amount"`
	Note          string  `json:"note"`
}

func NewExpenseHandler(service *services.ExpenseService) *ExpenseHandler {
	return &ExpenseHandler{service: service}
}

func (h *ExpenseHandler) GetExpenses(c *gin.Context) {
	expenses, err := h.service.GetAll()
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "Failed to fetch expenses")
		return
	}
	response.OK(c, "Expenses fetched successfully", expenses)
}

func (h *ExpenseHandler) CreateExpense(c *gin.Context) {
	var req expenseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "Invalid request payload")
		return
	}

	userID, ok := getAuthenticatedUserID(c)
	if !ok {
		response.Fail(c, http.StatusUnauthorized, "invalid authenticated user")
		return
	}

	expense, err := buildExpenseModel(req)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}
	expense.CreatedBy = userID

	if err := h.service.Create(&expense); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	response.Created(c, "Expense created successfully", expense)
}

func (h *ExpenseHandler) UpdateExpense(c *gin.Context) {
	var req expenseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "Invalid request payload")
		return
	}

	userID, ok := getAuthenticatedUserID(c)
	if !ok {
		response.Fail(c, http.StatusUnauthorized, "invalid authenticated user")
		return
	}

	parsedID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "Invalid expense id")
		return
	}

	expense, err := buildExpenseModel(req)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}
	expense.ID = parsedID
	expense.CreatedBy = userID

	if err := h.service.Update(&expense); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	response.OK(c, "Expense updated successfully", expense)
}

func (h *ExpenseHandler) DeleteExpense(c *gin.Context) {
	if err := h.service.Delete(c.Param("id")); err != nil {
		response.Fail(c, http.StatusInternalServerError, "Failed to delete expense")
		return
	}
	response.OK(c, "Expense deleted successfully", nil)
}

func buildExpenseModel(req expenseRequest) (models.Expense, error) {
	expenseDate, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		return models.Expense{}, err
	}

	return models.Expense{
		Date:          expenseDate,
		Description:   req.Description,
		Category:      req.Category,
		PaymentMethod: req.PaymentMethod,
		Amount:        req.Amount,
		Note:          req.Note,
	}, nil
}
