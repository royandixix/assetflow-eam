
package workorders

import (
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/royandixix/assetflow-eam/backend/internal/middleware"
)

func RegisterRoutes(
	protected *gin.RouterGroup,
	db *pgxpool.Pool,
) {
	h := &Handler{db: db}

	group := protected.Group("/work-orders")

	group.Use(middleware.RequireRoles(
		"SUPER_ADMIN",
		"ASSET_ADMIN",
		"MANAGER",
		"TECHNICIAN",
		"STAFF",
	))

	group.GET("", h.List)
	group.GET("/options", h.Options)

	group.POST(
		"",
		middleware.RequireRoles(
			"SUPER_ADMIN",
			"ASSET_ADMIN",
		),
		h.Create,
	)

	group.POST(
		"/:id/start",
		middleware.RequireRoles(
			"SUPER_ADMIN",
			"TECHNICIAN",
		),
		h.Start,
	)

	group.POST(
		"/:id/complete",
		middleware.RequireRoles(
			"SUPER_ADMIN",
			"TECHNICIAN",
		),
		h.Complete,
	)

	group.POST(
		"/:id/close",
		middleware.RequireRoles(
			"SUPER_ADMIN",
			"ASSET_ADMIN",
			"MANAGER",
		),
		h.Close,
	)
}
