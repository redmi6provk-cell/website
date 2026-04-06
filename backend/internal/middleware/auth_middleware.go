package middleware

import (
	"strings"

	"backend/internal/repository"
	"backend/pkg/jwt"
	"github.com/gin-gonic/gin"
)

func AuthMiddleware(userRepo *repository.UserRepository) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(401, gin.H{"success": false, "error": "missing token"})
			return
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
		claims, err := jwt.ValidateToken(tokenStr)
		if err != nil {
			c.AbortWithStatusJSON(401, gin.H{"success": false, "error": "invalid token"})
			return
		}

		user, err := userRepo.FindByID(claims.UserID)
		if err != nil {
			c.AbortWithStatusJSON(401, gin.H{"success": false, "error": "user not found"})
			return
		}

		if user.TokenVersion != claims.TokenVersion {
			c.AbortWithStatusJSON(401, gin.H{"success": false, "error": "session expired"})
			return
		}

		c.Set("userID", user.ID)
		c.Set("role", user.Role)
		c.Next()
	}
}
