package transfers

import (
	"encoding/base64"
	"encoding/json"
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

type Transfer struct {
	ID                 string     `json:"id"`
	AssetID            string     `json:"asset_id"`
	AssetCode          string     `json:"asset_code"`
	AssetName          string     `json:"asset_name"`
	FromLocation       string     `json:"from_location"`
	ToLocation         string     `json:"to_location"`
	FromDepartment     string     `json:"from_department"`
	ToDepartment       string     `json:"to_department"`
	TransferDate       string     `json:"transfer_date"`
	Reason             string     `json:"reason"`
	Notes              string     `json:"notes"`
	CreatedByName      string     `json:"created_by_name"`
	CreatedAt          time.Time  `json:"created_at"`
	CancelledAt        *time.Time `json:"cancelled_at"`
	CancellationReason string     `json:"cancellation_reason"`
}

type CreateInput struct {
	AssetID        string `json:"asset_id"`
	ToLocationID   string `json:"to_location_id"`
	ToDepartmentID string `json:"to_department_id"`
	TransferDate   string `json:"transfer_date"`
	Reason         string `json:"reason"`
	Notes          string `json:"notes"`
}

type AssetOption struct {
	ID           string `json:"id"`
	Code         string `json:"code"`
	Name         string `json:"name"`
	LocationID   string `json:"location_id"`
	DepartmentID string `json:"department_id"`
}

type MasterOption struct {
	ID   string `json:"id"`
	Code string `json:"code"`
	Name string `json:"name"`
}

var uuidPattern = regexp.MustCompile(
	`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`,
)

const transferFrom = `
FROM public.asset_transfers t
JOIN public.assets a ON a.id = t.asset_id
JOIN public.locations fl ON fl.id = t.from_location_id
JOIN public.locations tl ON tl.id = t.to_location_id
LEFT JOIN public.departments fd ON fd.id = t.from_department_id
LEFT JOIN public.departments td ON td.id = t.to_department_id
LEFT JOIN public.profiles p ON p.id = t.created_by
`

const transferSelect = `
SELECT
	t.id::text,
	t.asset_id::text,
	a.asset_code,
	a.name,
	fl.name,
	tl.name,
	COALESCE(fd.name, ''),
	COALESCE(td.name, ''),
	to_char(t.transfer_date, 'YYYY-MM-DD'),
	t.reason,
	t.notes,
	COALESCE(p.full_name, ''),
	t.created_at,
	t.cancelled_at,
	COALESCE(t.cancellation_reason, '')
` + transferFrom

func RegisterRoutes(
	protected *gin.RouterGroup,
	db *pgxpool.Pool,
) {
	h := &Handler{db: db}

	group := protected.Group(
		"/asset-transfers",
		middleware.RequireRoles("SUPER_ADMIN", "ASSET_ADMIN"),
	)

	group.GET("", h.List)
	group.GET("/options", h.Options)
	group.GET("/:id", h.Get)
	group.POST("", h.Create)
	group.POST("/:id/cancel", h.Cancel)
}

func fail(c *gin.Context, status int, message string) {
	c.JSON(status, gin.H{"message": message})
}

func validUUID(value string) bool {
	return uuidPattern.MatchString(value)
}

func validDate(value string) bool {
	date, err := time.Parse("2006-01-02", value)

	return err == nil &&
		date.Format("2006-01-02") == value
}

func dbError(c *gin.Context, err error) {
	var pgErr *pgconn.PgError

	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "23503":
			fail(c, http.StatusConflict,
				"Relasi aset, lokasi, atau departemen tidak valid")
			return

		case "23514":
			fail(c, http.StatusBadRequest,
				"Data mutasi tidak memenuhi aturan database")
			return

		case "23505":
			fail(c, http.StatusConflict,
				"Transaksi mutasi sudah terdaftar")
			return
		}
	}

	log.Printf("[transfers] database error: %v", err)

	fail(c, http.StatusInternalServerError,
		"Gagal memproses mutasi aset")
}

