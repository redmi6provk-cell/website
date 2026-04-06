package response

import "github.com/gin-gonic/gin"

type APIResponse struct {
	Success bool        `json:"success"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

func OK(c *gin.Context, msg string, data interface{}) {
	c.JSON(200, APIResponse{Success: true, Message: msg, Data: data})
}

func Created(c *gin.Context, msg string, data interface{}) {
	c.JSON(201, APIResponse{Success: true, Message: msg, Data: data})
}

func Fail(c *gin.Context, status int, err string) {
	c.JSON(status, APIResponse{Success: false, Error: err})
}
