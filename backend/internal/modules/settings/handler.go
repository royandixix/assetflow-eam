package settings

import (
	"context"
	"errors"
	"log"
	"net/http"
	"net/mail"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/royandixix/assetflow-eam/backend/internal/middleware"
)

type Handler struct {
	db *pgxpool.Pool
}

type Settings struct {
	AppName          string    `json:"app_name"`
	OrganizationName string    `json:"organization_name"`
	ContactEmail     string    `json:"contact_email"`
	Timezone         string    `json:"timezone"`
	DateFormat       string    `json:"date_format"`
	UpdatedAt        time.Time `json:"updated_at"`
	UpdatedBy        string    `json:"updated_by"`
}

type UpdateInput struct {
	AppName          string `json:"app_name"`
	OrganizationName string `json:"organization_name"`
	ContactEmail     string `json:"contact_email"`
	Timezone         string `json:"timezone"`
	DateFormat       string `json:"date_format"`
}

func scanSettings(row pgx.Row) (Settings, error) {
	var result Settings

	err := row.Scan(
		&result.AppName,
		&result.OrganizationName,
		&result.ContactEmail,
		&result.Timezone,
		&result.DateFormat,
		&result.UpdatedAt,
		&result.UpdatedBy,
	)

	return result, err
}

func (h *Handler) Get(c *gin.Context) {
	ctx, cancel := context.WithTimeout(
		c.Request.Context(),
		5*time.Second,
	)
	defer cancel()

	result, err := scanSettings(h.db.QueryRow(
		ctx,
		`SELECT
			app_name,
			organization_name,
			contact_email,
			timezone,
			date_format,
			updated_at,
			COALESCE(updated_by::text, '')
		FROM public.assetflow_app_settings
		WHERE id = 1`,
	))

	if err != nil {
		log.Printf("[settings] gagal membaca: %v", err)

		status := http.StatusInternalServerError
		message := "Gagal memuat pengaturan aplikasi"

		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusServiceUnavailable
			message = "Data pengaturan belum tersedia"
		}

		c.JSON(status, gin.H{"message": message})
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h *Handler) Update(c *gin.Context) {
	var input UpdateInput

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "Format data pengaturan tidak valid",
		})
		return
	}

	input.AppName = strings.TrimSpace(input.AppName)
	input.OrganizationName = strings.TrimSpace(input.OrganizationName)
	input.ContactEmail = strings.TrimSpace(input.ContactEmail)
	input.Timezone = strings.TrimSpace(input.Timezone)
	input.DateFormat = strings.TrimSpace(input.DateFormat)

	if input.AppName == "" ||
		utf8.RuneCountInString(input.AppName) > 100 {
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "Nama aplikasi wajib diisi, maksimal 100 karakter",
		})
		return
	}

	if input.OrganizationName == "" ||
		utf8.RuneCountInString(input.OrganizationName) > 150 {
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "Nama organisasi wajib diisi, maksimal 150 karakter",
		})
		return
	}

	if input.ContactEmail != "" {
		address, err := mail.ParseAddress(input.ContactEmail)

		if err != nil ||
			address.Address != input.ContactEmail ||
			len(input.ContactEmail) > 254 {
			c.JSON(http.StatusBadRequest, gin.H{
				"message": "Alamat email organisasi tidak valid",
			})
			return
		}
	}

	switch input.Timezone {
	case "Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura":
	default:
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "Zona waktu tidak valid",
		})
		return
	}

	switch input.DateFormat {
	case "DD/MM/YYYY", "YYYY-MM-DD":
	default:
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "Format tanggal tidak valid",
		})
		return
	}

	identity, ok := middleware.CurrentIdentity(c)

	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"message": "Identitas pengguna tidak tersedia",
		})
		return
	}

	ctx, cancel := context.WithTimeout(
		c.Request.Context(),
		5*time.Second,
	)
	defer cancel()

	result, err := scanSettings(h.db.QueryRow(
		ctx,
		`UPDATE public.assetflow_app_settings
		SET
			app_name = $1,
			organization_name = $2,
			contact_email = $3,
			timezone = $4,
			date_format = $5,
			updated_at = NOW(),
			updated_by = $6::uuid
		WHERE id = 1
		RETURNING
			app_name,
			organization_name,
			contact_email,
			timezone,
			date_format,
			updated_at,
			COALESCE(updated_by::text, '')`,
		input.AppName,
		input.OrganizationName,
		input.ContactEmail,
		input.Timezone,
		input.DateFormat,
		identity.ID,
	))

	if err != nil {
		log.Printf("[settings] gagal menyimpan: %v", err)

		status := http.StatusInternalServerError
		message := "Gagal menyimpan pengaturan aplikasi"

		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusServiceUnavailable
			message = "Data pengaturan belum tersedia"
		}

		c.JSON(status, gin.H{"message": message})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Pengaturan berhasil disimpan",
		"data":    result,
	})
}