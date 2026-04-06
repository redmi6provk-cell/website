package models

import (
	"time"

	"github.com/google/uuid"
)

const (
	RoleUser       = "USER"
	RoleAccountant = "ACCOUNTANT"
	RoleAdmin      = "ADMIN"
	RoleSuperAdmin = "SUPERADMIN"
)

type User struct {
	ID           uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Name         string     `json:"name"`
	ShopName     string     `gorm:"not null;default:'';type:varchar(120)" json:"shop_name"`
	Phone        string     `gorm:"unique;not null;type:varchar(15)" json:"phone"`
	AddressLine  string     `gorm:"type:text;default:''" json:"address_line"`
	Pincode      string     `gorm:"type:varchar(6);default:''" json:"pincode"`
	City         string     `gorm:"type:varchar(120);default:''" json:"city"`
	State        string     `gorm:"type:varchar(120);default:''" json:"state"`
	Role         string     `gorm:"default:USER;type:varchar(20)" json:"role"`
	TokenVersion int        `gorm:"default:0" json:"-"`
	LastLoginAt  *time.Time `json:"last_login_at,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
}

func IsStaffRole(role string) bool {
	return role == RoleAccountant || role == RoleAdmin || role == RoleSuperAdmin
}

func CanAccessAdmin(role string) bool {
	return role == RoleAdmin || role == RoleSuperAdmin
}

func CanAccessERP(role string) bool {
	return role == RoleAccountant || role == RoleAdmin || role == RoleSuperAdmin
}
