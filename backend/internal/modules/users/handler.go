package users

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"net/mail"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/royandixix/assetflow-eam/backend/internal/middleware"
)

type Handler struct {
	db *pgxpool.Pool
}

type User struct {
	ID        string    `json:"id"`
	FullName  string    `json:"full_name"`
	Email     string    `json:"email"`
	RoleCode  string    `json:"role_code"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
}

type inviteInput struct {
	FullName string `json:"full_name"`
	Email    string `json:"email"`
	RoleCode string `json:"role_code"`
}

type updateInput struct {
	FullName string `json:"full_name"`
	RoleCode string `json:"role_code"`
	IsActive *bool  `json:"is_active"`
}

var userIDPattern = regexp.MustCompile(
	`^[a-fA-F0-9]{8}-(?:[a-fA-F0-9]{4}-){3}[a-fA-F0-9]{12}$`,
)

func allowedOperationalRole(role string) bool {
	switch role {
	case "ASSET_ADMIN", "MANAGER", "TECHNICIAN", "STAFF":
		return true
	default:
		return false
	}
}

func respond(c *gin.Context, status int, message string) {
	c.JSON(status, gin.H{"message": message})
}

func databaseError(c *gin.Context, err error) {
	log.Printf("[users] database: %v", err)

	respond(
		c,
		http.StatusInternalServerError,
		"Gagal mengakses data pengguna",
	)
}

func validName(value string) bool {
	length := utf8.RuneCountInString(value)
	return length >= 3 && length <= 120
}

func validEmail(value string) bool {
	if len(value) > 254 ||
		len(value) < 5 ||
		strings.ContainsAny(value, " \t\r\n") {
		return false
	}

	address, err := mail.ParseAddress(value)

	return err == nil &&
		strings.EqualFold(address.Address, value)
}

func adminConfig() (string, string, string, error) {
	projectURL := strings.TrimRight(
		strings.TrimSpace(os.Getenv("SUPABASE_URL")),
		"/",
	)

	secret := strings.TrimSpace(
		os.Getenv("SUPABASE_SECRET_KEY"),
	)

	if secret == "" {
		secret = strings.TrimSpace(
			os.Getenv("SUPABASE_SERVICE_ROLE_KEY"),
		)
	}

	frontendURL := strings.TrimRight(
		strings.TrimSpace(os.Getenv("ASSETFLOW_FRONTEND_URL")),
		"/",
	)

	if projectURL == "" ||
		secret == "" ||
		frontendURL == "" {
		return "", "", "", errors.New(
			"konfigurasi undangan belum lengkap",
		)
	}

	for _, raw := range []string{projectURL, frontendURL} {
		parsed, err := url.Parse(raw)

		if err != nil ||
			parsed.Host == "" ||
			parsed.User != nil ||
			parsed.RawQuery != "" ||
			parsed.Fragment != "" ||
			(parsed.Scheme != "https" &&
				!(parsed.Scheme == "http" &&
					(parsed.Hostname() == "localhost" ||
						parsed.Hostname() == "127.0.0.1"))) {
			return "", "", "", errors.New(
				"URL undangan tidak aman",
			)
		}
	}

	return projectURL, secret, frontendURL, nil
}

func adminRequest(
	ctx context.Context,
	method string,
	endpoint string,
	key string,
	payload any,
) (*http.Response, error) {
	raw, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(
		ctx,
		method,
		endpoint,
		bytes.NewReader(raw),
	)
	if err != nil {
		return nil, err
	}

	req.Header.Set("apikey", key)
	req.Header.Set("Authorization", "Bearer "+key)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	client := &http.Client{
		Timeout: 15 * time.Second,
	}

	return client.Do(req)
}

func (h *Handler) List(c *gin.Context) {
	page, err := strconv.Atoi(
		c.DefaultQuery("page", "1"),
	)

	if err != nil || page < 1 || page > 100000 {
		respond(c, 400, "Halaman tidak valid")
		return
	}

	q := strings.TrimSpace(c.Query("q"))
	role := strings.ToUpper(
		strings.TrimSpace(c.Query("role")),
	)
	state := strings.ToLower(
		strings.TrimSpace(c.Query("state")),
	)

	if utf8.RuneCountInString(q) > 100 ||
		(role != "" &&
			role != "SUPER_ADMIN" &&
			!allowedOperationalRole(role)) ||
		(state != "" &&
			state != "active" &&
			state != "inactive") {
		respond(c, 400, "Filter pengguna tidak valid")
		return
	}

	values := []any{q, role, state}

	const fromWhere = `
FROM public.profiles p
JOIN auth.users au ON au.id = p.id
WHERE (
    $1::text = ''
    OR p.full_name ILIKE '%' || $1 || '%'
    OR COALESCE(au.email, '') ILIKE '%' || $1 || '%'
)
AND ($2::text = '' OR p.role_code = $2)
AND (
    $3::text = ''
    OR ($3 = 'active' AND p.is_active)
    OR ($3 = 'inactive' AND NOT p.is_active)
)
`

	var total int64

	err = h.db.QueryRow(
		c.Request.Context(),
		"SELECT COUNT(*) "+fromWhere,
		values...,
	).Scan(&total)

	if err != nil {
		databaseError(c, err)
		return
	}

	rows, err := h.db.Query(
		c.Request.Context(),
		`
SELECT
    p.id::text,
    COALESCE(p.full_name, ''),
    COALESCE(au.email, ''),
    p.role_code,
    p.is_active,
    au.created_at
`+fromWhere+`
ORDER BY au.created_at DESC, p.id DESC
LIMIT $4 OFFSET $5`,
		append(values, 10, (page-1)*10)...,
	)

	if err != nil {
		databaseError(c, err)
		return
	}
	defer rows.Close()

	users := make([]User, 0)

	for rows.Next() {
		var user User

		if err := rows.Scan(
			&user.ID,
			&user.FullName,
			&user.Email,
			&user.RoleCode,
			&user.IsActive,
			&user.CreatedAt,
		); err != nil {
			databaseError(c, err)
			return
		}

		users = append(users, user)
	}

	if err := rows.Err(); err != nil {
		databaseError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": users,
		"pagination": gin.H{
			"page":  page,
			"limit": 10,
			"total": total,
		},
	})
}

func (h *Handler) Invite(c *gin.Context) {
	var input inviteInput

	if err := c.ShouldBindJSON(&input); err != nil {
		respond(c, 400, "Format undangan tidak valid")
		return
	}

	input.FullName = strings.TrimSpace(input.FullName)
	input.Email = strings.ToLower(
		strings.TrimSpace(input.Email),
	)
	input.RoleCode = strings.ToUpper(
		strings.TrimSpace(input.RoleCode),
	)

	if !validName(input.FullName) ||
		!validEmail(input.Email) ||
		!allowedOperationalRole(input.RoleCode) {
		respond(
			c,
			400,
			"Nama, email, atau role tidak valid",
		)
		return
	}

	projectURL, secret, frontendURL, err := adminConfig()

	if err != nil {
		log.Printf("[users] konfigurasi: %v", err)

		respond(
			c,
			503,
			"Konfigurasi Supabase Auth belum lengkap",
		)
		return
	}

	var exists bool

	err = h.db.QueryRow(
		c.Request.Context(),
		`
SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE LOWER(email) = $1
)`,
		input.Email,
	).Scan(&exists)

	if err != nil {
		databaseError(c, err)
		return
	}

	if exists {
		respond(
			c,
			409,
			"Email sudah terdaftar di Supabase Auth",
		)
		return
	}

	redirect := frontendURL + "/auth/confirm"

	endpoint := projectURL +
		"/auth/v1/invite?redirect_to=" +
		url.QueryEscape(redirect)

	response, err := adminRequest(
		c.Request.Context(),
		http.MethodPost,
		endpoint,
		secret,
		map[string]any{
			"email": input.Email,
			"data": map[string]string{
				"full_name": input.FullName,
			},
		},
	)

	if err != nil {
		log.Printf("[users] undangan: %v", err)

		respond(
			c,
			502,
			"Tidak dapat menghubungi Supabase Auth",
		)
		return
	}
	defer response.Body.Close()

	if response.StatusCode < 200 ||
		response.StatusCode >= 300 {
		switch response.StatusCode {
		case 429:
			respond(
				c,
				429,
				"Batas pengiriman email tercapai. Coba nanti.",
			)
		case 400, 409, 422:
			respond(
				c,
				409,
				"Undangan ditolak. Periksa email, SMTP, dan status akun.",
			)
		default:
			log.Printf(
				"[users] Auth invite HTTP %d",
				response.StatusCode,
			)
			respond(
				c,
				502,
				"Supabase Auth gagal mengirim undangan",
			)
		}
		return
	}

	var invited struct {
		ID string `json:"id"`
	}

	err = json.NewDecoder(
		io.LimitReader(response.Body, 1<<20),
	).Decode(&invited)

	if err != nil || !userIDPattern.MatchString(invited.ID) {
		respond(
			c,
			502,
			"Undangan diproses tetapi identitas akun belum dapat dipastikan. Periksa Supabase Auth sebelum mengulangi.",
		)
		return
	}

	_, err = h.db.Exec(
		c.Request.Context(),
		`
