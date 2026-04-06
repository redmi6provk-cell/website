package handlers

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type UploadHandler struct{}

func NewUploadHandler() *UploadHandler {
	return &UploadHandler{}
}

func (h *UploadHandler) UploadImage(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "image file is required")
		return
	}

	contentType := file.Header.Get("Content-Type")
	if !strings.HasPrefix(contentType, "image/") {
		response.Fail(c, http.StatusBadRequest, "only image uploads are allowed")
		return
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext == "" {
		ext = ".jpg"
	}

	uploadDir := filepath.Join(".", "uploads")
	if err := os.MkdirAll(uploadDir, 0o755); err != nil {
		response.Fail(c, http.StatusInternalServerError, "failed to prepare upload directory")
		return
	}

	fileName := fmt.Sprintf("%d%s", time.Now().UnixNano(), ext)
	filePath := filepath.Join(uploadDir, fileName)
	if err := c.SaveUploadedFile(file, filePath); err != nil {
		response.Fail(c, http.StatusInternalServerError, "failed to save uploaded image")
		return
	}

	scheme := "http"
	if c.Request.TLS != nil {
		scheme = "https"
	}

	response.OK(c, "Image uploaded successfully", gin.H{
		"url": fmt.Sprintf("%s://%s/uploads/%s", scheme, c.Request.Host, fileName),
	})
}
