
package departments

import (
	"context"
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

type Department struct {
	ID          string `json:"id"`
	Code        string `json:"code"`
	Name        string `json:"name"`
	Description string `json:"description"`
	CreatedAt   string `json:"created_at"`
	AssetCount  int64  `json:"asset_count"`
}

type DepartmentInput struct {
	Code        string `json:"code"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

var uuidPattern = regexp.MustCompile(
	`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`,
)

var codePattern = regexp.MustCompile(`^[A-Z0-9_-]{2,40}$`)

const departmentSelect = `
SELECT
	d.id::text,
	d.code,
	d.name,
	COALESCE(to_jsonb(d)->>'description', ''),
	COALESCE(to_jsonb(d)->>'created_at', ''),
	(
		SELECT COUNT(*)
		FROM public.assets a
		WHERE a.department_id = d.id
	)
FROM public.departments d
`

func RegisterRoutes(
	protected *gin.RouterGroup,
	db *pgxpool.Pool,
) {
	h := &Handler{db: db}

	group := protected.Group(
		"/departments",
		middleware.RequireRoles(
			"SUPER_ADMIN",
			"ASSET_ADMIN",
		),
	)

	group.GET("", h.List)
	group.GET("/:id", h.Get)
	group.POST("", h.Create)
	group.PUT("/:id", h.Update)
	group.DELETE("/:id", h.Delete)
}

func respondError(
	c *gin.Context,
	status int,
	message string,
) {
	c.JSON(status, gin.H{
		"message": message,
	})
}

func validID(c *gin.Context) (string, bool) {
	id := strings.TrimSpace(c.Param("id"))

	if !uuidPattern.MatchString(id) {
		respondError(
			c,
			http.StatusBadRequest,
			"ID departemen tidak valid",
		)
		return "", false
	}

	return id, true
}

func parseInput(c *gin.Context) (DepartmentInput, bool) {
	var input DepartmentInput

	if err := c.ShouldBindJSON(&input); err != nil {
		respondError(
			c,
			http.StatusBadRequest,
			"Format data departemen tidak valid",
		)
		return input, false
	}

	input.Code = strings.ToUpper(
		strings.TrimSpace(input.Code),
	)

	input.Name = strings.TrimSpace(input.Name)
	input.Description = strings.TrimSpace(input.Description)

	if !codePattern.MatchString(input.Code) {
		respondError(
			c,
			http.StatusBadRequest,
			"Kode departemen harus 2–40 karakter dan menggunakan huruf, angka, - atau _",
		)
		return input, false
	}

	nameLength := utf8.RuneCountInString(input.Name)

	if nameLength < 2 || nameLength > 150 {
		respondError(
			c,
			http.StatusBadRequest,
			"Nama departemen harus 2–150 karakter",
		)
		return input, false
	}

	if utf8.RuneCountInString(input.Description) > 1000 {
		respondError(
			c,
			http.StatusBadRequest,
			"Deskripsi maksimal 1000 karakter",
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
				"Kode departemen sudah digunakan",
			)
			return

		case "23503":
			respondError(
				c,
				http.StatusConflict,
				"Departemen masih memiliki hubungan dengan data lain",
			)
			return

		case "23514":
			respondError(
				c,
				http.StatusBadRequest,
				"Data departemen tidak memenuhi ketentuan database",
			)
			return
		}
	}

	log.Printf("[departments] database error: %v", err)

	respondError(
		c,
		http.StatusInternalServerError,
		"Terjadi kesalahan saat mengakses database departemen",
	)
}

func scanDepartment(row pgx.Row) (Department, error) {
	var item Department

	err := row.Scan(
		&item.ID,
		&item.Code,
		&item.Name,
		&item.Description,
		&item.CreatedAt,
		&item.AssetCount,
	)

	return item, err
}

func (h *Handler) hasDescription(
	ctx context.Context,
) (bool, error) {
	var exists bool

	err := h.db.QueryRow(
		ctx,
		`
		SELECT EXISTS (
			SELECT 1
			FROM information_schema.columns
			WHERE table_schema = 'public'
			  AND table_name = 'departments'
			  AND column_name = 'description'
		)
		`,
	).Scan(&exists)

	return exists, err
}

func (h *Handler) getByID(
	ctx context.Context,
	id string,
) (Department, error) {
	return scanDepartment(
		h.db.QueryRow(
			ctx,
			departmentSelect+`
			WHERE d.id = $1::uuid
			`,
			id,
		),
	)
}

func (h *Handler) List(c *gin.Context) {
	page, err := strconv.Atoi(
		c.DefaultQuery("page", "1"),
	)

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
	ctx := c.Request.Context()

	hasDescription, err := h.hasDescription(ctx)

	if err != nil {
		databaseError(c, err)
		return
	}

	const whereClause = `
	WHERE (
		$1::text = ''
		OR d.code ILIKE '%' || $1::text || '%'
		OR d.name ILIKE '%' || $1::text || '%'
		OR COALESCE(
			to_jsonb(d)->>'description', ''
		) ILIKE '%' || $1::text || '%'
	)
	`

	var total int64

	err = h.db.QueryRow(
		ctx,
		`
		SELECT COUNT(*)
		FROM public.departments d
		`+whereClause,
		search,
	).Scan(&total)

	if err != nil {
		databaseError(c, err)
		return
	}

	rows, err := h.db.Query(
		ctx,
		departmentSelect+whereClause+`
		ORDER BY d.code ASC, d.id ASC
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

	items := make([]Department, 0)

	for rows.Next() {
		var item Department

		err := rows.Scan(
			&item.ID,
			&item.Code,
			&item.Name,
			&item.Description,
			&item.CreatedAt,
			&item.AssetCount,
		)

		if err != nil {
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
		"supports_description": hasDescription,
	})
}

func (h *Handler) Get(c *gin.Context) {
	id, ok := validID(c)

	if !ok {
		return
	}

	item, err := h.getByID(
		c.Request.Context(),
		id,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		respondError(
			c,
			http.StatusNotFound,
			"Departemen tidak ditemukan",
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

	ctx := c.Request.Context()

	hasDescription, err := h.hasDescription(ctx)

	if err != nil {
		databaseError(c, err)
		return
	}

	if !hasDescription && input.Description != "" {
		respondError(
			c,
			http.StatusBadRequest,
			"Kolom deskripsi tidak tersedia pada tabel departemen",
		)
		return
	}

	var id string

	if hasDescription {
		err = h.db.QueryRow(
			ctx,
			`
			INSERT INTO public.departments (
				code,
				name,
				description
			)
			VALUES ($1, $2, $3)
			RETURNING id::text
			`,
			input.Code,
			input.Name,
			input.Description,
		).Scan(&id)
	} else {
		err = h.db.QueryRow(
			ctx,
			`
			INSERT INTO public.departments (
				code,
				name
			)
			VALUES ($1, $2)
			RETURNING id::text
			`,
			input.Code,
			input.Name,
		).Scan(&id)
	}

	if err != nil {
		databaseError(c, err)
		return
	}

	item, err := h.getByID(ctx, id)

	if err != nil {
		databaseError(c, err)
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Departemen berhasil ditambahkan",
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

	ctx := c.Request.Context()

	hasDescription, err := h.hasDescription(ctx)

	if err != nil {
		databaseError(c, err)
		return
	}

	if !hasDescription && input.Description != "" {
		respondError(
			c,
			http.StatusBadRequest,
			"Kolom deskripsi tidak tersedia pada tabel departemen",
		)
		return
	}

	var updatedID string

	if hasDescription {
		err = h.db.QueryRow(
			ctx,
			`
			UPDATE public.departments
			SET
				code = $2,
				name = $3,
				description = $4
			WHERE id = $1::uuid
			RETURNING id::text
			`,
			id,
			input.Code,
			input.Name,
			input.Description,
		).Scan(&updatedID)
	} else {
		err = h.db.QueryRow(
			ctx,
			`
			UPDATE public.departments
			SET
				code = $2,
				name = $3
			WHERE id = $1::uuid
			RETURNING id::text
			`,
			id,
			input.Code,
			input.Name,
		).Scan(&updatedID)
	}

	if errors.Is(err, pgx.ErrNoRows) {
		respondError(
			c,
			http.StatusNotFound,
			"Departemen tidak ditemukan",
		)
		return
	}

	if err != nil {
		databaseError(c, err)
		return
	}

	item, err := h.getByID(ctx, updatedID)

	if err != nil {
		databaseError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Departemen berhasil diperbarui",
		"data":    item,
	})
}

func (h *Handler) Delete(c *gin.Context) {
	id, ok := validID(c)

	if !ok {
		return
	}

	ctx := c.Request.Context()

	var deletedID string

	err := h.db.QueryRow(
		ctx,
		`
		DELETE FROM public.departments d
		WHERE d.id = $1::uuid
		  AND NOT EXISTS (
			SELECT 1
			FROM public.assets a
			WHERE a.department_id = d.id
		  )
		RETURNING d.id::text
		`,
		id,
	).Scan(&deletedID)

	if errors.Is(err, pgx.ErrNoRows) {
		var exists bool

		lookupErr := h.db.QueryRow(
			ctx,
			`
			SELECT EXISTS (
				SELECT 1
				FROM public.departments
				WHERE id = $1::uuid
			)
			`,
			id,
		).Scan(&exists)

		if lookupErr != nil {
			databaseError(c, lookupErr)
			return
		}

		if !exists {
			respondError(
				c,
				http.StatusNotFound,
				"Departemen tidak ditemukan",
			)
			return
		}

		respondError(
			c,
			http.StatusConflict,
			"Departemen tidak dapat dihapus karena masih digunakan oleh aset",
		)
		return
	}

	if err != nil {
		databaseError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Departemen berhasil dihapus",
	})
}
