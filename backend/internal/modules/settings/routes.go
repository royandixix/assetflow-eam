package settings

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
	preferences := &PreferencesHandler{db: db}

	settingsGroup := protected.Group("/settings")

	settingsGroup.Use(
		middleware.RequireRoles("SUPER_ADMIN"),
	)

	settingsGroup.GET("", h.Get)
	settingsGroup.PUT("", h.Update)

	preferencesGroup := protected.Group("/user-preferences")

	preferencesGroup.GET("", preferences.Get)
	preferencesGroup.PUT("", preferences.Update)
}
