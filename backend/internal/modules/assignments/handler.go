package assignments

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

type Assignment struct {
	ID               string    `json:"id"`
	AssetID          string    `json:"asset_id"`
	AssetCode        string    `json:"asset_code"`
	AssetName        string    `json:"asset_name"`
	AssignedTo       string    `json:"assigned_to"`
	EmployeeName     string    `json:"employee_name"`
	EmployeeEmail    string    `json:"employee_email"`
	AssignedAt       string    `json:"assigned_at"`
	ExpectedReturnAt string    `json:"expected_return_at"`
	ReturnedAt       string    `json:"returned_at"`
	ConditionOut     string    `json:"condition_out"`
	ConditionIn      string    `json:"condition_in"`
	Notes            string    `json:"notes"`
	ReturnNotes      string    `json:"return_notes"`
	CreatedAt        time.Time `json:"created_at"`
}

type CreateInput struct {
	AssetID          string `json:"asset_id"`
	AssignedTo       string `json:"assigned_to"`
	AssignedAt       string `json:"assigned_at"`
	ExpectedReturnAt string `json:"expected_return_at"`
	Notes            string `json:"notes"`
}

type ReturnInput struct {
	ReturnedAt  string `json:"returned_at"`
	ConditionIn string `json:"condition_in"`
	ReturnNotes string `json:"return_notes"`
}

type AssetOption struct {
	ID        string `json:"id"`
	Code      string `json:"code"`
	Name      string `json:"name"`
	Condition string `json:"condition"`
}

type EmployeeOption struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

var uuidPattern = regexp.MustCompile(
	`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`,
)

const assignmentSelect = `
SELECT
	t.id::text,
	t.asset_id::text,
	a.asset_code,
	a.name,
	t.assigned_to::text,
	p.full_name,
	''::text,
	to_char(t.assigned_at, 'YYYY-MM-DD'),
	COALESCE(to_char(t.expected_return_at, 'YYYY-MM-DD'), ''),
	COALESCE(to_char(t.returned_at, 'YYYY-MM-DD'), ''),
	t.condition_out,
	COALESCE(t.condition_in, ''),
	t.notes,
	t.return_notes,
	t.created_at
FROM public.asset_assignments t
JOIN public.assets a ON a.id = t.asset_id
JOIN public.profiles p ON p.id = t.assigned_to
`

func RegisterRoutes(
	protected *gin.RouterGroup,
	db *pgxpool.Pool,
) {
	h := &Handler{db: db}

	group := protected.Group(
		"/asset-assignments",
		middleware.RequireRoles("SUPER_ADMIN", "ASSET_ADMIN"),
	)

	group.GET("", h.List)
	group.GET("/options", h.Options)
	group.GET("/:id", h.Get)
	group.POST("", h.Create)
	group.POST("/:id/return", h.Return)
}

func fail(c *gin.Context, status int, message string) {
	c.JSON(status, gin.H{"message": message})
}

func validUUID(value string) bool {
	return uuidPattern.MatchString(strings.TrimSpace(value))
}

func validDate(value string) bool {
	date, err := time.Parse("2006-01-02", value)
	return err == nil && date.Format("2006-01-02") == value
}

func validCondition(value string) bool {
	return value == "GOOD" ||
		value == "FAIR" ||
		value == "DAMAGED"
}

func databaseError(c *gin.Context, err error) {
	var pgErr *pgconn.PgError

	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "23505":
			fail(
				c,
				http.StatusConflict,
				"Aset sudah memiliki penugasan aktif",
			)
			return

		case "23503":
			fail(
				c,
				http.StatusConflict,
				"Relasi aset atau pegawai tidak valid",
			)
			return

		case "23514":
			fail(
				c,
				http.StatusBadRequest,
				"Data penugasan tidak memenuhi aturan database",
			)
			return
		}
	}

	log.Printf("[assignments] database error: %v", err)

	fail(
		c,
		http.StatusInternalServerError,
		"Gagal memproses data penugasan aset",
	)
}

type scanner interface {
	Scan(dest ...any) error
}

func scanAssignment(row scanner) (Assignment, error) {
	var item Assignment

	err := row.Scan(
		&item.ID,
		&item.AssetID,
		&item.AssetCode,
		&item.AssetName,
		&item.AssignedTo,
		&item.EmployeeName,
		&item.EmployeeEmail,
		&item.AssignedAt,
		&item.ExpectedReturnAt,
		&item.ReturnedAt,
		&item.ConditionOut,
		&item.ConditionIn,
		&item.Notes,
		&item.ReturnNotes,
		&item.CreatedAt,
	)

	return item, err
}

