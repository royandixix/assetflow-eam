package workorders

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

type Item struct {
	ID               string    `json:"id"`
	Number           string    `json:"number"`
	MaintenanceID    string    `json:"maintenance_id"`
	AssetCode        string    `json:"asset_code"`
	AssetName        string    `json:"asset_name"`
	ReporterName     string    `json:"reporter_name"`
	TechnicianID     string    `json:"technician_id"`
	TechnicianName   string    `json:"technician_name"`
	Title            string    `json:"title"`
	Description      string    `json:"description"`
	Priority         string    `json:"priority"`
	Status           string    `json:"status"`
	StartDate        string    `json:"start_date"`
	DueDate          string    `json:"due_date"`
	StartedAt        string    `json:"started_at"`
	CompletedAt      string    `json:"completed_at"`
	ClosedAt         string    `json:"closed_at"`
	CompletionNotes  string    `json:"completion_notes"`
	VerificationNote string    `json:"verification_note"`
	FinalCondition   string    `json:"final_condition"`
	CreatedAt        time.Time `json:"created_at"`
	CanStart         bool      `json:"can_start"`
	CanComplete      bool      `json:"can_complete"`
	CanClose         bool      `json:"can_close"`
}

type createInput struct {
	MaintenanceID string `json:"maintenance_id"`
	TechnicianID  string `json:"technician_id"`
	Title         string `json:"title"`
	Description   string `json:"description"`
	StartDate     string `json:"start_date"`
	DueDate       string `json:"due_date"`
}

type lockedOrder struct {
	AssetID       string
	MaintenanceID string
	AssetStatus   string
	ReportStatus  string
	Status        string
	TechnicianID  string
}

var uuidPattern = regexp.MustCompile(
	`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`,
)

func fail(c *gin.Context, status int, message string) {
	c.JSON(status, gin.H{"message": message})
}

func dbError(c *gin.Context, err error) {
	var pgErr *pgconn.PgError

	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "42P01", "42703":
			fail(
				c,
				http.StatusServiceUnavailable,
				"Migrasi Work Orders belum diterapkan atau belum sesuai",
			)
			return

		case "23505":
			fail(
				c,
				http.StatusConflict,
				"Laporan atau aset sudah memiliki Work Order",
			)
			return

		case "23503":
			fail(
				c,
				http.StatusConflict,
				"Relasi laporan, aset, atau pengguna tidak valid",
			)
			return

		case "23514", "22001", "22007":
			fail(
				c,
				http.StatusBadRequest,
				"Data Work Order tidak valid",
			)
			return
		}
	}

	log.Printf("[workorders] %v", err)

	fail(
		c,
		http.StatusInternalServerError,
		"Gagal memproses Work Order",
	)
}

func isAdmin(role string) bool {
	return role == "SUPER_ADMIN" ||
		role == "ASSET_ADMIN"
}

func isSupervisor(role string) bool {
	return isAdmin(role) || role == "MANAGER"
}

func validDate(value string) bool {
	date, err := time.Parse("2006-01-02", value)

	return err == nil &&
		date.Format("2006-01-02") == value
}

const listFrom = `
FROM public.work_orders w
JOIN public.maintenance_requests m
    ON m.id = w.maintenance_request_id
JOIN public.assets a
    ON a.id = w.asset_id
JOIN public.profiles t
    ON t.id = w.technician_id
JOIN public.profiles r
    ON r.id = m.reported_by
`

const listWhere = `
WHERE (
    $1::boolean
    OR ($2::boolean AND w.technician_id = $3::uuid)
    OR ($4::boolean AND m.reported_by = $3::uuid)
)
AND ($5::text = '' OR w.status = $5)
AND (
    $6::text = ''
    OR w.number ILIKE '%' || $6 || '%'
    OR a.asset_code ILIKE '%' || $6 || '%'
    OR a.name ILIKE '%' || $6 || '%'
    OR t.full_name ILIKE '%' || $6 || '%'
)
`

const listSelect = `
SELECT
    w.id::text,
    w.number,
    w.maintenance_request_id::text,
    a.asset_code,
    a.name,
    r.full_name,
    w.technician_id::text,
    t.full_name,
    w.title,
    w.description,
    m.priority,
    w.status,
    to_char(w.start_date, 'YYYY-MM-DD'),
    to_char(w.due_date, 'YYYY-MM-DD'),
    COALESCE(to_char(w.started_at, 'YYYY-MM-DD HH24:MI'), ''),
    COALESCE(to_char(w.completed_at, 'YYYY-MM-DD HH24:MI'), ''),
    COALESCE(to_char(w.closed_at, 'YYYY-MM-DD HH24:MI'), ''),
    w.completion_notes,
    w.verification_note,
    COALESCE(w.final_condition, ''),
    w.created_at
`

