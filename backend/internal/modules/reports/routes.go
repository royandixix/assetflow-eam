package reports

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

	group := protected.Group("/reports")

	group.Use(middleware.RequireRoles(
		"SUPER_ADMIN",
		"ASSET_ADMIN",
		"MANAGER",
	))

	group.GET("/summary", h.Summary)
	group.GET("/work-orders.csv", h.ExportWorkOrders)
}