type scanner interface {
	Scan(dest ...any) error
}

func scanTransfer(row scanner) (Transfer, error) {
	var item Transfer

	err := row.Scan(
		&item.ID,
		&item.AssetID,
		&item.AssetCode,
		&item.AssetName,
		&item.FromLocation,
		&item.ToLocation,
		&item.FromDepartment,
		&item.ToDepartment,
		&item.TransferDate,
		&item.Reason,
		&item.Notes,
		&item.CreatedByName,
		&item.CreatedAt,
		&item.CancelledAt,
		&item.CancellationReason,
	)

	return item, err
}

func (h *Handler) List(c *gin.Context) {
	page, err := strconv.Atoi(c.DefaultQuery("page", "1"))

	if err != nil || page < 1 || page > 1000000 {
		fail(c, http.StatusBadRequest,
			"Halaman tidak valid")
		return
	}

	search := strings.TrimSpace(c.Query("q"))

	if utf8.RuneCountInString(search) > 100 {
		fail(c, http.StatusBadRequest,
			"Pencarian maksimal 100 karakter")
		return
	}

	const where = `
	WHERE (
		$1::text = ''
		OR a.asset_code ILIKE '%' || $1::text || '%'
		OR a.name ILIKE '%' || $1::text || '%'
		OR fl.name ILIKE '%' || $1::text || '%'
		OR tl.name ILIKE '%' || $1::text || '%'
		OR COALESCE(fd.name, '') ILIKE '%' || $1::text || '%'
		OR COALESCE(td.name, '') ILIKE '%' || $1::text || '%'
	)
	`

	const limit = 10
	ctx := c.Request.Context()

	var total int64

	err = h.db.QueryRow(
		ctx,
		`SELECT COUNT(*) `+transferFrom+where,
		search,
	).Scan(&total)

	if err != nil {
		dbError(c, err)
		return
	}

	rows, err := h.db.Query(
		ctx,
		transferSelect+where+`
		ORDER BY t.created_at DESC, t.id DESC
		LIMIT $2 OFFSET $3
		`,
		search,
		limit,
		(page-1)*limit,
	)

	if err != nil {
		dbError(c, err)
		return
	}
	defer rows.Close()

	items := make([]Transfer, 0)

	for rows.Next() {
		item, err := scanTransfer(rows)

		if err != nil {
			dbError(c, err)
			return
		}

		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		dbError(c, err)
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
	id := c.Param("id")

	if !validUUID(id) {
		fail(c, http.StatusBadRequest,
			"ID mutasi tidak valid")
		return
	}

	item, err := scanTransfer(
		h.db.QueryRow(
			c.Request.Context(),
			transferSelect+` WHERE t.id = $1::uuid`,
			id,
		),
	)

	if errors.Is(err, pgx.ErrNoRows) {
		fail(c, http.StatusNotFound,
			"Mutasi tidak ditemukan")
		return
	}

	if err != nil {
		dbError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": item})
}

func (h *Handler) Options(c *gin.Context) {
	ctx := c.Request.Context()

	assetRows, err := h.db.Query(ctx, `
		SELECT
			a.id::text,
			a.asset_code,
			a.name,
			a.location_id::text,
			COALESCE(a.department_id::text, '')
		FROM public.assets a
		WHERE a.status = 'AVAILABLE'
		  AND NOT EXISTS (
			SELECT 1
			FROM public.asset_assignments aa
			WHERE aa.asset_id = a.id
			  AND aa.returned_at IS NULL
		  )
		ORDER BY a.asset_code
		LIMIT 500
	`)

	if err != nil {
		dbError(c, err)
		return
	}

	assets := make([]AssetOption, 0)

	for assetRows.Next() {
		var item AssetOption

		err := assetRows.Scan(
			&item.ID,
			&item.Code,
			&item.Name,
			&item.LocationID,
			&item.DepartmentID,
		)

		if err != nil {
			assetRows.Close()
			dbError(c, err)
			return
		}

		assets = append(assets, item)
	}

	err = assetRows.Err()
	assetRows.Close()

	if err != nil {
		dbError(c, err)
		return
	}

	locationRows, err := h.db.Query(ctx, `
		SELECT id::text, code, name
		FROM public.locations
		ORDER BY name, code
		LIMIT 500
	`)

	if err != nil {
		dbError(c, err)
		return
	}

	locations := make([]MasterOption, 0)

	for locationRows.Next() {
		var item MasterOption

		err := locationRows.Scan(
			&item.ID, &item.Code, &item.Name,
		)

		if err != nil {
			locationRows.Close()
			dbError(c, err)
			return
		}

		locations = append(locations, item)
	}

	err = locationRows.Err()
	locationRows.Close()

	if err != nil {
		dbError(c, err)
		return
	}

	departmentRows, err := h.db.Query(ctx, `
		SELECT id::text, code, name
		FROM public.departments
		ORDER BY name, code
		LIMIT 500
	`)

	if err != nil {
		dbError(c, err)
		return
	}

	departments := make([]MasterOption, 0)

	for departmentRows.Next() {
		var item MasterOption

		err := departmentRows.Scan(
			&item.ID, &item.Code, &item.Name,
		)

		if err != nil {
			departmentRows.Close()
			dbError(c, err)
			return
		}

		departments = append(departments, item)
	}

	err = departmentRows.Err()
	departmentRows.Close()

	if err != nil {
		dbError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"assets":      assets,
		"locations":   locations,
		"departments": departments,
	})
}

func authenticatedProfileID(c *gin.Context) any {
	authHeader := strings.Fields(
		c.GetHeader("Authorization"),
	)

	if len(authHeader) != 2 ||
		!strings.EqualFold(authHeader[0], "Bearer") {
		return nil
	}

	parts := strings.Split(authHeader[1], ".")

	if len(parts) != 3 {
		return nil
	}

	payload, err := base64.RawURLEncoding.DecodeString(parts[1])

	if err != nil {
		return nil
	}

	var claims struct {
		Sub string `json:"sub"`
	}

	if err := json.Unmarshal(payload, &claims); err != nil {
		return nil
	}

	if !validUUID(claims.Sub) {
		return nil
	}

	return claims.Sub
}

func (h *Handler) Create(c *gin.Context) {
	var input CreateInput

	if err := c.ShouldBindJSON(&input); err != nil {
		fail(c, http.StatusBadRequest,
			"Format data mutasi tidak valid")
		return
	}

	input.AssetID = strings.TrimSpace(input.AssetID)
	input.ToLocationID = strings.TrimSpace(input.ToLocationID)
	input.ToDepartmentID = strings.TrimSpace(input.ToDepartmentID)
	input.TransferDate = strings.TrimSpace(input.TransferDate)
	input.Reason = strings.TrimSpace(input.Reason)
	input.Notes = strings.TrimSpace(input.Notes)

	if !validUUID(input.AssetID) ||
		!validUUID(input.ToLocationID) {
		fail(c, http.StatusBadRequest,
			"Aset atau lokasi tujuan tidak valid")
		return
	}

	if input.ToDepartmentID != "" &&
		!validUUID(input.ToDepartmentID) {
		fail(c, http.StatusBadRequest,
			"Departemen tujuan tidak valid")
		return
	}

	if !validDate(input.TransferDate) {
		fail(c, http.StatusBadRequest,
			"Tanggal mutasi tidak valid")
		return
	}

	if utf8.RuneCountInString(input.Reason) < 4 ||
		utf8.RuneCountInString(input.Reason) > 500 {
		fail(c, http.StatusBadRequest,
			"Alasan mutasi harus 4 sampai 500 karakter")
		return
	}

	if utf8.RuneCountInString(input.Notes) > 1000 {
		fail(c, http.StatusBadRequest,
			"Catatan maksimal 1000 karakter")
		return
	}

	ctx := c.Request.Context()

	tx, err := h.db.Begin(ctx)

	if err != nil {
		dbError(c, err)
		return
	}
	defer tx.Rollback(ctx)

	var fromLocation, fromDepartment, status string

	err = tx.QueryRow(ctx, `
		SELECT
			location_id::text,
			COALESCE(department_id::text, ''),
			status
		FROM public.assets
		WHERE id = $1::uuid
		FOR UPDATE
	`, input.AssetID).Scan(
		&fromLocation,
		&fromDepartment,
		&status,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		fail(c, http.StatusNotFound,
			"Aset tidak ditemukan")
		return
	}

	if err != nil {
		dbError(c, err)
		return
	}

	if status != "AVAILABLE" {
		fail(c, http.StatusConflict,
			"Hanya aset berstatus tersedia yang dapat dimutasi")
		return
	}

	var hasActiveAssignment bool

	err = tx.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM public.asset_assignments
			WHERE asset_id = $1::uuid
			  AND returned_at IS NULL
		)
	`, input.AssetID).Scan(&hasActiveAssignment)

	if err != nil {
		dbError(c, err)
		return
	}

	if hasActiveAssignment {
		fail(c, http.StatusConflict,
			"Aset masih memiliki penugasan aktif")
		return
	}

	if fromLocation == input.ToLocationID &&
		fromDepartment == input.ToDepartmentID {
		fail(c, http.StatusBadRequest,
			"Lokasi dan departemen tujuan sama dengan asal")
		return
	}

	var locationExists bool

	err = tx.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM public.locations
			WHERE id = $1::uuid
		)
	`, input.ToLocationID).Scan(&locationExists)

	if err != nil {
		dbError(c, err)
		return
	}

	if !locationExists {
		fail(c, http.StatusBadRequest,
			"Lokasi tujuan tidak ditemukan")
		return
	}

	if input.ToDepartmentID != "" {
		var departmentExists bool

		err = tx.QueryRow(ctx, `
			SELECT EXISTS (
				SELECT 1 FROM public.departments
				WHERE id = $1::uuid
			)
		`, input.ToDepartmentID).Scan(&departmentExists)

		if err != nil {
			dbError(c, err)
			return
		}

		if !departmentExists {
			fail(c, http.StatusBadRequest,
				"Departemen tujuan tidak ditemukan")
			return
		}
	}

	var transferID string

	err = tx.QueryRow(ctx, `
		INSERT INTO public.asset_transfers (
			asset_id,
			from_location_id,
			to_location_id,
			from_department_id,
			to_department_id,
			transfer_date,
			reason,
			notes,
			created_by
		)
		VALUES (
			$1::uuid,
			$2::uuid,
			$3::uuid,
			NULLIF($4::text, '')::uuid,
			NULLIF($5::text, '')::uuid,
			$6::date,
			$7,
			$8,
			$9
		)
		RETURNING id::text
	`,
		input.AssetID,
		fromLocation,
		input.ToLocationID,
		fromDepartment,
		input.ToDepartmentID,
		input.TransferDate,
		input.Reason,
		input.Notes,
		authenticatedProfileID(c),
	).Scan(&transferID)

	if err != nil {
		dbError(c, err)
		return
	}

	tag, err := tx.Exec(ctx, `
		UPDATE public.assets
		SET
			location_id = $2::uuid,
			department_id = NULLIF($3::text, '')::uuid,
			updated_at = NOW()
		WHERE id = $1::uuid
		  AND status = 'AVAILABLE'
	`,
		input.AssetID,
		input.ToLocationID,
		input.ToDepartmentID,
	)

	if err != nil {
		dbError(c, err)
		return
	}

	if tag.RowsAffected() != 1 {
		fail(c, http.StatusConflict,
			"Status aset berubah saat proses mutasi")
		return
	}

	if err := tx.Commit(ctx); err != nil {
		dbError(c, err)
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Mutasi aset berhasil disimpan",
		"id":      transferID,
	})
}
