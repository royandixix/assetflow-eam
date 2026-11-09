package settings

import (
	"context"
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/royandixix/assetflow-eam/backend/internal/middleware"
)

type PreferencesHandler struct {
	db *pgxpool.Pool
}

type Preferences struct {
	Theme     string     `json:"theme"`
	UpdatedAt *time.Time `json:"updated_at"`
}

type PreferencesInput struct {
	Theme string `json:"theme" binding:"required"`
}

func (h *PreferencesHandler) Get(c *gin.Context) {
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

	var result Preferences
	var updatedAt time.Time

	err := h.db.QueryRow(
		ctx,
		`SELECT theme, updated_at
		 FROM public.assetflow_user_preferences
		 WHERE user_id = $1::uuid`,
		identity.ID,
	).Scan(&result.Theme, &updatedAt)

	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusOK, Preferences{
			Theme:     "system",
			UpdatedAt: nil,
		})
		return
	}

	if err != nil {
		log.Printf("[preferences] gagal membaca: %v", err)

		c.JSON(http.StatusInternalServerError, gin.H{
			"message": "Gagal memuat preferensi tampilan",
		})
		return
	}

	result.UpdatedAt = &updatedAt

	c.JSON(http.StatusOK, result)
}

func (h *PreferencesHandler) Update(c *gin.Context) {
	identity, ok := middleware.CurrentIdentity(c)

	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"message": "Identitas pengguna tidak tersedia",
		})
		return
	}

	var input PreferencesInput

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "Data preferensi tidak valid",
		})
		return
	}

	switch input.Theme {
	case "light", "dark", "system":
	default:
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "Tema tidak didukung",
		})
		return
	}

	ctx, cancel := context.WithTimeout(
		c.Request.Context(),
		5*time.Second,
	)
	defer cancel()

	var result Preferences
	var updatedAt time.Time

	err := h.db.QueryRow(
		ctx,
		`INSERT INTO public.assetflow_user_preferences (
			user_id,
			theme,
			updated_at
		)
		VALUES ($1::uuid, $2, NOW())
		ON CONFLICT (user_id)
		DO UPDATE SET
			theme = EXCLUDED.theme,
			updated_at = NOW()
		RETURNING theme, updated_at`,
		identity.ID,
		input.Theme,
	).Scan(&result.Theme, &updatedAt)

	if err != nil {
		log.Printf("[preferences] gagal menyimpan: %v", err)

		c.JSON(http.StatusInternalServerError, gin.H{
			"message": "Gagal menyimpan preferensi tampilan",
		})
		return
	}

	result.UpdatedAt = &updatedAt

	c.JSON(http.StatusOK, gin.H{
		"message": "Preferensi tampilan berhasil disimpan",
		"data":    result,
	})
}
