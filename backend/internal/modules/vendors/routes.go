package vendors

import (
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/royandixix/assetflow-eam/backend/internal/middleware"
)

func RegisterRoutes(protected *gin.RouterGroup, db *pgxpool.Pool) {
	h := &Handler{db: db}

	group := protected.Group("/vendors")
	group.Use(middleware.RequireRoles(
		"SUPER_ADMIN",
		"ASSET_ADMIN",
		"MANAGER",
	))

	group.GET("", h.List)
	group.GET("/:id", h.Get)

	group.POST(
		"",
		middleware.RequireRoles("SUPER_ADMIN", "ASSET_ADMIN"),
		h.Create,
	)

	group.PUT(
		"/:id",
		middleware.RequireRoles("SUPER_ADMIN", "ASSET_ADMIN"),
		h.Update,
	)
}
