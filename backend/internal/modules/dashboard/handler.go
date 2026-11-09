package dashboard

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/royandixix/assetflow-eam/backend/internal/middleware"
)

type Handler struct {
	db *pgxpool.Pool
}

type Metric struct {
	Key       string `json:"key"`
	Label     string `json:"label"`
	Path      string `json:"path"`
	Value     *int64 `json:"value"`
	Available bool   `json:"available"`
}

type DailyActivity struct {
	Date  string `json:"date"`
	Count int64  `json:"count"`
}

type RecentActivity struct {
	ID         int64     `json:"id"`
	ActorName  string    `json:"actor_name"`
	Action     string    `json:"action"`
	Resource   string    `json:"resource"`
	ResourceID string    `json:"resource_id"`
	CreatedAt  time.Time `json:"created_at"`
}

type Response struct {
	PeriodDays    int              `json:"period_days"`
	Timezone      string           `json:"timezone"`
	Metrics       []Metric         `json:"metrics"`
	Series        []DailyActivity  `json:"series"`
	Recent        []RecentActivity `json:"recent"`
	AuditEnabled  bool             `json:"audit_enabled"`
	LastUpdatedAt time.Time        `json:"last_updated_at"`
}

type metricSpec struct {
	Key        string
	Label      string
	Path       string
	Candidates []string
}

var metricSpecs = []metricSpec{
	{
		Key:        "assets",
		Label:      "Total Aset",
		Path:       "/dashboard/assets",
		Candidates: []string{"assets"},
	},
	{
		Key:        "assignments",
		Label:      "Penugasan Aset",
		Path:       "/dashboard/assignments",
		Candidates: []string{"asset_assignments"},
	},
	{
		Key:        "transfers",
		Label:      "Mutasi Aset",
		Path:       "/dashboard/transfers",
		Candidates: []string{"asset_transfers"},
	},
	{
		Key:        "maintenance",
		Label:      "Permintaan Maintenance",
		Path:       "/dashboard/maintenance",
		Candidates: []string{"maintenance_requests"},
	},
	{
		Key:        "work_orders",
		Label:      "Work Orders",
		Path:       "/dashboard/work-orders",
		Candidates: []string{"work_orders"},
	},
	{
		Key:        "vendors",
		Label:      "Total Vendor",
		Path:       "/dashboard/vendors",
		Candidates: []string{"vendors"},
	},
}

var operationalResources = []string{
	"assets",
	"asset-categories",
	"asset-assignments",
	"asset-transfers",
	"maintenance-requests",
	"work-orders",
	"vendors",
	"locations",
	"departments",
}

func tableExists(
	ctx context.Context,
	db *pgxpool.Pool,
	name string,
) (bool, error) {
	var exists bool

	err := db.QueryRow(
		ctx,
		`SELECT EXISTS (
			SELECT 1
			FROM pg_catalog.pg_class c
			JOIN pg_catalog.pg_namespace n
				ON n.oid = c.relnamespace
			WHERE n.nspname = 'public'
			  AND c.relname = $1
			  AND c.relkind IN ('r', 'p')
		)`,
		name,
	).Scan(&exists)

	return exists, err
}

func loadMetrics(
	ctx context.Context,
	db *pgxpool.Pool,
) ([]Metric, error) {
	metrics := make([]Metric, 0, len(metricSpecs))

	for _, spec := range metricSpecs {
		metric := Metric{
			Key:       spec.Key,
			Label:     spec.Label,
			Path:      spec.Path,
			Value:     nil,
			Available: false,
		}

		for _, tableName := range spec.Candidates {
			exists, err := tableExists(ctx, db, tableName)

			if err != nil {
				return nil, err
			}

			if !exists {
				continue
			}

			query := "SELECT COUNT(*) FROM " +
				pgx.Identifier{
					"public",
					tableName,
				}.Sanitize()

			var count int64

			if err := db.QueryRow(
				ctx,
				query,
			).Scan(&count); err != nil {
				return nil, err
			}

			metric.Value = &count
			metric.Available = true
			break
		}

		metrics = append(metrics, metric)
	}

	return metrics, nil
}

func loadTimezone(
	ctx context.Context,
	db *pgxpool.Pool,
) string {
	const fallback = "Asia/Makassar"

	exists, err := tableExists(
		ctx,
		db,
		"assetflow_app_settings",
	)

	if err != nil || !exists {
		return fallback
	}

	var timezone string

	err = db.QueryRow(
		ctx,
		`SELECT timezone
		 FROM public.assetflow_app_settings
		 WHERE id = 1`,
	).Scan(&timezone)

	if err != nil {
		return fallback
	}

	switch timezone {
	case "Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura":
		return timezone
	default:
		return fallback
	}
}

