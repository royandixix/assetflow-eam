package assets

import (
	"context"
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

type Asset struct {
	ID             string    `json:"id"`
	AssetCode      string    `json:"asset_code"`
	Name           string    `json:"name"`
	CategoryID     string    `json:"category_id"`
	CategoryName   string    `json:"category_name"`
	LocationID     string    `json:"location_id"`
	LocationName   string    `json:"location_name"`
	DepartmentID   string    `json:"department_id"`
	DepartmentName string    `json:"department_name"`
	Status         string    `json:"status"`
	Condition      string    `json:"condition"`
	PurchaseDate   string    `json:"purchase_date"`
	PurchasePrice  string    `json:"purchase_price"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type AssetInput struct {
	AssetCode     string `json:"asset_code"`
	Name          string `json:"name"`
	CategoryID    string `json:"category_id"`
	LocationID    string `json:"location_id"`
	DepartmentID  string `json:"department_id"`
	Condition     string `json:"condition"`
	PurchaseDate  string `json:"purchase_date"`
	PurchasePrice string `json:"purchase_price"`
}

type Option struct {
	ID   string `json:"id"`
	Code string `json:"code"`
	Name string `json:"name"`
}

var uuidPattern = regexp.MustCompile(
	`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`,
)

var codePattern = regexp.MustCompile(`^[A-Z0-9_-]{2,40}$`)

var pricePattern = regexp.MustCompile(`^[0-9]{1,12}(\.[0-9]{1,2})?$`)

const assetSelect = `
SELECT
	a.id::text,
	a.asset_code,
	a.name,
	a.category_id::text,
	c.name,
	a.location_id::text,
	l.name,
	COALESCE(a.department_id::text, ''),
	COALESCE(d.name, ''),
	a.status,
	a.condition,
	COALESCE(to_char(a.purchase_date, 'YYYY-MM-DD'), ''),
	COALESCE(a.purchase_price::text, ''),
	a.created_at,
	a.updated_at
FROM public.assets a
JOIN public.asset_categories c ON c.id = a.category_id
JOIN public.locations l ON l.id = a.location_id
LEFT JOIN public.departments d ON d.id = a.department_id
`

func RegisterRoutes(protected *gin.RouterGroup, db *pgxpool.Pool) {
	h := &Handler{db: db}

	group := protected.Group(
		"/assets",
		middleware.RequireRoles("SUPER_ADMIN", "ASSET_ADMIN"),
	)

	group.GET("", h.List)
	group.GET("/options", h.Options)
	group.GET("/:id", h.Get)
	group.POST("", h.Create)
	group.PUT("/:id", h.Update)
	group.DELETE("/:id", h.Delete)
}

func respondError(c *gin.Context, status int, message string) {
	c.JSON(status, gin.H{"message": message})
}

func validID(c *gin.Context) (string, bool) {
	id := strings.TrimSpace(c.Param("id"))

	if !uuidPattern.MatchString(id) {
		respondError(c, http.StatusBadRequest, "ID aset tidak valid")
		return "", false
	}

	return id, true
}

func parseInput(c *gin.Context) (AssetInput, bool) {
	var input AssetInput

	if err := c.ShouldBindJSON(&input); err != nil {
		respondError(c, http.StatusBadRequest, "Format data aset tidak valid")
		return input, false
	}

	input.AssetCode = strings.ToUpper(strings.TrimSpace(input.AssetCode))
	input.Name = strings.TrimSpace(input.Name)
	input.CategoryID = strings.TrimSpace(input.CategoryID)
	input.LocationID = strings.TrimSpace(input.LocationID)
	input.DepartmentID = strings.TrimSpace(input.DepartmentID)
	input.Condition = strings.ToUpper(strings.TrimSpace(input.Condition))
	input.PurchaseDate = strings.TrimSpace(input.PurchaseDate)
	input.PurchasePrice = strings.TrimSpace(input.PurchasePrice)

	if !codePattern.MatchString(input.AssetCode) {
		respondError(c, http.StatusBadRequest, "Kode aset harus 2–40 karakter dan menggunakan huruf, angka, - atau _")
		return input, false
	}

	nameLength := utf8.RuneCountInString(input.Name)

	if nameLength < 2 || nameLength > 160 {
		respondError(c, http.StatusBadRequest, "Nama aset harus 2–160 karakter")
		return input, false
	}

	if !uuidPattern.MatchString(input.CategoryID) {
		respondError(c, http.StatusBadRequest, "Kategori aset tidak valid")
		return input, false
	}

	if !uuidPattern.MatchString(input.LocationID) {
		respondError(c, http.StatusBadRequest, "Lokasi aset tidak valid")
		return input, false
	}

	if input.DepartmentID != "" && !uuidPattern.MatchString(input.DepartmentID) {
		respondError(c, http.StatusBadRequest, "Departemen aset tidak valid")
		return input, false
	}

	switch input.Condition {
	case "GOOD", "FAIR", "DAMAGED":
	default:
		respondError(c, http.StatusBadRequest, "Kondisi aset tidak valid")
		return input, false
	}

	if input.PurchaseDate != "" {
		date, err := time.Parse("2006-01-02", input.PurchaseDate)

		if err != nil || date.Format("2006-01-02") != input.PurchaseDate {
			respondError(c, http.StatusBadRequest, "Tanggal pembelian tidak valid")
			return input, false
		}
	}

	if input.PurchasePrice != "" && !pricePattern.MatchString(input.PurchasePrice) {
		respondError(c, http.StatusBadRequest, "Harga pembelian tidak valid")
		return input, false
	}

	return input, true
}

func databaseError(c *gin.Context, err error) {
	var pgErr *pgconn.PgError

	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "23505":
			respondError(c, http.StatusConflict, "Kode aset sudah digunakan")
			return
		case "23503":
			respondError(c, http.StatusConflict, "Relasi kategori, lokasi, atau departemen tidak sesuai, atau aset masih digunakan")
			return
		case "23514":
			respondError(c, http.StatusBadRequest, "Data aset tidak memenuhi ketentuan database")
			return
		}
	}

	log.Printf("[assets] database error: %v", err)

	respondError(c, http.StatusInternalServerError, "Terjadi kesalahan saat mengakses database aset")
}

func scanAsset(row pgx.Row) (Asset, error) {
	var item Asset

	err := row.Scan(
		&item.ID,
		&item.AssetCode,
		&item.Name,
		&item.CategoryID,
		&item.CategoryName,
		&item.LocationID,
		&item.LocationName,
		&item.DepartmentID,
		&item.DepartmentName,
		&item.Status,
		&item.Condition,
		&item.PurchaseDate,
		&item.PurchasePrice,
		&item.CreatedAt,
		&item.UpdatedAt,
	)

	return item, err
}

func (h *Handler) getByID(ctx context.Context, id string) (Asset, error) {
	return scanAsset(h.db.QueryRow(
		ctx,
		assetSelect+` WHERE a.id = $1::uuid`,
		id,
	))
}

func (h *Handler) loadOptions(ctx context.Context, query string) ([]Option, error) {
	rows, err := h.db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]Option, 0)

	for rows.Next() {
		var item Option

		if err := rows.Scan(&item.ID, &item.Code, &item.Name); err != nil {
			return nil, err
		}

		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return items, nil
}

func (h *Handler) Options(c *gin.Context) {
	ctx := c.Request.Context()

	categories, err := h.loadOptions(
		ctx,
		`
		SELECT id::text, code, name
		FROM public.asset_categories
		WHERE is_active = TRUE
		ORDER BY name, code
		`,
	)
	if err != nil {
		databaseError(c, err)
		return
	}

	locations, err := h.loadOptions(
		ctx,
		`
		SELECT id::text, code, name
		FROM public.locations
		ORDER BY name, code
		`,
	)
	if err != nil {
		databaseError(c, err)
		return
	}

	departments, err := h.loadOptions(
		ctx,
		`
		SELECT id::text, code, name
		FROM public.departments
		ORDER BY name, code
		`,
	)
	if err != nil {
		databaseError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"categories":  categories,
		"locations":   locations,
		"departments": departments,
	})
}

func (h *Handler) List(c *gin.Context) {
	page, err := strconv.Atoi(c.DefaultQuery("page", "1"))

	if err != nil || page < 1 || page > 1000000 {
		respondError(c, http.StatusBadRequest, "Nomor halaman tidak valid")
		return
	}

	search := strings.TrimSpace(c.Query("q"))
	status := strings.ToUpper(strings.TrimSpace(c.Query("status")))

	if utf8.RuneCountInString(search) > 100 {
		respondError(c, http.StatusBadRequest, "Pencarian maksimal 100 karakter")
		return
	}

	if status != "" {
		switch status {
		case "AVAILABLE", "ASSIGNED", "MAINTENANCE", "RETIRED":
		default:
			respondError(c, http.StatusBadRequest, "Filter status tidak valid")
			return
		}
	}

	const limit = 10
	offset := (page - 1) * limit
	ctx := c.Request.Context()

	const whereClause = `
	WHERE (
		$1::text = ''
		OR a.asset_code ILIKE '%' || $1::text || '%'
		OR a.name ILIKE '%' || $1::text || '%'
		OR c.name ILIKE '%' || $1::text || '%'
		OR l.name ILIKE '%' || $1::text || '%'
	)
	AND (
		$2::text = ''
		OR a.status = $2::text
	)
	`

	var total int64

	err = h.db.QueryRow(
		ctx,
		`
		SELECT COUNT(*)
		FROM public.assets a
		JOIN public.asset_categories c ON c.id = a.category_id
		JOIN public.locations l ON l.id = a.location_id
		`+whereClause,
		search,
		status,
	).Scan(&total)

	if err != nil {
		databaseError(c, err)
		return
	}

	rows, err := h.db.Query(
		ctx,
		assetSelect+whereClause+`
		ORDER BY a.created_at DESC, a.id DESC
		LIMIT $3 OFFSET $4
		`,
		search,
		status,
		limit,
		offset,
	)

	if err != nil {
		databaseError(c, err)
		return
	}
	defer rows.Close()

	items := make([]Asset, 0)

	for rows.Next() {
		item, err := scanAsset(rows)
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
	})
}

func (h *Handler) Get(c *gin.Context) {
	id, ok := validID(c)
	if !ok {
		return
	}

	item, err := h.getByID(c.Request.Context(), id)

	if errors.Is(err, pgx.ErrNoRows) {
		respondError(c, http.StatusNotFound, "Aset tidak ditemukan")
		return
	}

	if err != nil {
		databaseError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": item})
}

func (h *Handler) Create(c *gin.Context) {
	input, ok := parseInput(c)
	if !ok {
		return
	}

	var id string

	err := h.db.QueryRow(
		c.Request.Context(),
		`
		INSERT INTO public.assets (
			asset_code,
			name,
			category_id,
			location_id,
			department_id,
			condition,
			purchase_date,
			purchase_price
		)
		VALUES (
			$1,
			$2,
			$3::uuid,
			$4::uuid,
			NULLIF($5::text, '')::uuid,
			$6,
			NULLIF($7::text, '')::date,
			NULLIF($8::text, '')::numeric
		)
		RETURNING id::text
		`,
		input.AssetCode,
		input.Name,
		input.CategoryID,
		input.LocationID,
		input.DepartmentID,
		input.Condition,
		input.PurchaseDate,
		input.PurchasePrice,
	).Scan(&id)

	if err != nil {
		databaseError(c, err)
		return
	}

	item, err := h.getByID(c.Request.Context(), id)

	if err != nil {
		databaseError(c, err)
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Aset berhasil ditambahkan",
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

	var updatedID string

	err := h.db.QueryRow(
		c.Request.Context(),
		`
		UPDATE public.assets
		SET
			asset_code = $2,
			name = $3,
			category_id = $4::uuid,
			location_id = $5::uuid,
			department_id = NULLIF($6::text, '')::uuid,
			condition = $7,
			purchase_date = NULLIF($8::text, '')::date,
			purchase_price = NULLIF($9::text, '')::numeric,
			updated_at = NOW()
		WHERE id = $1::uuid
		  AND location_id IS NOT DISTINCT FROM $5::uuid
		  AND department_id IS NOT DISTINCT FROM
		      NULLIF($6::text, '')::uuid
		RETURNING id::text
		`,
		id,
		input.AssetCode,
		input.Name,
		input.CategoryID,
		input.LocationID,
		input.DepartmentID,
		input.Condition,
		input.PurchaseDate,
		input.PurchasePrice,
	).Scan(&updatedID)

	if errors.Is(err, pgx.ErrNoRows) {
		var exists bool

		lookupErr := h.db.QueryRow(
			c.Request.Context(),
			`SELECT EXISTS (
                SELECT 1
                FROM public.assets
                WHERE id = $1::uuid
            )`,
			id,
		).Scan(&exists)

		if lookupErr != nil {
			databaseError(c, lookupErr)
			return
		}

		if exists {
			respondError(
				c,
				http.StatusConflict,
				"Lokasi atau departemen tidak boleh diubah melalui Edit Aset. Gunakan Mutasi Aset.",
			)
			return
		}

		respondError(c, http.StatusNotFound, "Aset tidak ditemukan")
		return
	}

	if err != nil {
		databaseError(c, err)
		return
	}

	item, err := h.getByID(c.Request.Context(), updatedID)

	if err != nil {
		databaseError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Aset berhasil diperbarui",
		"data":    item,
	})
}

func (h *Handler) Delete(c *gin.Context) {
	id, ok := validID(c)
	if !ok {
		return
	}

	var deletedID string

	err := h.db.QueryRow(
		c.Request.Context(),
		`
		DELETE FROM public.assets
		WHERE id = $1::uuid
		AND status = 'AVAILABLE'
		RETURNING id::text
		`,
		id,
	).Scan(&deletedID)

	if errors.Is(err, pgx.ErrNoRows) {
		var status string

		lookupErr := h.db.QueryRow(
			c.Request.Context(),
			`SELECT status FROM public.assets WHERE id = $1::uuid`,
			id,
		).Scan(&status)

		if errors.Is(lookupErr, pgx.ErrNoRows) {
			respondError(c, http.StatusNotFound, "Aset tidak ditemukan")
			return
		}

		if lookupErr != nil {
			databaseError(c, lookupErr)
			return
		}

		respondError(c, http.StatusConflict, "Aset tidak dapat dihapus karena statusnya bukan Tersedia")
		return
	}

	if err != nil {
		databaseError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Aset berhasil dihapus",
	})
}
