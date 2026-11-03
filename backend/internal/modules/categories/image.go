package categories

import (
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
)

const maxCategoryImageSize int64 = 10 * 1024 * 1024

var categoryImageExtensions = []string{
	".jpg",
	".png",
	".webp",
}

func categoryImageDirectory() string {
	if value := strings.TrimSpace(os.Getenv("ASSETFLOW_CATEGORY_IMAGE_DIR")); value != "" {
		return value
	}
	return filepath.Join("storage", "category-images")
}

func findCategoryImage(id string) (string, bool) {
	for _, ext := range categoryImageExtensions {
		path := filepath.Join(categoryImageDirectory(), id+ext)

		if info, err := os.Stat(path); err == nil && info.Mode().IsRegular() {
			return path, true
		}
	}
	return "", false
}

func categoryImageExists(id string) bool {
	_, exists := findCategoryImage(id)
	return exists
}

func removeCategoryImages(id string) error {
	for _, ext := range categoryImageExtensions {
		path := filepath.Join(categoryImageDirectory(), id+ext)

		if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
			return err
		}
	}
	return nil
}

func (h *Handler) imageCategoryExists(c *gin.Context, id string) (bool, error) {
	var exists bool

	err := h.db.QueryRow(
		c.Request.Context(),
		"SELECT EXISTS(SELECT 1 FROM public.asset_categories WHERE id = $1::uuid)",
		id,
	).Scan(&exists)

	return exists, err
}

func (h *Handler) GetImage(c *gin.Context) {
	id, valid := validID(c)
	if !valid {
		return
	}

	exists, err := h.imageCategoryExists(c, id)
	if err != nil {
		databaseError(c, err)
		return
	}
	if !exists {
		respondError(c, http.StatusNotFound, "Kategori tidak ditemukan")
		return
	}

	path, found := findCategoryImage(id)
	if !found {
		respondError(c, http.StatusNotFound, "Gambar tidak ditemukan")
		return
	}

	c.Header("Cache-Control", "private, no-store")
	c.File(path)
}

func (h *Handler) UploadImage(c *gin.Context) {
	id, valid := validID(c)
	if !valid {
		return
	}

	exists, err := h.imageCategoryExists(c, id)
	if err != nil {
		databaseError(c, err)
		return
	}
	if !exists {
		respondError(c, http.StatusNotFound, "Kategori tidak ditemukan")
		return
	}

	c.Request.Body = http.MaxBytesReader(
		c.Writer,
		c.Request.Body,
		maxCategoryImageSize+1024*1024,
	)

	file, header, err := c.Request.FormFile("image")
	if err != nil {
		respondError(c, http.StatusBadRequest, "File gambar tidak valid")
		return
	}
	defer file.Close()

	if header.Size <= 0 || header.Size > maxCategoryImageSize {
		respondError(c, http.StatusRequestEntityTooLarge, "Ukuran gambar maksimal 10 MB")
		return
	}

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if ext == ".jpeg" {
		ext = ".jpg"
	}

	allowed := map[string]string{
		".jpg":  "image/jpeg",
		".png":  "image/png",
		".webp": "image/webp",
	}

	expected, ok := allowed[ext]
	if !ok {
		respondError(c, http.StatusBadRequest, "Format harus JPG, PNG atau WebP")
		return
	}

	headerBytes := make([]byte, 512)
	n, readErr := file.Read(headerBytes)

	if readErr != nil && !errors.Is(readErr, io.EOF) {
		respondError(c, http.StatusBadRequest, "Gagal membaca gambar")
		return
	}

	if http.DetectContentType(headerBytes[:n]) != expected {
		respondError(c, http.StatusBadRequest, "Isi file tidak sesuai format gambar")
		return
	}

	if _, err := file.Seek(0, io.SeekStart); err != nil {
		respondError(c, http.StatusBadRequest, "Gagal membaca ulang gambar")
		return
	}

	directory := categoryImageDirectory()

	if err := os.MkdirAll(directory, 0750); err != nil {
		respondError(c, http.StatusInternalServerError, "Penyimpanan gambar tidak tersedia")
		return
	}

	tmp, err := os.CreateTemp(directory, ".upload-*")
	if err != nil {
		respondError(c, http.StatusInternalServerError, "Gagal menyiapkan gambar")
		return
	}
	defer os.Remove(tmp.Name())

	size, err := io.Copy(tmp, io.LimitReader(file, maxCategoryImageSize+1))
	if err != nil || size > maxCategoryImageSize {
		tmp.Close()
		respondError(c, http.StatusRequestEntityTooLarge, "Gambar melebihi batas 10 MB")
		return
	}

	if err := tmp.Close(); err != nil {
		respondError(c, http.StatusInternalServerError, "Gagal menyimpan gambar")
		return
	}

	destination := filepath.Join(directory, id+ext)

	if err := os.Rename(tmp.Name(), destination); err != nil {
		respondError(c, http.StatusInternalServerError, "Gagal menyimpan gambar")
		return
	}

	for _, other := range categoryImageExtensions {
		if other != ext {
			_ = os.Remove(filepath.Join(directory, id+other))
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"message":   "Gambar kategori berhasil disimpan",
		"has_image": true,
	})
}

func (h *Handler) DeleteImage(c *gin.Context) {
	id, valid := validID(c)
	if !valid {
		return
	}

	exists, err := h.imageCategoryExists(c, id)
	if err != nil {
		databaseError(c, err)
		return
	}
	if !exists {
		respondError(c, http.StatusNotFound, "Kategori tidak ditemukan")
		return
	}

	if err := removeCategoryImages(id); err != nil {
		respondError(c, http.StatusInternalServerError, "Gagal menghapus gambar")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Gambar kategori berhasil dihapus",
	})
}