INSERT INTO public.profiles (
    id,
    full_name,
    role_code,
    is_active
)
VALUES ($1::uuid, $2, $3, TRUE)
ON CONFLICT (id) DO UPDATE
SET
    full_name = EXCLUDED.full_name,
    role_code = EXCLUDED.role_code,
    is_active = TRUE
WHERE public.profiles.role_code <> 'SUPER_ADMIN'`,
		invited.ID,
		input.FullName,
		input.RoleCode,
	)

	if err != nil {
		log.Printf(
			"[users] undangan berhasil namun profil gagal untuk %s: %v",
			invited.ID,
			err,
		)

		respond(
			c,
			503,
			"Undangan sudah dibuat tetapi profil gagal disinkronkan. Jangan undang ulang; periksa akun di Supabase.",
		)
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":      invited.ID,
		"message": "Undangan terkirim. Pengguna dapat menyelesaikan aktivasi melalui email.",
	})
}

func (h *Handler) Update(c *gin.Context) {
	actor, ok := middleware.CurrentIdentity(c)

	if !ok {
		respond(c, 401, "Login diperlukan")
		return
	}

	id := c.Param("id")

	if !userIDPattern.MatchString(id) {
		respond(c, 400, "ID pengguna tidak valid")
		return
	}

	if strings.EqualFold(id, actor.ID) {
		respond(
			c,
			403,
			"Akun sendiri tidak dapat diubah melalui modul ini",
		)
		return
	}

	var input updateInput

	if err := c.ShouldBindJSON(&input); err != nil {
		respond(c, 400, "Format perubahan tidak valid")
		return
	}

	input.FullName = strings.TrimSpace(input.FullName)
	input.RoleCode = strings.ToUpper(
		strings.TrimSpace(input.RoleCode),
	)

	if input.IsActive == nil ||
		!validName(input.FullName) ||
		!allowedOperationalRole(input.RoleCode) {
		respond(c, 400, "Nama, role, atau status tidak valid")
		return
	}

	ctx := c.Request.Context()

	tx, err := h.db.Begin(ctx)

	if err != nil {
		databaseError(c, err)
		return
	}
	defer tx.Rollback(ctx)

	var oldRole string
	var wasActive bool

	err = tx.QueryRow(
		ctx,
		`
