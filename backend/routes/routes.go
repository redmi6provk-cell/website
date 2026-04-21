package routes

import (
	"backend/internal/handlers"
	"backend/internal/middleware"
	"backend/internal/models"

	"github.com/gin-gonic/gin"
)

func SetupRoutes(
	r *gin.Engine,
	authHandler *handlers.AuthHandler,
	productHandler *handlers.ProductHandler,
	cartHandler *handlers.CartHandler,
	orderHandler *handlers.OrderHandler,
	arpHandler *handlers.ARPHandler,
	categoryHandler *handlers.CategoryHandler,
	brandHandler *handlers.BrandHandler,
	settingsHandler *handlers.SettingsHandler,
	adminPanelHandler *handlers.AdminPanelHandler,
	uploadHandler *handlers.UploadHandler,
	purchaseHandler *handlers.PurchaseHandler,
	expenseHandler *handlers.ExpenseHandler,
	offlineSaleHandler *handlers.OfflineSaleHandler,
	invoiceSequenceHandler *handlers.InvoiceSequenceHandler,
	authMiddleware gin.HandlerFunc,
) {
	api := r.Group("/api")

	// Public Routes
	auth := api.Group("/auth")
	{
		auth.POST("/register", authHandler.Register)
		auth.POST("/login", authHandler.Login)
	}

	products := api.Group("/products")
	{
		products.GET("", productHandler.GetProducts)
		products.GET("/:id", productHandler.GetProductByID)
	}

	storeSettings := api.Group("/settings")
	{
		storeSettings.GET("/store", settingsHandler.GetPublicSettings)
	}

	categoriesPublic := api.Group("/categories")
	{
		categoriesPublic.GET("", categoryHandler.GetAllCategories)
	}

	brandsPublic := api.Group("/brands")
	{
		brandsPublic.GET("", brandHandler.GetAllBrands)
	}

	// Protected Routes (Requires JWT Login)
	protected := api.Group("")
	protected.Use(authMiddleware)
	{
		cart := protected.Group("/cart")
		{
			cart.GET("", cartHandler.GetCart)
			cart.POST("/add", cartHandler.AddToCart)
			cart.POST("/sync", cartHandler.SyncCart)
			cart.PUT("/update", cartHandler.UpdateCart)
			cart.DELETE("/remove/:id", cartHandler.RemoveFromCart)
		}

		orders := protected.Group("/orders")
		{
			orders.POST("", orderHandler.CreateOrder)
			orders.GET("", orderHandler.GetMyOrders)
		}
	}

	// Staff/Admin Routes
	admin := api.Group("/admin")
	admin.Use(authMiddleware)
	{
		adminProducts := admin.Group("/products")
		adminProducts.Use(middleware.RequireRoles(models.RoleAdmin, models.RoleSuperAdmin))
		{
			adminProducts.GET("", productHandler.GetAdminProducts)
			adminProducts.POST("", productHandler.CreateProduct)
			adminProducts.PUT("/:id", productHandler.UpdateProduct)
			adminProducts.PUT("/:id/active", productHandler.UpdateProductActive)
			adminProducts.DELETE("/:id", productHandler.DeleteProduct)
			adminProducts.PUT("/:id/stock", productHandler.UpdateStock)
			adminProducts.POST("/csv", productHandler.BulkUploadCSV)
		}

		adminOrders := admin.Group("/orders")
		adminOrders.Use(middleware.RequireRoles(models.RoleAdmin, models.RoleSuperAdmin))
		{
			adminOrders.GET("", orderHandler.GetAllOrders)
			adminOrders.PUT("/:id/status", orderHandler.UpdateOrderStatus)
			adminOrders.PUT("/:id/invoice-number", orderHandler.UpdateOrderInvoiceNumber)
			adminOrders.GET("/next-invoice-number", invoiceSequenceHandler.GetNextSalesInvoiceNumber)
		}

		arp := admin.Group("/arp")
		arp.Use(middleware.RequireRoles(models.RoleAccountant, models.RoleAdmin, models.RoleSuperAdmin))
		{
			arp.GET("/parties", arpHandler.GetParties)
			arp.POST("/parties", arpHandler.CreateParty)
			arp.PUT("/parties/:id", arpHandler.UpdateParty)
			arp.DELETE("/parties/:id", arpHandler.DeleteParty)
			arp.POST("/invoices", arpHandler.CreateInvoice)
			arp.PUT("/invoices/:id", arpHandler.UpdateInvoice)
			arp.POST("/payments", arpHandler.RecordPayment)
			arp.PUT("/payments/:id", arpHandler.UpdatePayment)
			arp.POST("/manual-transactions", arpHandler.RecordManualTransaction)
			arp.PUT("/manual-transactions/:id", arpHandler.UpdateManualTransaction)
			arp.GET("/ledger", arpHandler.GetLedger)
			arp.GET("/ledger/:id", arpHandler.GetDetailedLedger)
			arp.GET("/payment-transactions", arpHandler.GetPaymentModeTransactions)
			arp.GET("/summary", arpHandler.GetSummary)
		}

		adminCategories := admin.Group("/categories")
		adminCategories.Use(middleware.RequireRoles(models.RoleAdmin, models.RoleSuperAdmin))
		{
			adminCategories.POST("", categoryHandler.CreateCategory)
			adminCategories.PUT("/:id", categoryHandler.UpdateCategory)
			adminCategories.DELETE("/:id", categoryHandler.DeleteCategory)
			adminCategories.GET("", categoryHandler.GetAllCategories)
		}

		adminBrands := admin.Group("/brands")
		adminBrands.Use(middleware.RequireRoles(models.RoleAdmin, models.RoleSuperAdmin))
		{
			adminBrands.POST("", brandHandler.CreateBrand)
			adminBrands.PUT("/:id", brandHandler.UpdateBrand)
			adminBrands.DELETE("/:id", brandHandler.DeleteBrand)
			adminBrands.GET("", brandHandler.GetAllBrands)
		}

		adminSettings := admin.Group("/settings")
		adminSettings.Use(middleware.RequireRoles(models.RoleAdmin, models.RoleSuperAdmin))
		{
			adminSettings.GET("", settingsHandler.GetSettings)
			adminSettings.PUT("", settingsHandler.UpdateSettings)
			adminSettings.POST("/logout-all-sessions", settingsHandler.LogoutAllSessions)
		}

		adminPanel := admin.Group("/panel-access")
		adminPanel.Use(middleware.RequireRoles(models.RoleAccountant, models.RoleAdmin, models.RoleSuperAdmin))
		{
			adminPanel.POST("/verify", adminPanelHandler.VerifyPassword)
		}

		adminUploads := admin.Group("/uploads")
		adminUploads.Use(middleware.RequireRoles(models.RoleAdmin, models.RoleSuperAdmin))
		{
			adminUploads.POST("/image", uploadHandler.UploadImage)
		}

		adminPurchases := admin.Group("/purchases")
		adminPurchases.Use(middleware.RequireRoles(models.RoleAdmin, models.RoleSuperAdmin))
		{
			adminPurchases.GET("", purchaseHandler.GetPurchases)
			adminPurchases.POST("", purchaseHandler.CreatePurchase)
			adminPurchases.PUT("/:id", purchaseHandler.UpdatePurchase)
			adminPurchases.DELETE("/:id", purchaseHandler.DeletePurchase)
		}

		adminExpenses := admin.Group("/expenses")
		adminExpenses.Use(middleware.RequireRoles(models.RoleAdmin, models.RoleSuperAdmin))
		{
			adminExpenses.GET("", expenseHandler.GetExpenses)
			adminExpenses.POST("", expenseHandler.CreateExpense)
			adminExpenses.PUT("/:id", expenseHandler.UpdateExpense)
			adminExpenses.DELETE("/:id", expenseHandler.DeleteExpense)
		}

		adminOfflineSales := admin.Group("/offline-sales")
		adminOfflineSales.Use(middleware.RequireRoles(models.RoleAdmin, models.RoleSuperAdmin))
		{
			adminOfflineSales.GET("", offlineSaleHandler.GetOfflineSales)
			adminOfflineSales.POST("", offlineSaleHandler.CreateOfflineSale)
			adminOfflineSales.PUT("/:id", offlineSaleHandler.UpdateOfflineSale)
			adminOfflineSales.DELETE("/:id", offlineSaleHandler.DeleteOfflineSale)
			adminOfflineSales.GET("/next-invoice-number", invoiceSequenceHandler.GetNextSalesInvoiceNumber)
		}
	}
}
