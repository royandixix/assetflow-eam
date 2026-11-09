package router

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/royandixix/assetflow-eam/backend/internal/auth"
	"github.com/royandixix/assetflow-eam/backend/internal/middleware"
	"github.com/royandixix/assetflow-eam/backend/internal/modules/assets"
	"github.com/royandixix/assetflow-eam/backend/internal/modules/assignments"
	"github.com/royandixix/assetflow-eam/backend/internal/modules/audittrail"
	"github.com/royandixix/assetflow-eam/backend/internal/modules/categories"
	"github.com/royandixix/assetflow-eam/backend/internal/modules/dashboard"
	"github.com/royandixix/assetflow-eam/backend/internal/modules/departments"
	"github.com/royandixix/assetflow-eam/backend/internal/modules/locations"
	"github.com/royandixix/assetflow-eam/backend/internal/modules/maintenance"
	"github.com/royandixix/assetflow-eam/backend/internal/modules/reports"
	"github.com/royandixix/assetflow-eam/backend/internal/modules/settings"
	"github.com/royandixix/assetflow-eam/backend/internal/modules/transfers"
	"github.com/royandixix/assetflow-eam/backend/internal/modules/users"
	"github.com/royandixix/assetflow-eam/backend/internal/modules/vendors"
	"github.com/royandixix/assetflow-eam/backend/internal/modules/workorders"
)

func New(db *pgxpool.Pool, authClient *auth.Client) *gin.Engine {
	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())

	if err := r.SetTrustedProxies(nil); err != nil {
		log.Fatal(err)
	}

	api := r.Group("/api/v1")

	api.GET("/health", func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(
			c.Request.Context(),
			10*time.Second,
		)
		defer cancel()

		if err := db.Ping(ctx); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"status":   "error",
				"database": "disconnected",
			})
			return
		}

		var roles int

		err := db.QueryRow(
			ctx,
			"SELECT COUNT(*) FROM public.roles",
		).Scan(&roles)

		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"status":   "error",
				"database": "query_failed",
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"status":   "ok",
			"app":      "AssetFlow EAM",
			"database": "connected",
			"roles":    roles,
		})
	})

	protected := api.Group("")
	protected.Use(middleware.Authenticate(authClient, db))

	protected.Use(middleware.AuditChanges(db))
	categories.RegisterRoutes(protected, db)
	locations.RegisterRoutes(protected, db)
	departments.RegisterRoutes(protected, db)
	assets.RegisterRoutes(protected, db)
	assignments.RegisterRoutes(protected, db)
	transfers.RegisterRoutes(protected, db)
	maintenance.RegisterRoutes(protected, db)
	workorders.RegisterRoutes(protected, db)
	users.RegisterRoutes(protected, db)
	vendors.RegisterRoutes(protected, db)
	reports.RegisterRoutes(protected, db)
	audittrail.RegisterRoutes(protected, db)
	settings.RegisterRoutes(protected, db)
	dashboard.RegisterRoutes(protected, db)

	protected.GET("/auth/me", func(c *gin.Context) {
		identity, _ := middleware.CurrentIdentity(c)

		c.JSON(http.StatusOK, gin.H{
			"status": "ok",
			"user":   identity,
		})
	})

	access := protected.Group("/access")

	registerRoleCheck(access, "SUPER_ADMIN", "/super-admin")
	registerRoleCheck(access, "ASSET_ADMIN", "/asset-admin")
	registerRoleCheck(access, "MANAGER", "/manager")
	registerRoleCheck(access, "TECHNICIAN", "/technician")
	registerRoleCheck(access, "STAFF", "/staff")

	return r
}

func registerRoleCheck(
	group *gin.RouterGroup,
	role string,
	path string,
) {
	group.GET(
		path,
		middleware.RequireRoles(role),
		func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{
				"status": "allowed",
				"role":   role,
			})
		},
	)
}