func scanItem(
	rows pgx.Rows,
	roleCode string,
	userID string,
) (Item, error) {
	var item Item

	err := rows.Scan(
		&item.ID,
		&item.Number,
		&item.MaintenanceID,
		&item.AssetCode,
		&item.AssetName,
		&item.ReporterName,
		&item.TechnicianID,
		&item.TechnicianName,
		&item.Title,
		&item.Description,
		&item.Priority,
		&item.Status,
		&item.StartDate,
		&item.DueDate,
		&item.StartedAt,
		&item.CompletedAt,
		&item.ClosedAt,
		&item.CompletionNotes,
		&item.VerificationNote,
		&item.FinalCondition,
		&item.CreatedAt,
	)

	if err != nil {
		return item, err
	}

	canExecute := roleCode == "SUPER_ADMIN" ||
		(roleCode == "TECHNICIAN" &&
			userID == item.TechnicianID)

	item.CanStart = item.Status == "ASSIGNED" && canExecute
	item.CanComplete = item.Status == "IN_PROGRESS" && canExecute
	item.CanClose = item.Status == "COMPLETED" &&
		isSupervisor(roleCode)

	return item, nil
}

func (h *Handler) List(c *gin.Context) {
	user, ok := middleware.CurrentIdentity(c)

	if !ok {
		fail(c, http.StatusUnauthorized, "Login diperlukan")
		return
	}

	page, err := strconv.Atoi(c.DefaultQuery("page", "1"))

	if err != nil || page < 1 || page > 100000 {
		fail(c, http.StatusBadRequest, "Halaman tidak valid")
		return
	}

	status := strings.ToUpper(
		strings.TrimSpace(c.Query("status")),
	)

	q := strings.TrimSpace(c.Query("q"))

	allowed := map[string]bool{
		"":            true,
		"ASSIGNED":    true,
		"IN_PROGRESS": true,
		"COMPLETED":   true,
		"CLOSED":      true,
	}

	if !allowed[status] || utf8.RuneCountInString(q) > 100 {
		fail(c, http.StatusBadRequest, "Filter Work Order tidak valid")
		return
	}

	args := []any{
		isSupervisor(user.RoleCode),
		user.RoleCode == "TECHNICIAN",
		user.ID,
		user.RoleCode == "STAFF",
		status,
		q,
	}

	var total int64

	err = h.db.QueryRow(
		c.Request.Context(),
		"SELECT COUNT(*)"+listFrom+listWhere,
		args...,
	).Scan(&total)

	if err != nil {
		dbError(c, err)
		return
	}

	rows, err := h.db.Query(
		c.Request.Context(),
		listSelect+listFrom+listWhere+`
ORDER BY w.created_at DESC, w.id DESC
LIMIT $7 OFFSET $8`,
		append(args, 10, (page-1)*10)...,
	)

	if err != nil {
		dbError(c, err)
		return
	}
	defer rows.Close()

	data := make([]Item, 0)

	for rows.Next() {
		item, scanErr := scanItem(
			rows,
			user.RoleCode,
			user.ID,
		)

		if scanErr != nil {
			dbError(c, scanErr)
			return
		}

		data = append(data, item)
	}

	if err := rows.Err(); err != nil {
		dbError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": data,
		"pagination": gin.H{
			"page":  page,
			"limit": 10,
			"total": total,
		},
	})
}

