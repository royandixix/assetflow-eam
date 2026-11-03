package categories

import (
	"errors"
	"log"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/royandixix/assetflow-eam/backend/internal/middleware"
)

type Handler struct {
	db *pgxpool.Pool
}

type Category struct {
	ID          string `json:"id"`
	Code        string `json:"code"`
	Name        string `json:"name"`
	Description string `json:"description"`
	IsActive    bool   `json:"is_active"`
	HasImage    bool   `json:"has_image"`
}

type CategoryInput struct {
	Code        string `json:"code"`
	Name        string `json:"name"`
	Description string `json:"description"`
	IsActive    *bool  `json:"is_active"`
}

var uuidPattern = regexp.MustCompile(
	`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`,
)

var codePattern = regexp.MustCompile(
	`^[A-Z0-9_-]{2,40}$`,
)

func RegisterRoutes(
	protected *gin.RouterGroup,
	db *pgxpool.Pool,
) {
	h := &Handler{db: db}

	group := protected.Group(
		"/asset-categories",
		middleware.RequireRoles("SUPER_ADMIN", "ASSET_ADMIN"),
	)

	group.GET("", h.List)
	group.GET("/:id", h.Get)
	group.POST("", h.Create)
	group.PUT("/:id", h.Update)
	group.DELETE("/:id", h.Delete)
	group.GET("/:id/image", h.GetImage)
	group.POST("/:id/image", h.UploadImage)
	group.DELETE("/:id/image", h.DeleteImage)
}

func respondError(
	c *gin.Context,
	status int,
	message string,
) {
	c.JSON(status, gin.H{"message": message})
}

func validID(c *gin.Context) (string, bool) {
	id := strings.TrimSpace(c.Param("id"))

	if !uuidPattern.MatchString(id) {
		respondError(c, http.StatusBadRequest, "ID kategori tidak valid")
		return "", false
	}

	return id, true
}

func parseInput(c *gin.Context) (CategoryInput, bool) {
	var input CategoryInput

	if err := c.ShouldBindJSON(&input); err != nil {
		respondError(c, http.StatusBadRequest, "Format data kategori tidak valid")
		return input, false
	}

	input.Code = strings.ToUpper(strings.TrimSpace(input.Code))
	input.Name = strings.TrimSpace(input.Name)
	input.Description = strings.TrimSpace(input.Description)

	if !codePattern.MatchString(input.Code) {
		respondError(
			c,
			http.StatusBadRequest,
			"Kode harus 2–40 karakter, menggunakan huruf, angka, - atau _",
		)
		return input, false
	}

	nameLength := utf8.RuneCountInString(input.Name)

	if nameLength < 2 || nameLength > 120 {
		respondError(
			c,
			http.StatusBadRequest,
			"Nama kategori harus 2–120 karakter",
		)
		return input, false
	}

	if utf8.RuneCountInString(input.Description) > 2000 {
		respondError(
			c,
			http.StatusBadRequest,
			"Deskripsi maksimal 2000 karakter",
		)
		return input, false
	}

	return input, true
}

func databaseError(c *gin.Context, err error) {
	var pgErr *pgconn.PgError

	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "23505":
			respondError(
				c,
				http.StatusConflict,
				"Kode kategori sudah digunakan",
			)
			return
		case "23503":
			respondError(
				c,
				http.StatusConflict,
				"Kategori masih digunakan oleh data aset",
			)
			return
		}
	}

	log.Printf("[asset-categories] database error: %v", err)

	respondError(
		c,
		http.StatusInternalServerError,
		"Terjadi kesalahan saat mengakses database",
	)
}

