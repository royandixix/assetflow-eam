package audittrail

import (
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Handler struct {
	db *pgxpool.Pool
}

type AuditEntry struct {
	ID         int64     `json:"id"`
	ActorID    string    `json:"actor_id"`
	ActorName  string    `json:"actor_name"`
	ActorEmail string    `json:"actor_email"`
	ActorRole  string    `json:"actor_role"`
	Action     string    `json:"action"`
	Resource   string    `json:"resource"`
	ResourceID string    `json:"resource_id"`
	Method     string    `json:"method"`
	Route      string    `json:"route"`
	HTTPStatus int       `json:"http_status"`
	IPAddress  string    `json:"ip_address"`
	UserAgent  string    `json:"user_agent"`
	CreatedAt  time.Time `json:"created_at"`
}

func parseDate(value string, exclusiveEnd bool) (any, error) {
	if value == "" {
		return nil, nil
	}

	location := time.FixedZone("WITA", 8*60*60)

	date, err := time.ParseInLocation(
		"2006-01-02", value, location,
	)
	if err != nil {
		return nil, err
	}

	if exclusiveEnd {
		date = date.AddDate(0, 0, 1)
	}

	return date.UTC(), nil
}

func (h *Handler) List(c *gin.Context) {
	page, err := strconv.Atoi(c.DefaultQuery("page", "1"))
	if err != nil || page < 1 || page > 100000 {
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "Halaman tidak valid",
		})
		return
	}

	action := strings.ToUpper(strings.TrimSpace(c.Query("action")))
	resource := strings.ToLower(strings.TrimSpace(c.Query("resource")))
	search := strings.TrimSpace(c.Query("q"))

	if len(action) > 40 ||
		len(resource) > 60 ||
		utf8.RuneCountInString(search) > 100 {
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "Filter tidak valid",
		})
		return
	}

	from, err := parseDate(strings.TrimSpace(c.Query("from")), false)
	if err != nil {
		c.JSON(400, gin.H{"message": "Tanggal awal tidak valid"})
		return
	}

	to, err := parseDate(strings.TrimSpace(c.Query("to")), true)
	if err != nil {
		c.JSON(400, gin.H{"message": "Tanggal akhir tidak valid"})
		return
	}

	if start, ok := from.(time.Time); ok {
		if end, ok := to.(time.Time); ok && !end.After(start) {
			c.JSON(400, gin.H{"message": "Rentang tanggal tidak valid"})
			return
		}
	}

	const filter = `
FROM public.assetflow_audit_logs
WHERE ($1::text = '' OR action = $1)
  AND ($2::text = '' OR resource = $2)
  AND (
    $3::text = ''
    OR actor_name ILIKE '%' || $3 || '%'
    OR actor_email ILIKE '%' || $3 || '%'
    OR resource_id ILIKE '%' || $3 || '%'
    OR route ILIKE '%' || $3 || '%'
  )
  AND ($4::timestamptz IS NULL OR created_at >= $4)
  AND ($5::timestamptz IS NULL OR created_at < $5)
`

	args := []any{action, resource, search, from, to}
	ctx := c.Request.Context()

	var total int64

	err = h.db.QueryRow(
		ctx,
		"SELECT COUNT(*) "+filter,
		args...,
	).Scan(&total)

	if err != nil {
		log.Printf("[audit-trail] count: %v", err)
		c.JSON(500, gin.H{"message": "Gagal memuat jumlah aktivitas"})
		return
	}

	rows, err := h.db.Query(
		ctx,
		`
SELECT
    id,
    actor_id::text,
    actor_name,
    actor_email,
    actor_role,
    action,
    resource,
    resource_id,
    method,
    route,
    http_status,
    ip_address,
    user_agent,
    created_at
`+filter+`
ORDER BY created_at DESC, id DESC
LIMIT $6 OFFSET $7`,
		append(args, 20, (page-1)*20)...,
	)

	if err != nil {
		log.Printf("[audit-trail] list: %v", err)
		c.JSON(500, gin.H{"message": "Gagal memuat Audit Trail"})
		return
	}
	defer rows.Close()

	entries := make([]AuditEntry, 0)

	for rows.Next() {
		var entry AuditEntry

		if err := rows.Scan(
			&entry.ID,
			&entry.ActorID,
			&entry.ActorName,
			&entry.ActorEmail,
			&entry.ActorRole,
			&entry.Action,
			&entry.Resource,
			&entry.ResourceID,
			&entry.Method,
			&entry.Route,
			&entry.HTTPStatus,
			&entry.IPAddress,
			&entry.UserAgent,
			&entry.CreatedAt,
		); err != nil {
			log.Printf("[audit-trail] scan: %v", err)
			c.JSON(500, gin.H{"message": "Gagal membaca aktivitas"})
			return
		}

		entries = append(entries, entry)
	}

	if err := rows.Err(); err != nil {
		log.Printf("[audit-trail] rows: %v", err)
		c.JSON(500, gin.H{"message": "Gagal membaca riwayat"})
		return
	}

	c.Header("Cache-Control", "no-store")
	c.JSON(http.StatusOK, gin.H{
		"data": entries,
		"pagination": gin.H{
			"page":  page,
			"limit": 20,
			"total": total,
		},
	})
}
