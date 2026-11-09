package dashboard

import (
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func RegisterRoutes(
	protected *gin.RouterGroup,
	db *pgxpool.Pool,
) {
	h := &Handler{db: db}

	protected.GET(
		"/dashboard/overview",
		h.Overview,
	)
}
