
package locations

import (
	"errors"
	"log"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"
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

type Location struct {
	ID          string    `json:"id"`
	Code        string    `json:"code"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
}

type LocationInput struct {
	Code        string `json:"code"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

var uuidPattern = regexp.MustCompile(
	`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`,
)

var codePattern = regexp.MustCompile(
	`^[A-Z0-9_-]{2,40}$`,
)

func RegisterRoutes(protected *gin.RouterGroup, db *pgxpool.Pool) {
	h := &Handler{db: db}

	group := protected.Group(
		"/locations",
		middleware.RequireRoles("SUPER_ADMIN", "ASSET_ADMIN"),
	)

	group.GET("", h.List)
	group.POST("", h.Create)

	group.GET("/:id", h.Get)
	group.PUT("/:id", h.Update)
	group.DELETE("/:id", h.Delete)
}

func respondError(c *gin.Context, status int, message string) {
	c.JSON(status, gin.H{
		"message": message,
	})
}

func validID(c *gin.Context) (string, bool) {
	id := strings.TrimSpace(c.Param("id"))

	log.Printf(
		"[locations] method=%s path=%s id=%q",
		c.Request.Method,
		c.Request.URL.Path,
		id,
	)

	if id == "" {
		respondError(
			c,
			http.StatusBadRequest,
			"ID lokasi wajib diisi",
		)
		return "", false
	}

	if !uuidPattern.MatchString(id) {
		log.Printf(
			"[locations] invalid UUID received: %q",
			id,
		)

		respondError(
			c,
			http.StatusBadRequest,
			"ID lokasi tidak valid",
		)
		return "", false
	}

	return id, true
}

func parseInput(c *gin.Context) (LocationInput, bool) {
	var input LocationInput

	if err := c.ShouldBindJSON(&input); err != nil {
		respondError(
			c,
			http.StatusBadRequest,
			"Format data lokasi tidak valid",
		)
		return input, false
	}

	input.Code = strings.ToUpper(strings.TrimSpace(input.Code))
	input.Name = strings.TrimSpace(input.Name)
	input.Description = strings.TrimSpace(input.Description)

	if !codePattern.MatchString(input.Code) {
		respondError(
			c,
			http.StatusBadRequest,
			"Kode lokasi harus 2–40 karakter dan hanya boleh menggunakan huruf, angka, tanda minus atau underscore",
		)
		return input, false
	}

	nameLength := utf8.RuneCountInString(input.Name)

	if nameLength < 2 || nameLength > 150 {
		respondError(
			c,
			http.StatusBadRequest,
			"Nama lokasi harus terdiri dari 2–150 karakter",
		)
		return input, false
	}

	if utf8.RuneCountInString(input.Description) > 2000 {
		respondError(
			c,
			http.StatusBadRequest,
			"Deskripsi lokasi maksimal 2000 karakter",
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
				"Kode lokasi sudah digunakan",
			)
			return

		case "23503":
			respondError(
				c,
				http.StatusConflict,
				"Lokasi masih digunakan oleh data aset dan tidak dapat dihapus",
			)
			return
		}
	}

	log.Printf(
		"[locations] database error: %v",
		err,
	)

	respondError(
		c,
		http.StatusInternalServerError,
		"Terjadi kesalahan saat mengakses database lokasi",
	)
}

func (h *Handler) List(c *gin.Context) {
	page, err := strconv.Atoi(c.DefaultQuery("page", "1"))

	if err != nil || page < 1 || page > 1000000 {
		respondError(
			c,
			http.StatusBadRequest,
			"Nomor halaman tidak valid",
		)
		return
	}

	search := strings.TrimSpace(c.Query("q"))

	if utf8.RuneCountInString(search) > 100 {
		respondError(
			c,
			http.StatusBadRequest,
			"Pencarian maksimal 100 karakter",
		)
		return
	}

	const limit = 10
	offset := (page - 1) * limit

	var total int64

	err = h.db.QueryRow(
		c.Request.Context(),
		`
		SELECT COUNT(*)
		FROM public.locations
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
			created_at
		FROM public.locations
		WHERE (
			$1::text = ''
			OR code ILIKE '%' || $1::text || '%'
			OR name ILIKE '%' || $1::text || '%'
		)
		ORDER BY created_at DESC, id DESC
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

	items := make([]Location, 0)

	for rows.Next() {
		var item Location

		if err := rows.Scan(
			&item.ID,
			&item.Code,
			&item.Name,
			&item.Description,
			&item.CreatedAt,
		); err != nil {
			databaseError(c, err)
			return
		}

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

	var item Location

	err := h.db.QueryRow(
		c.Request.Context(),
		`
		SELECT
			id::text,
			code,
			name,
			COALESCE(description, ''),
			created_at
		FROM public.locations
		WHERE id = $1::uuid
		`,
		id,
	).Scan(
		&item.ID,
		&item.Code,
		&item.Name,
		&item.Description,
		&item.CreatedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		respondError(
			c,
			http.StatusNotFound,
			"Lokasi tidak ditemukan",
		)
		return
	}

	if err != nil {
		databaseError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": item,
	})
}

func (h *Handler) Create(c *gin.Context) {
	input, ok := parseInput(c)
	if !ok {
		return
	}

	var item Location

	err := h.db.QueryRow(
		c.Request.Context(),
		`
		INSERT INTO public.locations (
			code,
			name,
			description
		)
		VALUES (
			$1,
			$2,
			NULLIF($3, '')
		)
		RETURNING
			id::text,
			code,
			name,
			COALESCE(description, ''),
			created_at
		`,
		input.Code,
		input.Name,
		input.Description,
	).Scan(
		&item.ID,
		&item.Code,
		&item.Name,
		&item.Description,
		&item.CreatedAt,
	)

	if err != nil {
		databaseError(c, err)
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Lokasi berhasil ditambahkan",
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

	var item Location

	err := h.db.QueryRow(
		c.Request.Context(),
		`
		UPDATE public.locations
		SET
			code = $2,
			name = $3,
			description = NULLIF($4, '')
		WHERE id = $1::uuid
		RETURNING
			id::text,
			code,
			name,
			COALESCE(description, ''),
			created_at
		`,
		id,
		input.Code,
		input.Name,
		input.Description,
	).Scan(
		&item.ID,
		&item.Code,
		&item.Name,
		&item.Description,
		&item.CreatedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		respondError(
			c,
			http.StatusNotFound,
			"Lokasi tidak ditemukan",
		)
		return
	}

	if err != nil {
		databaseError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Lokasi berhasil diperbarui",
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
		DELETE FROM public.locations
		WHERE id = $1::uuid
		`,
		id,
	)

	if err != nil {
		databaseError(c, err)
		return
	}

	if result.RowsAffected() == 0 {
		respondError(
			c,
			http.StatusNotFound,
			"Lokasi tidak ditemukan",
		)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Lokasi berhasil dihapus",
	})
}
