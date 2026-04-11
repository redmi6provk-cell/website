package repository

import (
	"backend/internal/models"
	"strings"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type UserRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) Create(user *models.User) (*models.User, error) {
	if err := r.db.Create(user).Error; err != nil {
		return nil, err
	}
	return user, nil
}

func (r *UserRepository) FindByPhone(phone string) (*models.User, error) {
	var user models.User
	if err := r.db.Where("phone = ?", phone).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) FindByID(id uuid.UUID) (*models.User, error) {
	var user models.User
	if err := r.db.Where("id = ?", id).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) FindByIDString(id string) (*models.User, error) {
	parsedID, err := uuid.Parse(id)
	if err != nil {
		return nil, err
	}
	return r.FindByID(parsedID)
}

func (r *UserRepository) Update(user *models.User) error {
	return r.db.Save(user).Error
}

func (r *UserRepository) UpdateCheckoutAddress(userID uuid.UUID, addressLine, pincode, city, state string) error {
	updates := map[string]interface{}{
		"address_line": strings.TrimSpace(addressLine),
		"pincode":      strings.TrimSpace(pincode),
		"city":         strings.TrimSpace(city),
		"state":        strings.TrimSpace(state),
	}

	return r.db.Model(&models.User{}).Where("id = ?", userID).Updates(updates).Error
}

func (r *UserRepository) FindOrCreateByPhone(user *models.User) (*models.User, bool, error) {
	var existing models.User
	err := r.db.Where("phone = ?", user.Phone).First(&existing).Error
	if err == nil {
		return &existing, false, nil
	}
	if err != gorm.ErrRecordNotFound {
		return nil, false, err
	}

	if err := r.db.Clauses(clause.OnConflict{DoNothing: true}).Create(user).Error; err != nil {
		return nil, false, err
	}

	if user.ID != uuid.Nil {
		return user, true, nil
	}

	if err := r.db.Where("phone = ?", user.Phone).First(&existing).Error; err != nil {
		return nil, false, err
	}

	return &existing, false, nil
}