func (h *Handler) List(c *gin.Context) {
	page, err := strconv.Atoi(c.DefaultQuery("page", "1"))

	if err != nil || page < 1 {
		respondError(c, http.StatusBadRequest, "Halaman tidak valid")
		return
	}

	search := strings.TrimSpace(c.Query("q"))

	if utf8.RuneCountInString(search) > 100 {
		respondError(c, http.StatusBadRequest, "Kata pencarian terlalu panjang")
		return
	}

	const limit = 20
	offset := (page - 1) * limit

	var total int64

	err = h.db.QueryRow(
		c.Request.Context(),
		`
		SELECT COUNT(*)
		FROM public.asset_categories
		WHERE (
			$1::text = ''
			OR code ILIKE '%' || $1::text || '%'
			OR name ILIKE '%' || $1::text || '%'
		)
		`,
		search,
	).Scan(&total)

	if err != nil {
		databaseError(c, err)
		return
	}

	rows, err := h.db.Query(
		c.Request.Context(),
		`
		SELECT
			id::text,
			code,
			name,
			COALESCE(description, ''),
			is_active
		FROM public.asset_categories
		WHERE (
			$1::text = ''
			OR code ILIKE '%' || $1::text || '%'
			OR name ILIKE '%' || $1::text || '%'
		)
		ORDER BY name ASC
		LIMIT $2 OFFSET $3
		`,
		search,
		limit,
		offset,
	)

	if err != nil {
		databaseError(c, err)
		return
	}
	defer rows.Close()

	items := make([]Category, 0)

	for rows.Next() {
		var item Category

		if err := rows.Scan(
			&item.ID,
			&item.Code,
			&item.Name,
			&item.Description,
			&item.IsActive,
		); err != nil {
			databaseError(c, err)
			return
		}

		item.HasImage = categoryImageExists(item.ID)
		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		databaseError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": items,
		"pagination": gin.H{
			"page":  page,
			"limit": limit,
			"total": total,
		},
	})
}

func (h *Handler) Get(c *gin.Context) {
	id, ok := validID(c)
	if !ok {
		return
	}

	var item Category

	err := h.db.QueryRow(
		c.Request.Context(),
		`
		SELECT
			id::text,
			code,
			name,
			COALESCE(description, ''),
			is_active
		FROM public.asset_categories
		WHERE id = $1::uuid
		`,
		id,
	).Scan(
		&item.ID,
		&item.Code,
		&item.Name,
		&item.Description,
		&item.IsActive,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		respondError(c, http.StatusNotFound, "Kategori tidak ditemukan")
		return
	}

	if err != nil {
		databaseError(c, err)
		return
	}

	item.HasImage = categoryImageExists(item.ID)
	c.JSON(http.StatusOK, gin.H{"data": item})
}

func (h *Handler) Create(c *gin.Context) {
	input, ok := parseInput(c)
	if !ok {
		return
	}

	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}

	var item Category

	err := h.db.QueryRow(
		c.Request.Context(),
		`
		INSERT INTO public.asset_categories (
			code,
			name,
			description,
			is_active
		)
		VALUES ($1, $2, NULLIF($3, ''), $4)
		RETURNING
			id::text,
			code,
			name,
			COALESCE(description, ''),
			is_active
		`,
		input.Code,
		input.Name,
		input.Description,
		isActive,
	).Scan(
		&item.ID,
		&item.Code,
		&item.Name,
		&item.Description,
		&item.IsActive,
	)

	if err != nil {
		databaseError(c, err)
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Kategori berhasil ditambahkan",
		"data":    item,
	})
}

func (h *Handler) Update(c *gin.Context) {
	id, ok := validID(c)
	if !ok {
		return
	}

	input, ok := parseInput(c)
	if !ok {
		return
	}

	if input.IsActive == nil {
		respondError(
			c,
			http.StatusBadRequest,
			"Status aktif kategori wajib diisi",
		)
		return
	}

	var item Category

	err := h.db.QueryRow(
		c.Request.Context(),
		`
		UPDATE public.asset_categories
		SET
			code = $2,
			name = $3,
			description = NULLIF($4, ''),
			is_active = $5
		WHERE id = $1::uuid
		RETURNING
			id::text,
			code,
			name,
			COALESCE(description, ''),
			is_active
		`,
		id,
		input.Code,
		input.Name,
		input.Description,
		*input.IsActive,
	).Scan(
		&item.ID,
		&item.Code,
		&item.Name,
		&item.Description,
		&item.IsActive,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		respondError(c, http.StatusNotFound, "Kategori tidak ditemukan")
		return
	}

	if err != nil {
		databaseError(c, err)
		return
	}

	item.HasImage = categoryImageExists(item.ID)
	c.JSON(http.StatusOK, gin.H{
		"message": "Kategori berhasil diperbarui",
		"data":    item,
	})
}

func (h *Handler) Delete(c *gin.Context) {
	id, ok := validID(c)
	if !ok {
		return
	}

	result, err := h.db.Exec(
		c.Request.Context(),
		`
		DELETE FROM public.asset_categories
		WHERE id = $1::uuid
		`,
		id,
	)

	if err != nil {
		databaseError(c, err)
		return
	}

	if result.RowsAffected() == 0 {
		respondError(c, http.StatusNotFound, "Kategori tidak ditemukan")
		return
	}

	_ = removeCategoryImages(id)

	c.JSON(http.StatusOK, gin.H{
		"message": "Kategori berhasil dihapus",
	})
}
