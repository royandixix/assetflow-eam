package audittrail

import (
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/royandixix/assetflow-eam/backend/internal/middleware"
)

func RegisterRoutes(
	protected *gin.RouterGroup,
	db *pgxpool.Pool,
) {
	handler := &Handler{db: db}

	group := protected.Group("/audit-trail")
	group.Use(middleware.RequireRoles("SUPER_ADMIN"))
	group.GET("", handler.List)
}
