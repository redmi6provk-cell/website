package handlers

import (
	"net/http"
	"os"
	"strings"

	"backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type AdminPanelHandler struct{}

type adminPanelPasswordRequest struct {
	Password string `json:"password"`
}

func NewAdminPanelHandler() *AdminPanelHandler {
	return &AdminPanelHandler{}
}

func (h *AdminPanelHandler) VerifyPassword(c *gin.Context) {
	expectedPassword := strings.TrimSpace(os.Getenv("ADMIN_PANEL_PASSWORD"))
	if expectedPassword == "" {
		response.Fail(c, http.StatusInternalServerError, "Admin panel password is not configured")
		return
	}

	var req adminPanelPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	if strings.TrimSpace(req.Password) == "" {
		response.Fail(c, http.StatusBadRequest, "Password is required")
		return
	}

	if req.Password != expectedPassword {
		response.Fail(c, http.StatusUnauthorized, "Invalid admin panel password")
		return
	}

	response.OK(c, "Admin panel unlocked", gin.H{"verified": true})
}