func (h *Handler) Options(c *gin.Context) {
	user, ok := middleware.CurrentIdentity(c)

	if !ok {
		fail(c, http.StatusUnauthorized, "Login diperlukan")
		return
	}

	response := gin.H{
		"can_create":  isAdmin(user.RoleCode),
		"requests":    []gin.H{},
		"technicians": []gin.H{},
	}

	if !isAdmin(user.RoleCode) {
		c.JSON(http.StatusOK, response)
		return
	}

	rows, err := h.db.Query(
		c.Request.Context(),
		`
SELECT
    m.id::text,
    a.asset_code,
    a.name,
    m.priority
FROM public.maintenance_requests m
JOIN public.assets a ON a.id = m.asset_id
WHERE m.status = 'APPROVED'
AND a.status IN ('AVAILABLE', 'ASSIGNED')
AND NOT EXISTS (
    SELECT 1
    FROM public.work_orders w
    WHERE w.maintenance_request_id = m.id
)
AND NOT EXISTS (
    SELECT 1
    FROM public.work_orders w
    WHERE w.asset_id = m.asset_id
      AND w.status <> 'CLOSED'
)
ORDER BY m.created_at DESC
LIMIT 500`,
	)

	if err != nil {
		dbError(c, err)
		return
	}

	requests := make([]gin.H, 0)

	for rows.Next() {
		var id string
		var code string
		var name string
		var priority string

		if err := rows.Scan(
			&id,
			&code,
			&name,
			&priority,
		); err != nil {
			rows.Close()
			dbError(c, err)
			return
		}

		requests = append(requests, gin.H{
			"id":         id,
			"asset_code": code,
			"asset_name": name,
			"priority":   priority,
		})
	}

	if err := rows.Err(); err != nil {
		rows.Close()
		dbError(c, err)
		return
	}

	rows.Close()

	techRows, err := h.db.Query(
		c.Request.Context(),
		`
SELECT id::text, full_name
FROM public.profiles
WHERE role_code = 'TECHNICIAN'
  AND is_active = TRUE
ORDER BY full_name
LIMIT 500`,
	)

	if err != nil {
		dbError(c, err)
		return
	}
	defer techRows.Close()

	technicians := make([]gin.H, 0)

	for techRows.Next() {
		var id string
		var name string

		if err := techRows.Scan(&id, &name); err != nil {
			dbError(c, err)
			return
		}

		technicians = append(technicians, gin.H{
			"id":   id,
			"name": name,
		})
	}

	if err := techRows.Err(); err != nil {
		dbError(c, err)
		return
	}

	response["requests"] = requests
	response["technicians"] = technicians

	c.JSON(http.StatusOK, response)
}

func (h *Handler) Create(c *gin.Context) {
	user, ok := middleware.CurrentIdentity(c)

	if !ok {
		fail(c, http.StatusUnauthorized, "Login diperlukan")
		return
	}

	var input createInput

	if err := c.ShouldBindJSON(&input); err != nil {
		fail(c, http.StatusBadRequest, "Format Work Order tidak valid")
		return
	}

	input.MaintenanceID = strings.TrimSpace(input.MaintenanceID)
	input.TechnicianID = strings.TrimSpace(input.TechnicianID)
	input.Title = strings.TrimSpace(input.Title)
	input.Description = strings.TrimSpace(input.Description)

	if !uuidPattern.MatchString(input.MaintenanceID) ||
		!uuidPattern.MatchString(input.TechnicianID) {
		fail(
			c,
			http.StatusBadRequest,
			"Laporan atau teknisi tidak valid",
		)
		return
	}

	if utf8.RuneCountInString(input.Title) < 5 ||
		utf8.RuneCountInString(input.Title) > 160 ||
		utf8.RuneCountInString(input.Description) > 2000 {
		fail(
			c,
			http.StatusBadRequest,
			"Judul atau instruksi kerja tidak valid",
		)
		return
	}

	if !validDate(input.StartDate) ||
		!validDate(input.DueDate) ||
		input.DueDate < input.StartDate {
		fail(
			c,
			http.StatusBadRequest,
			"Jadwal pekerjaan tidak valid",
		)
		return
	}

	ctx := c.Request.Context()

	tx, err := h.db.Begin(ctx)

	if err != nil {
		dbError(c, err)
		return
	}
	defer tx.Rollback(ctx)

	var assetID string

	err = tx.QueryRow(
		ctx,
		`
SELECT asset_id::text
FROM public.maintenance_requests
WHERE id = $1::uuid`,
		input.MaintenanceID,
	).Scan(&assetID)

	if errors.Is(err, pgx.ErrNoRows) {
		fail(
			c,
			http.StatusNotFound,
			"Laporan Maintenance tidak ditemukan",
		)
		return
	}

	if err != nil {
		dbError(c, err)
		return
	}

	var assetStatus string

	err = tx.QueryRow(
		ctx,
		`
SELECT status
FROM public.assets
WHERE id = $1::uuid
FOR UPDATE`,
		assetID,
	).Scan(&assetStatus)

	if err != nil {
		dbError(c, err)
		return
	}

	if assetStatus != "AVAILABLE" &&
		assetStatus != "ASSIGNED" {
		fail(
			c,
			http.StatusConflict,
			"Aset tidak dapat dibuatkan Work Order",
		)
		return
	}

	var reportStatus string
	var reportAssetID string

	err = tx.QueryRow(
		ctx,
		`
SELECT status, asset_id::text
FROM public.maintenance_requests
WHERE id = $1::uuid
FOR UPDATE`,
		input.MaintenanceID,
	).Scan(
		&reportStatus,
		&reportAssetID,
	)

	if err != nil {
		dbError(c, err)
		return
	}

	if reportAssetID != assetID ||
		reportStatus != "APPROVED" {
		fail(
			c,
			http.StatusConflict,
			"Hanya laporan Maintenance disetujui yang dapat dibuatkan Work Order",
		)
		return
	}

	var technicianExists bool

	err = tx.QueryRow(
		ctx,
		`
SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = $1::uuid
      AND role_code = 'TECHNICIAN'
      AND is_active = TRUE
)`,
		input.TechnicianID,
	).Scan(&technicianExists)

	if err != nil {
		dbError(c, err)
		return
	}

	if !technicianExists {
		fail(
			c,
			http.StatusBadRequest,
			"Teknisi aktif tidak ditemukan",
		)
		return
	}

	var id string
	var number string

	err = tx.QueryRow(
		ctx,
		`
INSERT INTO public.work_orders (
    maintenance_request_id,
    asset_id,
    technician_id,
    created_by,
    title,
    description,
    start_date,
    due_date
)
VALUES (
    $1::uuid,
    $2::uuid,
    $3::uuid,
    $4::uuid,
    $5,
    $6,
    $7::date,
    $8::date
)
RETURNING id::text, number`,
		input.MaintenanceID,
		assetID,
		input.TechnicianID,
		user.ID,
		input.Title,
		input.Description,
		input.StartDate,
		input.DueDate,
	).Scan(&id, &number)

	if err != nil {
		dbError(c, err)
		return
	}

	if err := tx.Commit(ctx); err != nil {
		dbError(c, err)
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":      id,
		"number":  number,
		"message": "Work Order berhasil dibuat",
	})
}

