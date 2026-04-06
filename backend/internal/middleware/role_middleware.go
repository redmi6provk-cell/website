package middleware

import "github.com/gin-gonic/gin"

func RequireRoles(roles ...string) gin.HandlerFunc {
	allowed := make(map[string]struct{}, len(roles))
	for _, role := range roles {
		allowed[role] = struct{}{}
	}

	return func(c *gin.Context) {
		roleValue, exists := c.Get("role")
		if !exists {
			c.AbortWithStatusJSON(403, gin.H{"success": false, "error": "access denied"})
			return
		}

		role, ok := roleValue.(string)
		if !ok {
			c.AbortWithStatusJSON(403, gin.H{"success": false, "error": "invalid role"})
			return
		}

		if _, ok := allowed[role]; !ok {
			c.AbortWithStatusJSON(403, gin.H{"success": false, "error": "insufficient permissions"})
			return
		}

		c.Next()
	}
}
