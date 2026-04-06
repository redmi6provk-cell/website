package repository

import (
	"backend/internal/models"

	"gorm.io/gorm"
)

type ExpenseRepository struct {
	db *gorm.DB
}

func NewExpenseRepository(db *gorm.DB) *ExpenseRepository {
	return &ExpenseRepository{db: db}
}

func (r *ExpenseRepository) GetAll() ([]models.Expense, error) {
	var expenses []models.Expense
	err := r.db.Order("date desc, created_at desc").Find(&expenses).Error
	return expenses, err
}

func (r *ExpenseRepository) GetByID(id string) (*models.Expense, error) {
	var expense models.Expense
	if err := r.db.First(&expense, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &expense, nil
}

func (r *ExpenseRepository) Create(expense *models.Expense) error {
	return r.db.Create(expense).Error
}

func (r *ExpenseRepository) Update(expense *models.Expense) error {
	return r.db.Model(&models.Expense{}).Where("id = ?", expense.ID).Updates(map[string]interface{}{
		"date":           expense.Date,
		"description":    expense.Description,
		"category":       expense.Category,
		"payment_method": expense.PaymentMethod,
		"amount":         expense.Amount,
		"note":           expense.Note,
		"created_by":     expense.CreatedBy,
	}).Error
}

func (r *ExpenseRepository) Delete(id string) error {
	return r.db.Delete(&models.Expense{}, "id = ?", id).Error
}