func loadActivitySeries(
	ctx context.Context,
	db *pgxpool.Pool,
	days int,
	timezone string,
) ([]DailyActivity, error) {
	location, err := time.LoadLocation(timezone)

	if err != nil {
		return nil, err
	}

	now := time.Now().In(location)

	today := time.Date(
		now.Year(),
		now.Month(),
		now.Day(),
		0, 0, 0, 0,
		location,
	)

	start := today.AddDate(0, 0, -(days - 1))
	end := today.AddDate(0, 0, 1)

	counts := make(map[string]int64, days)

	rows, err := db.Query(
		ctx,
		`SELECT
			to_char(
				created_at AT TIME ZONE $1,
				'YYYY-MM-DD'
			) AS activity_date,
			COUNT(*)::BIGINT
		 FROM public.assetflow_audit_logs
		 WHERE created_at >= $2
		   AND created_at < $3
		   AND resource = ANY($4::text[])
		 GROUP BY 1
		 ORDER BY 1`,
		timezone,
		start,
		end,
		operationalResources,
	)

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var date string
		var count int64

		if err := rows.Scan(&date, &count); err != nil {
			return nil, err
		}

		counts[date] = count
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	result := make([]DailyActivity, 0, days)

	for i := 0; i < days; i++ {
		date := start.AddDate(0, 0, i).
			Format("2006-01-02")

		result = append(result, DailyActivity{
			Date:  date,
			Count: counts[date],
		})
	}

	return result, nil
}

func loadRecentActivities(
	ctx context.Context,
	db *pgxpool.Pool,
) ([]RecentActivity, error) {
	result := make([]RecentActivity, 0, 8)

	rows, err := db.Query(
		ctx,
		`SELECT
			id,
			COALESCE(actor_name, ''),
			action,
			resource,
			COALESCE(resource_id, ''),
			created_at
		 FROM public.assetflow_audit_logs
		 WHERE resource = ANY($1::text[])
		 ORDER BY created_at DESC, id DESC
		 LIMIT 8`,
		operationalResources,
	)

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var item RecentActivity

		if err := rows.Scan(
			&item.ID,
			&item.ActorName,
			&item.Action,
			&item.Resource,
			&item.ResourceID,
			&item.CreatedAt,
		); err != nil {
			return nil, err
		}

		result = append(result, item)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return result, nil
}

func (h *Handler) Overview(c *gin.Context) {
	identity, ok := middleware.CurrentIdentity(c)

	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"message": "Identitas pengguna tidak tersedia",
		})
		return
	}

	days := 30

	switch c.Query("days") {
	case "", "30":
		days = 30
	case "7":
		days = 7
	case "90":
		days = 90
	default:
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "Periode tidak valid",
		})
		return
	}

	ctx, cancel := context.WithTimeout(
		c.Request.Context(),
		15*time.Second,
	)
	defer cancel()

	metrics, err := loadMetrics(ctx, h.db)

	if err != nil {
		log.Printf("[dashboard] gagal memuat statistik: %v", err)

		c.JSON(http.StatusInternalServerError, gin.H{
			"message": "Gagal memuat statistik Dashboard",
		})
		return
	}

	timezone := loadTimezone(ctx, h.db)

	auditEnabled, err := tableExists(
		ctx,
		h.db,
		"assetflow_audit_logs",
	)

	if err != nil {
		log.Printf("[dashboard] gagal memeriksa audit: %v", err)

		c.JSON(http.StatusInternalServerError, gin.H{
			"message": "Gagal memeriksa data aktivitas",
		})
		return
	}

	series := make([]DailyActivity, 0, days)
	recent := make([]RecentActivity, 0)

	if auditEnabled {
		series, err = loadActivitySeries(
			ctx,
			h.db,
			days,
			timezone,
		)

		if err != nil {
			log.Printf("[dashboard] gagal membaca grafik: %v", err)

			c.JSON(http.StatusInternalServerError, gin.H{
				"message": "Gagal memuat grafik aktivitas",
			})
			return
		}

		if identity.RoleCode == "SUPER_ADMIN" {
			recent, err = loadRecentActivities(ctx, h.db)

			if err != nil {
				log.Printf(
					"[dashboard] gagal membaca aktivitas terbaru: %v",
					err,
				)

				c.JSON(http.StatusInternalServerError, gin.H{
					"message": "Gagal memuat aktivitas terbaru",
				})
				return
			}
		}
	}

	c.JSON(http.StatusOK, Response{
		PeriodDays:    days,
		Timezone:      timezone,
		Metrics:       metrics,
		Series:        series,
		Recent:        recent,
		AuditEnabled:  auditEnabled,
		LastUpdatedAt: time.Now().UTC(),
	})
}