func (h *Handler) Get(c *gin.Context) {
	id := c.Param("id")

	if !validUUID(id) {
		fail(
			c,
			http.StatusBadRequest,
			"ID penugasan tidak valid",
		)
		return
	}

	item, err := scanAssignment(
		h.db.QueryRow(
			c.Request.Context(),
			assignmentSelect+` WHERE t.id = $1::uuid`,
			id,
		),
	)

	if errors.Is(err, pgx.ErrNoRows) {
		fail(
			c,
			http.StatusNotFound,
			"Penugasan tidak ditemukan",
		)
		return
	}

	if err != nil {
		databaseError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": item})
}

func (h *Handler) List(c *gin.Context) {
	page, err := strconv.Atoi(c.DefaultQuery("page", "1"))

	if err != nil || page < 1 || page > 1000000 {
		fail(
			c,
			http.StatusBadRequest,
			"Nomor halaman tidak valid",
		)
		return
	}

	search := strings.TrimSpace(c.Query("q"))
	status := strings.ToUpper(
		strings.TrimSpace(c.Query("status")),
	)

	if utf8.RuneCountInString(search) > 100 {
		fail(
			c,
			http.StatusBadRequest,
			"Pencarian maksimal 100 karakter",
		)
		return
	}

	if status != "" &&
		status != "ACTIVE" &&
		status != "RETURNED" {
		fail(
			c,
			http.StatusBadRequest,
			"Filter status tidak valid",
		)
		return
	}

	const limit = 10

	offset := (page - 1) * limit
	ctx := c.Request.Context()

	const joins = `
	FROM public.asset_assignments t
	JOIN public.assets a ON a.id = t.asset_id
	JOIN public.profiles p ON p.id = t.assigned_to
	`

	const where = `
	WHERE (
		$1::text = ''
		OR a.asset_code ILIKE '%' || $1::text || '%'
		OR a.name ILIKE '%' || $1::text || '%'
		OR p.full_name ILIKE '%' || $1::text || '%'
		
	)
	AND (
		$2::text = ''
		OR ($2::text = 'ACTIVE' AND t.returned_at IS NULL)
		OR ($2::text = 'RETURNED' AND t.returned_at IS NOT NULL)
	)
	`

	var total int64

	err = h.db.QueryRow(
		ctx,
		`SELECT COUNT(*) `+joins+where,
		search,
		status,
	).Scan(&total)

	if err != nil {
		databaseError(c, err)
		return
	}

	rows, err := h.db.Query(
		ctx,
		assignmentSelect+where+`
		ORDER BY t.created_at DESC, t.id DESC
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

	items := make([]Assignment, 0)

	for rows.Next() {
		item, err := scanAssignment(rows)

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

func (h *Handler) Options(c *gin.Context) {
	ctx := c.Request.Context()

	assetRows, err := h.db.Query(
		ctx,
		`
		SELECT
			id::text,
			asset_code,
			name,
			condition
		FROM public.assets
		WHERE status = 'AVAILABLE'
		ORDER BY asset_code
		LIMIT 200
		`,
	)

	if err != nil {
		databaseError(c, err)
		return
	}

	assets := make([]AssetOption, 0)

	for assetRows.Next() {
		var item AssetOption

		if err := assetRows.Scan(
			&item.ID,
			&item.Code,
			&item.Name,
			&item.Condition,
		); err != nil {
			assetRows.Close()
			databaseError(c, err)
			return
		}

		assets = append(assets, item)
	}

	err = assetRows.Err()
	assetRows.Close()

	if err != nil {
		databaseError(c, err)
		return
	}

	employeeRows, err := h.db.Query(
		ctx,
		`
		SELECT
			id::text,
			full_name,
			''::text
		FROM public.profiles
		WHERE is_active = TRUE
		ORDER BY full_name
		LIMIT 200
		`,
	)

	if err != nil {
		databaseError(c, err)
		return
	}

	employees := make([]EmployeeOption, 0)

	for employeeRows.Next() {
		var item EmployeeOption

		if err := employeeRows.Scan(
			&item.ID,
			&item.Name,
			&item.Email,
		); err != nil {
			employeeRows.Close()
			databaseError(c, err)
			return
		}

		employees = append(employees, item)
	}

	err = employeeRows.Err()
	employeeRows.Close()

	if err != nil {
		databaseError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"assets":    assets,
		"employees": employees,
	})
}

func (h *Handler) Create(c *gin.Context) {
	var input CreateInput

	if err := c.ShouldBindJSON(&input); err != nil {
		fail(
			c,
			http.StatusBadRequest,
			"Format penugasan tidak valid",
		)
		return
	}

	input.AssetID = strings.TrimSpace(input.AssetID)
	input.AssignedTo = strings.TrimSpace(input.AssignedTo)
	input.AssignedAt = strings.TrimSpace(input.AssignedAt)
	input.ExpectedReturnAt = strings.TrimSpace(
		input.ExpectedReturnAt,
	)
	input.Notes = strings.TrimSpace(input.Notes)

	if !validUUID(input.AssetID) ||
		!validUUID(input.AssignedTo) {
		fail(
			c,
			http.StatusBadRequest,
			"Aset atau pegawai tidak valid",
		)
		return
	}

	if !validDate(input.AssignedAt) {
		fail(
			c,
			http.StatusBadRequest,
			"Tanggal penyerahan tidak valid",
		)
		return
	}

	if input.ExpectedReturnAt != "" &&
		(!validDate(input.ExpectedReturnAt) ||
			input.ExpectedReturnAt < input.AssignedAt) {
		fail(
			c,
			http.StatusBadRequest,
			"Perkiraan pengembalian harus sama atau setelah tanggal penyerahan",
		)
		return
	}

	if utf8.RuneCountInString(input.Notes) > 1000 {
		fail(
			c,
			http.StatusBadRequest,
			"Catatan maksimal 1000 karakter",
		)
		return
	}

	ctx := c.Request.Context()

	tx, err := h.db.Begin(ctx)

	if err != nil {
		databaseError(c, err)
		return
	}

	defer tx.Rollback(ctx)

	var assetStatus, condition string

	err = tx.QueryRow(
		ctx,
		`
		SELECT status, condition
		FROM public.assets
		WHERE id = $1::uuid
		FOR UPDATE
		`,
		input.AssetID,
	).Scan(&assetStatus, &condition)

	if errors.Is(err, pgx.ErrNoRows) {
		fail(
			c,
			http.StatusNotFound,
			"Aset tidak ditemukan",
		)
		return
	}

	if err != nil {
		databaseError(c, err)
		return
	}

	if assetStatus != "AVAILABLE" {
		fail(
			c,
			http.StatusConflict,
			"Aset tidak tersedia untuk ditugaskan",
		)
		return
	}

	if !validCondition(condition) {
		fail(
			c,
			http.StatusConflict,
			"Kondisi aset tidak dapat digunakan",
		)
		return
	}

	var employeeActive bool

	err = tx.QueryRow(
		ctx,
		`
		SELECT EXISTS (
			SELECT 1
			FROM public.profiles
			WHERE id = $1::uuid
			  AND is_active = TRUE
		)
		`,
		input.AssignedTo,
	).Scan(&employeeActive)

	if err != nil {
		databaseError(c, err)
		return
	}

	if !employeeActive {
		fail(
			c,
			http.StatusBadRequest,
			"Pegawai tidak ditemukan atau tidak aktif",
		)
		return
	}

	var assignmentID string

	err = tx.QueryRow(
		ctx,
		`
		INSERT INTO public.asset_assignments (
			asset_id,
			assigned_to,
			assigned_at,
			expected_return_at,
			condition_out,
			notes
		)
		VALUES (
			$1::uuid,
			$2::uuid,
			$3::date,
			NULLIF($4::text, '')::date,
			$5,
			$6
		)
		RETURNING id::text
		`,
		input.AssetID,
		input.AssignedTo,
		input.AssignedAt,
		input.ExpectedReturnAt,
		condition,
		input.Notes,
	).Scan(&assignmentID)

	if err != nil {
		databaseError(c, err)
		return
	}

	tag, err := tx.Exec(
		ctx,
		`
		UPDATE public.assets
		SET status = 'ASSIGNED',
		    updated_at = NOW()
		WHERE id = $1::uuid
		  AND status = 'AVAILABLE'
		`,
		input.AssetID,
	)

	if err != nil {
		databaseError(c, err)
		return
	}

	if tag.RowsAffected() != 1 {
		fail(
			c,
			http.StatusConflict,
			"Status aset telah berubah",
		)
		return
	}

	if err := tx.Commit(ctx); err != nil {
		databaseError(c, err)
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Aset berhasil ditugaskan",
		"id":      assignmentID,
	})
}

func (h *Handler) Return(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))

	if !validUUID(id) {
		fail(
			c,
			http.StatusBadRequest,
			"ID penugasan tidak valid",
		)
		return
	}

	var input ReturnInput

	if err := c.ShouldBindJSON(&input); err != nil {
		fail(
			c,
			http.StatusBadRequest,
			"Format pengembalian tidak valid",
		)
		return
	}

	input.ReturnedAt = strings.TrimSpace(input.ReturnedAt)
	input.ConditionIn = strings.ToUpper(
		strings.TrimSpace(input.ConditionIn),
	)
	input.ReturnNotes = strings.TrimSpace(
		input.ReturnNotes,
	)

	if !validDate(input.ReturnedAt) {
		fail(
			c,
			http.StatusBadRequest,
			"Tanggal pengembalian tidak valid",
		)
		return
	}

	if !validCondition(input.ConditionIn) {
		fail(
			c,
			http.StatusBadRequest,
			"Kondisi pengembalian tidak valid",
		)
		return
	}

	if utf8.RuneCountInString(input.ReturnNotes) > 1000 {
		fail(
			c,
			http.StatusBadRequest,
			"Catatan pengembalian maksimal 1000 karakter",
		)
		return
	}

	ctx := c.Request.Context()

	tx, err := h.db.Begin(ctx)

	if err != nil {
		databaseError(c, err)
		return
	}

	defer tx.Rollback(ctx)

	var assetID string

	err = tx.QueryRow(
		ctx,
		`
		SELECT asset_id::text
		FROM public.asset_assignments
		WHERE id = $1::uuid
		`,
		id,
	).Scan(&assetID)

	if errors.Is(err, pgx.ErrNoRows) {
		fail(
			c,
			http.StatusNotFound,
			"Penugasan tidak ditemukan",
		)
		return
	}

	if err != nil {
		databaseError(c, err)
		return
	}

	var assetStatus string

	err = tx.QueryRow(
		ctx,
		`
		SELECT status
		FROM public.assets
		WHERE id = $1::uuid
		FOR UPDATE
		`,
		assetID,
	).Scan(&assetStatus)

	if err != nil {
		databaseError(c, err)
		return
	}

	var assignedAt, returnedAt string

	err = tx.QueryRow(
		ctx,
		`
		SELECT
			to_char(assigned_at, 'YYYY-MM-DD'),
			COALESCE(
				to_char(returned_at, 'YYYY-MM-DD'),
				''
			)
		FROM public.asset_assignments
		WHERE id = $1::uuid
		FOR UPDATE
		`,
		id,
	).Scan(&assignedAt, &returnedAt)

	if err != nil {
		databaseError(c, err)
		return
	}

	if returnedAt != "" {
		fail(
			c,
			http.StatusConflict,
			"Penugasan ini sudah dikembalikan",
		)
		return
	}

	if assetStatus != "ASSIGNED" {
		fail(
			c,
			http.StatusConflict,
			"Status aset tidak sesuai untuk pengembalian",
		)
		return
	}

	if input.ReturnedAt < assignedAt {
		fail(
			c,
			http.StatusBadRequest,
			"Tanggal pengembalian tidak boleh sebelum penyerahan",
		)
		return
	}

	_, err = tx.Exec(
		ctx,
		`
		UPDATE public.asset_assignments
		SET
			returned_at = $2::date,
			condition_in = $3,
			return_notes = $4,
			updated_at = NOW()
		WHERE id = $1::uuid
		  AND returned_at IS NULL
		`,
		id,
		input.ReturnedAt,
		input.ConditionIn,
		input.ReturnNotes,
	)

	if err != nil {
		databaseError(c, err)
		return
	}

	tag, err := tx.Exec(
		ctx,
		`
		UPDATE public.assets
		SET
			status = 'AVAILABLE',
			condition = $2,
			updated_at = NOW()
		WHERE id = $1::uuid
		  AND status = 'ASSIGNED'
		`,
		assetID,
		input.ConditionIn,
	)

	if err != nil {
		databaseError(c, err)
		return
	}

	if tag.RowsAffected() != 1 {
		fail(
			c,
			http.StatusConflict,
			"Gagal memperbarui status aset",
		)
		return
	}

	if err := tx.Commit(ctx); err != nil {
		databaseError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Pengembalian aset berhasil dicatat",
	})
}
