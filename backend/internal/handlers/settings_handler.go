package handlers

import (
	"net/http"

	"backend/internal/services"
	"backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type SettingsHandler struct {
	service *services.SettingsService
}

func NewSettingsHandler(service *services.SettingsService) *SettingsHandler {
	return &SettingsHandler{service: service}
}

func (h *SettingsHandler) GetSettings(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		response.Fail(c, http.StatusUnauthorized, "Unauthorized")
		return
	}

	data, err := h.service.GetSettings(userID.String())
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.OK(c, "Settings fetched successfully", data)
}

func (h *SettingsHandler) UpdateSettings(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		response.Fail(c, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var payload services.SettingsPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	data, err := h.service.UpdateSettings(userID.String(), payload)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	response.OK(c, "Settings updated successfully", data)
}

func (h *SettingsHandler) GetPublicSettings(c *gin.Context) {
	data, err := h.service.GetPublicSettings()
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.OK(c, "Public settings fetched successfully", data)
}

func (h *SettingsHandler) LogoutAllSessions(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		response.Fail(c, http.StatusUnauthorized, "Unauthorized")
		return
	}

	if err := h.service.LogoutAllSessions(userID.String()); err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.OK(c, "All sessions logged out successfully", nil)
}