func lockOrder(
	ctx context.Context,
	tx pgx.Tx,
	id string,
) (lockedOrder, error) {
	var item lockedOrder

	err := tx.QueryRow(
		ctx,
		`
SELECT
    asset_id::text,
    maintenance_request_id::text
FROM public.work_orders
WHERE id = $1::uuid`,
		id,
	).Scan(
		&item.AssetID,
		&item.MaintenanceID,
	)

	if err != nil {
		return item, err
	}

	err = tx.QueryRow(
		ctx,
		`
SELECT status
FROM public.assets
WHERE id = $1::uuid
FOR UPDATE`,
		item.AssetID,
	).Scan(&item.AssetStatus)

	if err != nil {
		return item, err
	}

	err = tx.QueryRow(
		ctx,
		`
SELECT status
FROM public.maintenance_requests
WHERE id = $1::uuid
FOR UPDATE`,
		item.MaintenanceID,
	).Scan(&item.ReportStatus)

	if err != nil {
		return item, err
	}

	err = tx.QueryRow(
		ctx,
		`
SELECT status, technician_id::text
FROM public.work_orders
WHERE id = $1::uuid
  AND asset_id = $2::uuid
  AND maintenance_request_id = $3::uuid
FOR UPDATE`,
		id,
		item.AssetID,
		item.MaintenanceID,
	).Scan(
		&item.Status,
		&item.TechnicianID,
	)

	return item, err
}

