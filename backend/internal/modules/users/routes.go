package users

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

	group := protected.Group("/users")
	group.Use(middleware.RequireRoles("SUPER_ADMIN"))

	group.GET("", h.List)
	group.POST("/invite", h.Invite)
	group.PUT("/:id", h.Update)
}
