package vendors

import (
	"errors"
	"log"
	"net/http"
	"net/mail"
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

type Vendor struct {
	ID            string    `json:"id"`
	Code          string    `json:"code"`
	Name          string    `json:"name"`
	Category      string    `json:"category"`
	ContactPerson string    `json:"contact_person"`
	Phone         string    `json:"phone"`
	Email         string    `json:"email"`
	Address       string    `json:"address"`
	Notes         string    `json:"notes"`
	IsActive      bool      `json:"is_active"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type VendorInput struct {
	Name          string `json:"name"`
	Category      string `json:"category"`
	ContactPerson string `json:"contact_person"`
	Phone         string `json:"phone"`
	Email         string `json:"email"`
	Address       string `json:"address"`
	Notes         string `json:"notes"`
	IsActive      *bool  `json:"is_active"`
}

var vendorUUID = regexp.MustCompile(
	`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`,
)

var vendorPhone = regexp.MustCompile(
	`^[0-9+(). -]+$`,
)

const vendorColumns = `
SELECT
	v.id::text,
	v.code,
	v.name,
	v.category,
	v.contact_person,
	v.phone,
	v.email,
	v.address,
	v.notes,
	v.is_active,
	v.created_at,
	v.updated_at
FROM public.vendors v
`

type scanner interface {
	Scan(dest ...any) error
}

func scanVendor(row scanner) (Vendor, error) {
	var v Vendor

	err := row.Scan(
		&v.ID,
		&v.Code,
		&v.Name,
		&v.Category,
		&v.ContactPerson,
		&v.Phone,
		&v.Email,
		&v.Address,
		&v.Notes,
		&v.IsActive,
		&v.CreatedAt,
		&v.UpdatedAt,
	)

	return v, err
}

func fail(c *gin.Context, status int, message string) {
	c.JSON(status, gin.H{"message": message})
}

func handleDBError(c *gin.Context, err error) {
	var pgErr *pgconn.PgError

	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "42P01", "42703":
			fail(
				c,
				http.StatusServiceUnavailable,
				"Struktur tabel Vendor belum tersedia atau tidak sesuai",
			)
			return

		case "42501":
			fail(
				c,
				http.StatusServiceUnavailable,
				"Koneksi database tidak memiliki izin mengakses Vendor",
			)
			return

		case "23505":
			fail(
				c,
				http.StatusConflict,
				"Kode Vendor sudah digunakan",
			)
			return

		case "23503":
			fail(
				c,
				http.StatusConflict,
				"Referensi pengguna tidak valid",
			)
			return

		case "23514", "22001", "22P02":
			fail(
				c,
				http.StatusBadRequest,
				"Data Vendor tidak memenuhi aturan database",
			)
			return
		}
	}

	log.Printf("[vendors] database error: %v", err)

	fail(
		c,
		http.StatusInternalServerError,
		"Gagal memproses data Vendor",
	)
}

func normalize(input *VendorInput) string {
	input.Name = strings.TrimSpace(input.Name)
	input.Category = strings.ToUpper(
		strings.TrimSpace(input.Category),
	)
	input.ContactPerson = strings.TrimSpace(input.ContactPerson)
	input.Phone = strings.TrimSpace(input.Phone)
	input.Email = strings.ToLower(
		strings.TrimSpace(input.Email),
	)
	input.Address = strings.TrimSpace(input.Address)
	input.Notes = strings.TrimSpace(input.Notes)

	nameLength := utf8.RuneCountInString(input.Name)

	if nameLength < 3 || nameLength > 160 {
		return "Nama Vendor harus 3 sampai 160 karakter"
	}

	switch input.Category {
	case "SUPPLIER", "SERVICE", "BOTH":
	default:
		return "Jenis Vendor tidak valid"
	}

	if utf8.RuneCountInString(input.ContactPerson) > 120 {
		return "Nama kontak maksimal 120 karakter"
	}

	if input.Phone != "" {
		digits := 0

		for _, char := range input.Phone {
			if char >= '0' && char <= '9' {
				digits++
			}
		}

		if digits < 6 ||
			utf8.RuneCountInString(input.Phone) > 30 ||
			!vendorPhone.MatchString(input.Phone) {
			return "Nomor telepon tidak valid"
		}
	}

	if input.Email != "" {
		if len(input.Email) > 254 {
			return "Email maksimal 254 karakter"
		}

		parsed, err := mail.ParseAddress(input.Email)

		if err != nil || parsed.Address != input.Email {
			return "Alamat email tidak valid"
		}
	}

	if utf8.RuneCountInString(input.Address) > 500 {
		return "Alamat maksimal 500 karakter"
	}

	if utf8.RuneCountInString(input.Notes) > 1000 {
		return "Catatan maksimal 1000 karakter"
	}

	return ""
}

func (h *Handler) List(c *gin.Context) {
	identity, ok := middleware.CurrentIdentity(c)

	if !ok {
		fail(
			c,
			http.StatusUnauthorized,
			"Login diperlukan",
		)
		return
	}

	page, err := strconv.Atoi(
		c.DefaultQuery("page", "1"),
	)

	if err != nil || page < 1 || page > 100000 {
		fail(c, http.StatusBadRequest, "Halaman tidak valid")
		return
	}

	q := strings.TrimSpace(c.Query("q"))
	status := strings.ToUpper(
		strings.TrimSpace(c.Query("status")),
	)

	if utf8.RuneCountInString(q) > 100 {
		fail(
			c,
			http.StatusBadRequest,
			"Pencarian maksimal 100 karakter",
		)
		return
	}

	if status != "" &&
		status != "ACTIVE" &&
		status != "INACTIVE" {
		fail(
			c,
			http.StatusBadRequest,
			"Filter status tidak valid",
		)
		return
	}

	ctx := c.Request.Context()

	var totalAll int64
	var totalActive int64
	var totalInactive int64

	err = h.db.QueryRow(ctx, `
SELECT
	COUNT(*),
	COUNT(*) FILTER (WHERE is_active = TRUE),
	COUNT(*) FILTER (WHERE is_active = FALSE)
FROM public.vendors
`).Scan(&totalAll, &totalActive, &totalInactive)

	if err != nil {
		handleDBError(c, err)
		return
	}

	const filter = `
WHERE (
	$1::text = ''
	OR v.code ILIKE '%' || $1 || '%'
	OR v.name ILIKE '%' || $1 || '%'
	OR v.contact_person ILIKE '%' || $1 || '%'
	OR v.email ILIKE '%' || $1 || '%'
)
AND (
	$2::text = ''
	OR ($2 = 'ACTIVE' AND v.is_active = TRUE)
	OR ($2 = 'INACTIVE' AND v.is_active = FALSE)
)
`

	var total int64

	err = h.db.QueryRow(
		ctx,
		"SELECT COUNT(*) FROM public.vendors v "+filter,
		q,
		status,
	).Scan(&total)

	if err != nil {
		handleDBError(c, err)
		return
	}

	rows, err := h.db.Query(
		ctx,
		vendorColumns+filter+`
ORDER BY v.created_at DESC, v.id DESC
LIMIT $3 OFFSET $4
`,
		q,
		status,
		10,
		(page-1)*10,
	)

	if err != nil {
		handleDBError(c, err)
		return
	}
	defer rows.Close()

	data := make([]Vendor, 0)

	for rows.Next() {
		vendor, scanErr := scanVendor(rows)

		if scanErr != nil {
			handleDBError(c, scanErr)
			return
		}

		data = append(data, vendor)
	}

	if err := rows.Err(); err != nil {
		handleDBError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": data,
		"pagination": gin.H{
			"page":  page,
			"limit": 10,
			"total": total,
		},
		"summary": gin.H{
			"total":    totalAll,
			"active":   totalActive,
			"inactive": totalInactive,
		},
		"can_manage": identity.RoleCode == "SUPER_ADMIN" ||
			identity.RoleCode == "ASSET_ADMIN",
	})
}

func (h *Handler) Get(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))

	if !vendorUUID.MatchString(id) {
		fail(
			c,
			http.StatusBadRequest,
			"ID Vendor tidak valid",
		)
		return
	}

	vendor, err := scanVendor(
		h.db.QueryRow(
			c.Request.Context(),
			vendorColumns+" WHERE v.id = $1::uuid",
			id,
		),
	)

	if errors.Is(err, pgx.ErrNoRows) {
		fail(
			c,
			http.StatusNotFound,
			"Vendor tidak ditemukan",
		)
		return
	}

	if err != nil {
		handleDBError(c, err)
		return
	}

	c.JSON(http.StatusOK, vendor)
}

func (h *Handler) Create(c *gin.Context) {
	identity, ok := middleware.CurrentIdentity(c)

	if !ok {
		fail(
			c,
			http.StatusUnauthorized,
			"Login diperlukan",
		)
		return
	}

	var input VendorInput

	if err := c.ShouldBindJSON(&input); err != nil {
		fail(
			c,
			http.StatusBadRequest,
			"Format Vendor tidak valid",
		)
		return
	}

	if message := normalize(&input); message != "" {
		fail(c, http.StatusBadRequest, message)
		return
	}

	var id string
	var code string

	err := h.db.QueryRow(
		c.Request.Context(),
		`
INSERT INTO public.vendors (
	name,
	category,
	contact_person,
	phone,
	email,
	address,
	notes,
	created_by
)
VALUES (
	$1,
	$2,
	$3,
	$4,
	$5,
	$6,
	$7,
	$8::uuid
)
RETURNING id::text, code
`,
		input.Name,
		input.Category,
		input.ContactPerson,
		input.Phone,
		input.Email,
		input.Address,
		input.Notes,
		identity.ID,
	).Scan(&id, &code)

	if err != nil {
		handleDBError(c, err)
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":      id,
		"code":    code,
		"message": "Vendor berhasil ditambahkan",
	})
}

func (h *Handler) Update(c *gin.Context) {
	identity, ok := middleware.CurrentIdentity(c)

	if !ok {
		fail(
			c,
			http.StatusUnauthorized,
			"Login diperlukan",
		)
		return
	}

	id := strings.TrimSpace(c.Param("id"))

	if !vendorUUID.MatchString(id) {
		fail(
			c,
			http.StatusBadRequest,
			"ID Vendor tidak valid",
		)
		return
	}

	var input VendorInput

	if err := c.ShouldBindJSON(&input); err != nil {
		fail(
			c,
			http.StatusBadRequest,
			"Format Vendor tidak valid",
		)
		return
	}

	if input.IsActive == nil {
		fail(
			c,
			http.StatusBadRequest,
			"Status Vendor wajib diisi",
		)
		return
	}

	if message := normalize(&input); message != "" {
		fail(c, http.StatusBadRequest, message)
		return
	}

	tag, err := h.db.Exec(
		c.Request.Context(),
		`
UPDATE public.vendors
SET
	name = $2,
	category = $3,
	contact_person = $4,
	phone = $5,
	email = $6,
	address = $7,
	notes = $8,
	is_active = $9,
	updated_by = $10::uuid,
	updated_at = NOW()
WHERE id = $1::uuid
`,
		id,
		input.Name,
		input.Category,
		input.ContactPerson,
		input.Phone,
		input.Email,
		input.Address,
		input.Notes,
		*input.IsActive,
		identity.ID,
	)

	if err != nil {
		handleDBError(c, err)
		return
	}

	if tag.RowsAffected() == 0 {
		fail(
			c,
			http.StatusNotFound,
			"Vendor tidak ditemukan",
		)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Data Vendor berhasil diperbarui",
	})
}