SELECT role_code, is_active
FROM public.profiles
WHERE id = $1::uuid
FOR UPDATE`,
		id,
	).Scan(&oldRole, &wasActive)

	if errors.Is(err, pgx.ErrNoRows) {
		respond(c, 404, "Pengguna tidak ditemukan")
		return
	}

	if err != nil {
		databaseError(c, err)
		return
	}

	if oldRole == "SUPER_ADMIN" {
		respond(c, 403, "Akun SUPER_ADMIN dilindungi")
		return
	}

	if wasActive != *input.IsActive {
		projectURL, secret, _, configErr := adminConfig()

		if configErr != nil {
			respond(
				c,
				503,
				"Konfigurasi Supabase Auth belum lengkap",
			)
			return
		}

		banDuration := "none"

		if !*input.IsActive {
			banDuration = "876000h"
		}

		endpoint := projectURL +
			"/auth/v1/admin/users/" +
			url.PathEscape(id)

		response, requestErr := adminRequest(
			ctx,
			http.MethodPut,
			endpoint,
			secret,
			map[string]string{
				"ban_duration": banDuration,
			},
		)

		if requestErr != nil {
			log.Printf(
				"[users] update Auth: %v",
				requestErr,
			)
			respond(
				c,
				502,
				"Gagal memperbarui akses Supabase Auth",
			)
			return
		}

		_, _ = io.Copy(
			io.Discard,
			io.LimitReader(response.Body, 1<<20),
		)
		response.Body.Close()

		if response.StatusCode < 200 ||
			response.StatusCode >= 300 {
			log.Printf(
				"[users] update Auth HTTP %d",
				response.StatusCode,
			)

			respond(
				c,
				502,
				"Supabase Auth menolak perubahan status",
			)
			return
		}
	}

	_, err = tx.Exec(
		ctx,
		`
UPDATE public.profiles
SET
    full_name = $2,
    role_code = $3,
    is_active = $4
WHERE id = $1::uuid
  AND role_code <> 'SUPER_ADMIN'`,
		id,
		input.FullName,
		input.RoleCode,
		*input.IsActive,
	)

	if err != nil {
		databaseError(c, err)
		return
	}

	if err := tx.Commit(ctx); err != nil {
		databaseError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Pengguna berhasil diperbarui",
	})
}
