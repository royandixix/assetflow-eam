package maintenance

import (
	"errors"
	"log"
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

type Item struct {
	ID          string    `json:"id"`
	AssetID     string    `json:"asset_id"`
	AssetCode   string    `json:"asset_code"`
	AssetName   string    `json:"asset_name"`
	Reporter    string    `json:"reporter_name"`
	Description string    `json:"description"`
	Priority    string    `json:"priority"`
	Status      string    `json:"status"`
	ReviewNote  string    `json:"review_note"`
	CreatedAt   time.Time `json:"created_at"`
	CanReview   bool      `json:"can_review"`
}

var validID = regexp.MustCompile(
	`^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$`,
)

func reviewer(role string) bool {
	return role == "SUPER_ADMIN" ||
		role == "ASSET_ADMIN" ||
		role == "MANAGER"
}

func fail(c *gin.Context, code int, msg string) {
	c.JSON(code, gin.H{"message": msg})
}

func dbFail(c *gin.Context, err error) {
	var e *pgconn.PgError

	if errors.As(err, &e) {
		switch e.Code {
		case "23505":
			fail(c, 409, "Laporan aktif untuk aset ini sudah ada")
			return
		case "23503":
			fail(c, 409, "Aset atau pengguna tidak tersedia")
			return
		case "42P01":
			fail(c, 503, "Migrasi Maintenance belum diterapkan")
			return
		case "23514", "22001":
			fail(c, 400, "Data Maintenance tidak valid")
			return
		}
	}

	log.Printf("[maintenance] %v", err)
	fail(c, 500, "Gagal memproses pemeliharaan aset")
}

func identity(c *gin.Context) (middleware.Identity, bool) {
	user, ok := middleware.CurrentIdentity(c)

	if !ok || !validID.MatchString(user.ID) {
		fail(c, 401, "Pengguna tidak dikenal")
		return user, false
	}

	return user, true
}

func RegisterRoutes(
	group *gin.RouterGroup,
	db *pgxpool.Pool,
) {
	h := &Handler{db: db}

	r := group.Group("/maintenance-requests")

	r.Use(middleware.RequireRoles(
		"SUPER_ADMIN",
		"ASSET_ADMIN",
		"MANAGER",
		"TECHNICIAN",
		"STAFF",
	))

	r.GET("", h.List)
	r.GET("/options", h.Options)
	r.POST("", h.Create)

	r.POST(
		"/:id/review",
		middleware.RequireRoles(
			"SUPER_ADMIN",
			"ASSET_ADMIN",
			"MANAGER",
		),
		h.Review,
	)
}

const from = `
FROM public.maintenance_requests m
JOIN public.assets a ON a.id = m.asset_id
JOIN public.profiles p ON p.id = m.reported_by
`

const filter = `
WHERE ($1::boolean OR m.reported_by = $2::uuid)
AND ($3::text = '' OR m.status = $3)
AND (
    $4::text = ''
    OR a.asset_code ILIKE '%' || $4 || '%'
    OR a.name ILIKE '%' || $4 || '%'
    OR p.full_name ILIKE '%' || $4 || '%'
)
`

func (h *Handler) List(c *gin.Context) {
	user, ok := identity(c)
	if !ok {
		return
	}

	page, err := strconv.Atoi(c.DefaultQuery("page", "1"))
	if err != nil || page < 1 || page > 100000 {
		fail(c, 400, "Halaman tidak valid")
		return
	}

	q := strings.TrimSpace(c.Query("q"))
	status := strings.ToUpper(strings.TrimSpace(c.Query("status")))

	if utf8.RuneCountInString(q) > 100 {
		fail(c, 400, "Pencarian terlalu panjang")
		return
	}

	allowed := map[string]bool{
		"":            true,
		"REPORTED":    true,
		"APPROVED":    true,
		"REJECTED":    true,
		"IN_PROGRESS": true,
		"COMPLETED":   true,
		"CLOSED":      true,
	}

	if !allowed[status] {
		fail(c, 400, "Status tidak valid")
		return
	}

	args := []any{
		reviewer(user.RoleCode),
		user.ID,
		status,
		q,
	}

	var total int64

	err = h.db.QueryRow(
		c.Request.Context(),
		"SELECT COUNT(*)"+from+filter,
		args...,
	).Scan(&total)

	if err != nil {
		dbFail(c, err)
		return
	}

	rows, err := h.db.Query(
		c.Request.Context(),
		`
SELECT
    m.id::text,
    m.asset_id::text,
    a.asset_code,
    a.name,
    p.full_name,
    m.description,
    m.priority,
    m.status,
    m.review_note,
    m.created_at
`+from+filter+`
ORDER BY m.created_at DESC, m.id DESC
LIMIT $5 OFFSET $6
`,
		append(args, 10, (page-1)*10)...,
	)

	if err != nil {
		dbFail(c, err)
		return
	}

	defer rows.Close()

	data := make([]Item, 0)

	for rows.Next() {
		var v Item

		err := rows.Scan(
			&v.ID,
			&v.AssetID,
			&v.AssetCode,
			&v.AssetName,
			&v.Reporter,
			&v.Description,
			&v.Priority,
			&v.Status,
			&v.ReviewNote,
			&v.CreatedAt,
		)

		if err != nil {
			dbFail(c, err)
			return
		}

		v.CanReview = reviewer(user.RoleCode) &&
			v.Status == "REPORTED"

		data = append(data, v)
	}

	if err := rows.Err(); err != nil {
		dbFail(c, err)
		return
	}

	c.JSON(200, gin.H{
		"data": data,
		"pagination": gin.H{
			"page":  page,
			"limit": 10,
			"total": total,
		},
	})
}

func (h *Handler) Options(c *gin.Context) {
	user, ok := identity(c)
	if !ok {
		return
	}

	rows, err := h.db.Query(
		c.Request.Context(),
		`
SELECT
    a.id::text,
    a.asset_code,
    a.name
FROM public.assets a
WHERE a.status IN ('AVAILABLE', 'ASSIGNED')
AND (
    $1::boolean
    OR EXISTS (
        SELECT 1
        FROM public.asset_assignments x
        WHERE x.asset_id = a.id
        AND x.assigned_to = $2::uuid
        AND x.returned_at IS NULL
    )
)
AND NOT EXISTS (
    SELECT 1
    FROM public.maintenance_requests m
    WHERE m.asset_id = a.id
    AND m.status IN ('REPORTED','APPROVED','IN_PROGRESS')
)
ORDER BY a.asset_code
LIMIT 500
`,
		reviewer(user.RoleCode),
		user.ID,
	)

	if err != nil {
		dbFail(c, err)
		return
	}

	defer rows.Close()

	data := make([]gin.H, 0)

	for rows.Next() {
		var id, code, name string

		if err := rows.Scan(&id, &code, &name); err != nil {
			dbFail(c, err)
			return
		}

		data = append(data, gin.H{
			"id":   id,
			"code": code,
			"name": name,
		})
	}

	if err := rows.Err(); err != nil {
		dbFail(c, err)
		return
	}

	c.JSON(200, gin.H{"assets": data})
}

func (h *Handler) Create(c *gin.Context) {
	user, ok := identity(c)
	if !ok {
		return
	}

	var input struct {
		AssetID     string `json:"asset_id"`
		Description string `json:"description"`
		Priority    string `json:"priority"`
	}

	if c.ShouldBindJSON(&input) != nil {
		fail(c, 400, "Format laporan tidak valid")
		return
	}

	input.AssetID = strings.TrimSpace(input.AssetID)
	input.Description = strings.TrimSpace(input.Description)
	input.Priority = strings.ToUpper(
		strings.TrimSpace(input.Priority),
	)

	length := utf8.RuneCountInString(input.Description)

	if !validID.MatchString(input.AssetID) ||
		length < 10 || length > 2000 {
		fail(c, 400, "Aset atau deskripsi tidak valid")
		return
	}

	if input.Priority != "LOW" &&
		input.Priority != "MEDIUM" &&
		input.Priority != "HIGH" &&
		input.Priority != "CRITICAL" {
		fail(c, 400, "Prioritas tidak valid")
		return
	}

	ctx := c.Request.Context()

	tx, err := h.db.Begin(ctx)
	if err != nil {
		dbFail(c, err)
		return
	}

	defer tx.Rollback(ctx)

	var status string

	err = tx.QueryRow(
		ctx,
		`
SELECT status
FROM public.assets
WHERE id = $1::uuid
FOR UPDATE
`,
		input.AssetID,
	).Scan(&status)

	if errors.Is(err, pgx.ErrNoRows) {
		fail(c, 404, "Aset tidak ditemukan")
		return
	}

	if err != nil {
		dbFail(c, err)
		return
	}

	if status != "AVAILABLE" && status != "ASSIGNED" {
		fail(c, 409, "Status aset tidak mengizinkan laporan")
		return
	}

	if !reviewer(user.RoleCode) {
		var assigned bool

		err = tx.QueryRow(
			ctx,
			`
SELECT EXISTS (
    SELECT 1
    FROM public.asset_assignments
    WHERE asset_id = $1::uuid
    AND assigned_to = $2::uuid
    AND returned_at IS NULL
)
`,
			input.AssetID,
			user.ID,
		).Scan(&assigned)

		if err != nil {
			dbFail(c, err)
			return
		}

		if !assigned {
			fail(c, 403, "Aset tidak ditugaskan kepada Anda")
			return
		}
	}

	var id string

	err = tx.QueryRow(
		ctx,
		`
INSERT INTO public.maintenance_requests (
    asset_id,
    reported_by,
    description,
    priority
)
VALUES ($1::uuid, $2::uuid, $3, $4)
RETURNING id::text
`,
		input.AssetID,
		user.ID,
		input.Description,
		input.Priority,
	).Scan(&id)

	if err != nil {
		dbFail(c, err)
		return
	}

	if err := tx.Commit(ctx); err != nil {
		dbFail(c, err)
		return
	}

	c.JSON(201, gin.H{
		"id":      id,
		"message": "Laporan Maintenance berhasil dibuat",
	})
}

func (h *Handler) Review(c *gin.Context) {
	user, ok := identity(c)
	if !ok {
		return
	}

	id := c.Param("id")

	if !validID.MatchString(id) {
		fail(c, 400, "ID laporan tidak valid")
		return
	}

	var input struct {
		Decision string `json:"decision"`
		Note     string `json:"note"`
	}

	if c.ShouldBindJSON(&input) != nil {
		fail(c, 400, "Format keputusan tidak valid")
		return
	}

	input.Decision = strings.ToUpper(
		strings.TrimSpace(input.Decision),
	)
	input.Note = strings.TrimSpace(input.Note)

	if input.Decision != "APPROVED" &&
		input.Decision != "REJECTED" {
		fail(c, 400, "Keputusan tidak valid")
		return
	}

	length := utf8.RuneCountInString(input.Note)

	if length > 1000 ||
		(input.Decision == "REJECTED" && length < 10) {
		fail(c, 400, "Catatan penolakan minimal 10 karakter")
		return
	}

	var updated string

	err := h.db.QueryRow(
		c.Request.Context(),
		`
UPDATE public.maintenance_requests
SET
    status = $2,
    review_note = $3,
    reviewed_by = $4::uuid,
    reviewed_at = NOW(),
    updated_at = NOW()
WHERE id = $1::uuid
AND status = 'REPORTED'
RETURNING id::text
`,
		id,
		input.Decision,
		input.Note,
		user.ID,
	).Scan(&updated)

	if errors.Is(err, pgx.ErrNoRows) {
		fail(c, 409, "Laporan sudah diproses atau tidak tersedia")
		return
	}

	if err != nil {
		dbFail(c, err)
		return
	}

	c.JSON(200, gin.H{
		"id":      updated,
		"message": "Verifikasi Maintenance berhasil",
	})
}