func (h *Handler) Start(c *gin.Context) {
	user, ok := middleware.CurrentIdentity(c)

	if !ok {
		fail(c, http.StatusUnauthorized, "Login diperlukan")
		return
	}

	id := c.Param("id")

	if !uuidPattern.MatchString(id) {
		fail(c, http.StatusBadRequest, "ID Work Order tidak valid")
		return
	}

	ctx := c.Request.Context()

	tx, err := h.db.Begin(ctx)

	if err != nil {
		dbError(c, err)
		return
	}
	defer tx.Rollback(ctx)

	item, err := lockOrder(ctx, tx, id)

	if errors.Is(err, pgx.ErrNoRows) {
		fail(c, http.StatusNotFound, "Work Order tidak ditemukan")
		return
	}

	if err != nil {
		dbError(c, err)
		return
	}

	if user.RoleCode != "SUPER_ADMIN" &&
		item.TechnicianID != user.ID {
		fail(c, http.StatusForbidden, "Work Order bukan tugas Anda")
		return
	}

	if item.Status != "ASSIGNED" ||
		item.ReportStatus != "APPROVED" ||
		item.AssetStatus != "AVAILABLE" {
		fail(
			c,
			http.StatusConflict,
			"Aset harus tersedia, laporan disetujui, dan Work Order berstatus Ditugaskan",
		)
		return
	}

	var hasAssignment bool

	err = tx.QueryRow(
		ctx,
		`
SELECT EXISTS (
    SELECT 1
    FROM public.asset_assignments
    WHERE asset_id = $1::uuid
      AND returned_at IS NULL
)`,
		item.AssetID,
	).Scan(&hasAssignment)

	if err != nil {
		dbError(c, err)
		return
	}

	if hasAssignment {
		fail(
			c,
			http.StatusConflict,
			"Aset masih ditugaskan ke pegawai. Selesaikan pengembaliannya dahulu",
		)
		return
	}

	tag, err := tx.Exec(
		ctx,
		`
UPDATE public.assets
SET status = 'MAINTENANCE',
    updated_at = NOW()
WHERE id = $1::uuid
  AND status = 'AVAILABLE'`,
		item.AssetID,
	)

	if err != nil {
		dbError(c, err)
		return
	}

	if tag.RowsAffected() != 1 {
		fail(c, http.StatusConflict, "Status aset berubah")
		return
	}

	tag, err = tx.Exec(
		ctx,
		`
UPDATE public.maintenance_requests
SET status = 'IN_PROGRESS',
    updated_at = NOW()
WHERE id = $1::uuid
  AND status = 'APPROVED'`,
		item.MaintenanceID,
	)

	if err != nil {
		dbError(c, err)
		return
	}

	if tag.RowsAffected() != 1 {
		fail(c, http.StatusConflict, "Status Maintenance berubah")
		return
	}

	tag, err = tx.Exec(
		ctx,
		`
UPDATE public.work_orders
SET status = 'IN_PROGRESS',
    started_at = NOW(),
    updated_at = NOW()
WHERE id = $1::uuid
  AND status = 'ASSIGNED'`,
		id,
	)

	if err != nil {
		dbError(c, err)
		return
	}

	if tag.RowsAffected() != 1 {
		fail(c, http.StatusConflict, "Work Order telah diproses")
		return
	}

	if err := tx.Commit(ctx); err != nil {
		dbError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Work Order mulai dikerjakan",
	})
}

