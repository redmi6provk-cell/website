package config

import (
	"log"
	"os"

	"backend/internal/models"

	"github.com/google/uuid"
	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

func LoadEnv() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system OS environment variables")
	}
}

func ConnectDB() {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL is not set in environment")
	}

	db, err := gorm.Open(postgres.Open(dbURL), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Auto Migrate models
	if err := db.AutoMigrate(
		&models.User{},
		&models.Brand{},
		&models.Category{},
		&models.Product{},
		&models.Cart{},
		&models.Order{},
		&models.OrderItem{},
		&models.OrderStatusEvent{},
		&models.Party{},
		&models.PartyContact{},
		&models.Invoice{},
		&models.InvoiceItem{},
		&models.Payment{},
		&models.Expense{},
		&models.Purchase{},
		&models.PurchaseItem{},
		&models.OfflineSale{},
		&models.OfflineSaleItem{},
		&models.FinanceTransaction{},
		&models.AdminSettings{},
	); err != nil {
		log.Fatalf("Failed to auto-migrate database: %v", err)
	}

	// Seed default admin users if none exist
	var staffCount int64
	if err := db.Model(&models.User{}).Where("role IN ?", []string{models.RoleSuperAdmin, models.RoleAdmin, models.RoleAccountant}).Count(&staffCount).Error; err == nil && staffCount == 0 {
		admins := []models.User{
			{
				ID:       uuid.New(),
				Name:     "Jagdish Sabhnani",
				Phone:    "9827341465",
				Role:     models.RoleSuperAdmin,
				ShopName: "Jhulelal traders",
			},
			{
				ID:       uuid.New(),
				Name:     "Rohit Sabhnani",
				Phone:    "7000810743",
				Role:     models.RoleAdmin,
				ShopName: "Jhulelal traders",
			},
		}
		for _, admin := range admins {
			if err := db.Create(&admin).Error; err != nil {
				log.Printf("Warning: failed to seed admin user: %v", err)
			}
		}
	}

	// Seed default admin settings if none exist
	var settingsCount int64
	if err := db.Model(&models.AdminSettings{}).Count(&settingsCount).Error; err == nil && settingsCount == 0 {
		defaultSettings := models.AdminSettings{
			ID:                uuid.New(),
			StoreName:         "Sindhi Smart Store",
			SupportPhone:      "9827341465",
			SupportEmail:      "support@sindhismart.in",
			Address:           "Bairagarh, Bhopal",
			CODEnabled:        true,
			BankAccountsJSON:  "[]",
		}
		if err := db.Create(&defaultSettings).Error; err != nil {
			log.Printf("Warning: failed to seed default admin settings: %v", err)
		}
	}

	DB = db
	log.Println("Database connection successfully established")
}
