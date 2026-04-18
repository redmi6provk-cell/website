package main

import (
	"log"
	"os"

	"backend/config"
	"backend/internal/handlers"
	"backend/internal/middleware"
	"backend/internal/repository"
	"backend/internal/services"
	"backend/routes"

	"github.com/gin-gonic/gin"
)

func main() {
	config.LoadEnv()
	config.ConnectDB()
	log.Println("Automatic database schema changes are disabled; skipping auto-migrate and cleanup")
	if err := config.EnsureProductImageSchema(); err != nil {
		log.Fatalf("Failed to align product image schema: %v", err)
	}
	if err := config.EnsureProductActiveSchema(); err != nil {
		log.Fatalf("Failed to align product active schema: %v", err)
	}
	if err := config.EnsureARPSchema(); err != nil {
		log.Fatalf("Failed to align ARP schema: %v", err)
	}
	if err := config.EnsureOrderInvoiceNumberSchema(); err != nil {
		log.Fatalf("Failed to align order invoice number schema: %v", err)
	}
	if err := config.EnsureOrderPaymentTrackingSchema(); err != nil {
		log.Fatalf("Failed to align order payment tracking schema: %v", err)
	}
	if err := config.EnsureSalesInvoiceSequenceSchema(); err != nil {
		log.Fatalf("Failed to align sales invoice sequence schema: %v", err)
	}
	if err := config.EnsureOfflineSalePartySchema(); err != nil {
		log.Fatalf("Failed to align offline sale party schema: %v", err)
	}

	// Initialize Repositories
	userRepo := repository.NewUserRepository(config.DB)
	productRepo := repository.NewProductRepository(config.DB)
	cartRepo := repository.NewCartRepository(config.DB)
	orderRepo := repository.NewOrderRepository(config.DB)
	arpRepo := repository.NewARPRepository(config.DB)
	categoryRepo := repository.NewCategoryRepository(config.DB)
	brandRepo := repository.NewBrandRepository(config.DB)
	settingsRepo := repository.NewSettingsRepository(config.DB)
	purchaseRepo := repository.NewPurchaseRepository(config.DB)
	expenseRepo := repository.NewExpenseRepository(config.DB)
	offlineSaleRepo := repository.NewOfflineSaleRepository(config.DB)
	financeTransactionRepo := repository.NewFinanceTransactionRepository(config.DB)
	invoiceSequenceRepo := repository.NewInvoiceSequenceRepository(config.DB)

	// Initialize Services
	authService := services.NewAuthService(userRepo, arpRepo)
	productService := services.NewProductService(productRepo)
	cartService := services.NewCartService(cartRepo, productRepo)
	orderService := services.NewOrderService(orderRepo, cartRepo, arpRepo, userRepo, productRepo, invoiceSequenceRepo, settingsRepo, financeTransactionRepo)
	arpService := services.NewARPService(arpRepo, financeTransactionRepo, settingsRepo)
	categoryService := services.NewCategoryService(categoryRepo)
	brandService := services.NewBrandService(brandRepo)
	settingsService := services.NewSettingsService(settingsRepo, userRepo)
	purchaseService := services.NewPurchaseService(purchaseRepo, arpRepo, settingsRepo, financeTransactionRepo)
	expenseService := services.NewExpenseService(expenseRepo, settingsRepo, financeTransactionRepo)
	offlineSaleService := services.NewOfflineSaleService(offlineSaleRepo, invoiceSequenceRepo, arpRepo, settingsRepo, financeTransactionRepo)
	invoiceSequenceService := services.NewInvoiceSequenceService(invoiceSequenceRepo)

	// Initialize Handlers
	authHandler := handlers.NewAuthHandler(authService)
	productHandler := handlers.NewProductHandler(productService)
	cartHandler := handlers.NewCartHandler(cartService)
	orderHandler := handlers.NewOrderHandler(orderService)
	arpHandler := handlers.NewARPHandler(arpService)
	categoryHandler := handlers.NewCategoryHandler(categoryService)
	brandHandler := handlers.NewBrandHandler(brandService)
	settingsHandler := handlers.NewSettingsHandler(settingsService)
	adminPanelHandler := handlers.NewAdminPanelHandler()
	uploadHandler := handlers.NewUploadHandler()
	purchaseHandler := handlers.NewPurchaseHandler(purchaseService)
	expenseHandler := handlers.NewExpenseHandler(expenseService)
	offlineSaleHandler := handlers.NewOfflineSaleHandler(offlineSaleService)
	invoiceSequenceHandler := handlers.NewInvoiceSequenceHandler(invoiceSequenceService)

	if err := orderService.SyncMissingERPInvoices(); err != nil {
		log.Fatalf("Failed to sync ERP invoices from orders: %v", err)
	}
	if err := orderService.SyncFinanceTransactions(); err != nil {
		log.Fatalf("Failed to sync finance transactions from orders: %v", err)
	}
	if err := expenseService.SyncFinanceTransactions(); err != nil {
		log.Fatalf("Failed to sync expense finance transactions: %v", err)
	}
	if err := purchaseService.SyncFinanceTransactions(); err != nil {
		log.Fatalf("Failed to sync purchase finance transactions: %v", err)
	}
	if err := offlineSaleService.SyncFinanceTransactions(); err != nil {
		log.Fatalf("Failed to sync offline sale finance transactions: %v", err)
	}

	// Set up Gin routing
	r := gin.Default()
	r.Use(middleware.CORSMiddleware())
	r.Static("/uploads", "./uploads")
	authMiddleware := middleware.AuthMiddleware(userRepo)
	routes.SetupRoutes(r, authHandler, productHandler, cartHandler, orderHandler, arpHandler, categoryHandler, brandHandler, settingsHandler, adminPanelHandler, uploadHandler, purchaseHandler, expenseHandler, offlineSaleHandler, invoiceSequenceHandler, authMiddleware)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("FMCG Backend Server running on http://localhost:%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