func (h *Handler) Complete(c *gin.Context) {
	user, ok := middleware.CurrentIdentity(c)

	if !ok {
		fail(c, http.StatusUnauthorized, "Login diperlukan")
		return
	}

	id := c.Param("id")

	if !uuidPattern.MatchString(id) {
		fail(c, http.StatusBadRequest, "ID Work Order tidak valid")
		return
	}

	var input struct {
		Notes string `json:"notes"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		fail(
			c,
			http.StatusBadRequest,
			"Format hasil pekerjaan tidak valid",
		)
		return
	}

	input.Notes = strings.TrimSpace(input.Notes)

	if utf8.RuneCountInString(input.Notes) < 10 ||
		utf8.RuneCountInString(input.Notes) > 2000 {
		fail(
			c,
			http.StatusBadRequest,
			"Hasil pekerjaan harus 10 sampai 2000 karakter",
		)
		return
	}

	ctx := c.Request.Context()

	tx, err := h.db.Begin(ctx)

	if err != nil {
		dbError(c, err)
		return
	}
	defer tx.Rollback(ctx)

	item, err := lockOrder(ctx, tx, id)

	if errors.Is(err, pgx.ErrNoRows) {
		fail(c, http.StatusNotFound, "Work Order tidak ditemukan")
		return
	}

	if err != nil {
		dbError(c, err)
		return
	}

	if user.RoleCode != "SUPER_ADMIN" &&
		item.TechnicianID != user.ID {
		fail(c, http.StatusForbidden, "Work Order bukan tugas Anda")
		return
	}

	if item.Status != "IN_PROGRESS" ||
		item.ReportStatus != "IN_PROGRESS" ||
		item.AssetStatus != "MAINTENANCE" {
		fail(
			c,
			http.StatusConflict,
			"Pekerjaan belum dimulai atau status sudah berubah",
		)
		return
	}

	tag, err := tx.Exec(
		ctx,
		`
UPDATE public.maintenance_requests
SET status = 'COMPLETED',
    updated_at = NOW()
WHERE id = $1::uuid
  AND status = 'IN_PROGRESS'`,
		item.MaintenanceID,
	)

	if err != nil {
		dbError(c, err)
		return
	}

	if tag.RowsAffected() != 1 {
		fail(c, http.StatusConflict, "Status Maintenance berubah")
		return
	}

	tag, err = tx.Exec(
		ctx,
		`
UPDATE public.work_orders
SET status = 'COMPLETED',
    completion_notes = $2,
    completed_at = NOW(),
    updated_at = NOW()
WHERE id = $1::uuid
  AND status = 'IN_PROGRESS'`,
		id,
		input.Notes,
	)

	if err != nil {
		dbError(c, err)
		return
	}

	if tag.RowsAffected() != 1 {
		fail(c, http.StatusConflict, "Status Work Order berubah")
		return
	}

	if err := tx.Commit(ctx); err != nil {
		dbError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Hasil pekerjaan dikirim untuk verifikasi",
	})
}

func (h *Handler) Close(c *gin.Context) {
	user, ok := middleware.CurrentIdentity(c)

	if !ok {
		fail(c, http.StatusUnauthorized, "Login diperlukan")
		return
	}

	id := c.Param("id")

	if !uuidPattern.MatchString(id) {
		fail(c, http.StatusBadRequest, "ID Work Order tidak valid")
		return
	}

	var input struct {
		Note      string `json:"note"`
		Condition string `json:"condition"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		fail(
			c,
			http.StatusBadRequest,
			"Format verifikasi tidak valid",
		)
		return
	}

	input.Note = strings.TrimSpace(input.Note)
	input.Condition = strings.ToUpper(
		strings.TrimSpace(input.Condition),
	)

	if utf8.RuneCountInString(input.Note) < 10 ||
		utf8.RuneCountInString(input.Note) > 1000 ||
		(input.Condition != "GOOD" &&
			input.Condition != "FAIR") {
		fail(
			c,
			http.StatusBadRequest,
			"Catatan minimal 10 karakter dan kondisi akhir harus Baik atau Cukup",
		)
		return
	}

	ctx := c.Request.Context()

	tx, err := h.db.Begin(ctx)

	if err != nil {
		dbError(c, err)
		return
	}
	defer tx.Rollback(ctx)

	item, err := lockOrder(ctx, tx, id)

	if errors.Is(err, pgx.ErrNoRows) {
		fail(c, http.StatusNotFound, "Work Order tidak ditemukan")
		return
	}

	if err != nil {
		dbError(c, err)
		return
	}

	if item.Status != "COMPLETED" ||
		item.ReportStatus != "COMPLETED" ||
		item.AssetStatus != "MAINTENANCE" {
		fail(
			c,
			http.StatusConflict,
			"Work Order belum selesai atau status aset sudah berubah",
		)
		return
	}

	tag, err := tx.Exec(
		ctx,
		`
UPDATE public.work_orders
SET status = 'CLOSED',
    verification_note = $2,
    final_condition = $3,
    verified_by = $4::uuid,
    closed_at = NOW(),
    updated_at = NOW()
WHERE id = $1::uuid
  AND status = 'COMPLETED'`,
		id,
		input.Note,
		input.Condition,
		user.ID,
	)

	if err != nil {
		dbError(c, err)
		return
	}

	if tag.RowsAffected() != 1 {
		fail(c, http.StatusConflict, "Status Work Order berubah")
		return
	}

	tag, err = tx.Exec(
		ctx,
		`
UPDATE public.maintenance_requests
SET status = 'CLOSED',
    updated_at = NOW()
WHERE id = $1::uuid
  AND status = 'COMPLETED'`,
		item.MaintenanceID,
	)

	if err != nil {
		dbError(c, err)
		return
	}

	if tag.RowsAffected() != 1 {
		fail(c, http.StatusConflict, "Status Maintenance berubah")
		return
	}

	tag, err = tx.Exec(
		ctx,
		`
UPDATE public.assets
SET status = 'AVAILABLE',
    condition = $2,
    updated_at = NOW()
WHERE id = $1::uuid
  AND status = 'MAINTENANCE'`,
		item.AssetID,
		input.Condition,
	)

	if err != nil {
		dbError(c, err)
		return
	}

	if tag.RowsAffected() != 1 {
		fail(c, http.StatusConflict, "Status aset berubah")
		return
	}

	if err := tx.Commit(ctx); err != nil {
		dbError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Work Order ditutup dan aset kembali tersedia",
	})
}
