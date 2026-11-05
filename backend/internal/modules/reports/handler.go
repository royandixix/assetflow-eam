package reports

import (
	"encoding/csv"
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Handler struct {
	db *pgxpool.Pool
}

type SummaryData struct {
	AssetsTotal       int64 `json:"assets_total"`
	AssetsAvailable   int64 `json:"assets_available"`
	AssetsAssigned    int64 `json:"assets_assigned"`
	AssetsMaintenance int64 `json:"assets_maintenance"`

	MaintenanceTotal   int64 `json:"maintenance_total"`
	MaintenancePending int64 `json:"maintenance_pending"`
	MaintenanceActive  int64 `json:"maintenance_active"`

	WorkOrdersTotal      int64 `json:"work_orders_total"`
	WorkOrdersAssigned   int64 `json:"work_orders_assigned"`
	WorkOrdersInProgress int64 `json:"work_orders_in_progress"`
	WorkOrdersCompleted  int64 `json:"work_orders_completed"`
	WorkOrdersClosed     int64 `json:"work_orders_closed"`

	VendorsTotal  int64 `json:"vendors_total"`
	VendorsActive int64 `json:"vendors_active"`
}

type RecentWorkOrder struct {
	Number         string    `json:"number"`
	AssetCode      string    `json:"asset_code"`
	AssetName      string    `json:"asset_name"`
	Title          string    `json:"title"`
	Status         string    `json:"status"`
	TechnicianName string    `json:"technician_name"`
	CreatedAt      time.Time `json:"created_at"`
}

func reportError(c *gin.Context, err error) {
	var pgErr *pgconn.PgError

	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "42P01", "42703":
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"message": "Struktur database laporan belum sesuai",
			})
			return

		case "42501":
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"message": "Koneksi database tidak memiliki izin membaca laporan",
			})
			return
		}
	}

	log.Printf("[reports] %v", err)

	c.JSON(http.StatusInternalServerError, gin.H{
		"message": "Gagal memuat laporan",
	})
}

func (h *Handler) Summary(c *gin.Context) {
	ctx := c.Request.Context()

	var s SummaryData

	err := h.db.QueryRow(ctx, `
SELECT
	(SELECT COUNT(*) FROM public.assets),
	(SELECT COUNT(*) FROM public.assets WHERE status = 'AVAILABLE'),
	(SELECT COUNT(*) FROM public.assets WHERE status = 'ASSIGNED'),
	(SELECT COUNT(*) FROM public.assets WHERE status = 'MAINTENANCE'),

	(SELECT COUNT(*) FROM public.maintenance_requests),
	(SELECT COUNT(*) FROM public.maintenance_requests WHERE status = 'PENDING'),
	(SELECT COUNT(*) FROM public.maintenance_requests
	 WHERE status IN ('APPROVED', 'IN_PROGRESS')),

	(SELECT COUNT(*) FROM public.work_orders),
	(SELECT COUNT(*) FROM public.work_orders WHERE status = 'ASSIGNED'),
	(SELECT COUNT(*) FROM public.work_orders WHERE status = 'IN_PROGRESS'),
	(SELECT COUNT(*) FROM public.work_orders WHERE status = 'COMPLETED'),
	(SELECT COUNT(*) FROM public.work_orders WHERE status = 'CLOSED'),

	(SELECT COUNT(*) FROM public.vendors),
	(SELECT COUNT(*) FROM public.vendors WHERE is_active = TRUE)
`).Scan(
		&s.AssetsTotal,
		&s.AssetsAvailable,
		&s.AssetsAssigned,
		&s.AssetsMaintenance,
		&s.MaintenanceTotal,
		&s.MaintenancePending,
		&s.MaintenanceActive,
		&s.WorkOrdersTotal,
		&s.WorkOrdersAssigned,
		&s.WorkOrdersInProgress,
		&s.WorkOrdersCompleted,
		&s.WorkOrdersClosed,
		&s.VendorsTotal,
		&s.VendorsActive,
	)

	if err != nil {
		reportError(c, err)
		return
	}

	rows, err := h.db.Query(ctx, `
SELECT
	w.number,
	a.asset_code,
	a.name,
	w.title,
	w.status,
	COALESCE(t.full_name, ''),
	w.created_at
FROM public.work_orders w
JOIN public.assets a
	ON a.id = w.asset_id
LEFT JOIN public.profiles t
	ON t.id = w.technician_id
ORDER BY w.created_at DESC, w.id DESC
LIMIT 15
`)

	if err != nil {
		reportError(c, err)
		return
	}
	defer rows.Close()

	recent := make([]RecentWorkOrder, 0)

	for rows.Next() {
		var item RecentWorkOrder

		err := rows.Scan(
			&item.Number,
			&item.AssetCode,
			&item.AssetName,
			&item.Title,
			&item.Status,
			&item.TechnicianName,
			&item.CreatedAt,
		)

		if err != nil {
			reportError(c, err)
			return
		}

		recent = append(recent, item)
	}

	if err := rows.Err(); err != nil {
		reportError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"summary":      s,
		"work_orders":  recent,
		"generated_at": time.Now().UTC(),
	})
}

func safeCSV(value string) string {
	trimmed := strings.TrimLeft(value, " \t\r\n")

	if trimmed != "" {
		switch trimmed[0] {
		case '=', '+', '-', '@':
			return "'" + value
		}
	}

	return value
}

func (h *Handler) ExportWorkOrders(c *gin.Context) {
	rows, err := h.db.Query(c.Request.Context(), `
SELECT
	w.number,
	a.asset_code,
	a.name,
	w.title,
	w.status,
	COALESCE(t.full_name, ''),
	TO_CHAR(w.start_date, 'YYYY-MM-DD'),
	TO_CHAR(w.due_date, 'YYYY-MM-DD'),
	TO_CHAR(w.created_at, 'YYYY-MM-DD HH24:MI')
FROM public.work_orders w
JOIN public.assets a
	ON a.id = w.asset_id
LEFT JOIN public.profiles t
	ON t.id = w.technician_id
ORDER BY w.created_at DESC, w.id DESC
LIMIT 10000
`)

	if err != nil {
		reportError(c, err)
		return
	}
	defer rows.Close()

	records := [][]string{
		{
			"Nomor WO",
			"Kode Aset",
			"Nama Aset",
			"Judul Pekerjaan",
			"Status",
			"Teknisi",
			"Tanggal Mulai",
			"Target Selesai",
			"Dibuat",
		},
	}

	for rows.Next() {
		record := make([]string, 9)

		dest := make([]any, len(record))

		for i := range record {
			dest[i] = &record[i]
		}

		if err := rows.Scan(dest...); err != nil {
			reportError(c, err)
			return
		}

		for i := range record {
			record[i] = safeCSV(record[i])
		}

		records = append(records, record)
	}

	if err := rows.Err(); err != nil {
		reportError(c, err)
		return
	}

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header(
		"Content-Disposition",
		`attachment; filename="assetflow-work-orders.csv"`,
	)
	c.Header("Cache-Control", "no-store")

	c.Status(http.StatusOK)

	writer := csv.NewWriter(c.Writer)

	if err := writer.WriteAll(records); err != nil {
		log.Printf("[reports] CSV response: %v", err)
	}
}
