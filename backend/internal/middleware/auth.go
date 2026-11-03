package middleware

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/royandixix/assetflow-eam/backend/internal/auth"
)

const identityKey = "assetflow.identity"

type Identity struct {
	ID       string `json:"id"`
	Email    string `json:"email"`
	FullName string `json:"full_name"`
	RoleCode string `json:"role_code"`
	IsActive bool   `json:"is_active"`
}

func Authenticate(
	client *auth.Client,
	db *pgxpool.Pool,
) gin.HandlerFunc {
	return func(c *gin.Context) {
		parts := strings.Fields(c.GetHeader("Authorization"))

		if len(parts) != 2 ||
			!strings.EqualFold(parts[0], "Bearer") {
			c.AbortWithStatusJSON(
				http.StatusUnauthorized,
				gin.H{"message": "Token autentikasi diperlukan"},
			)
			return
		}

		user, err := client.Verify(
			c.Request.Context(),
			parts[1],
		)

		if err != nil {
			status := http.StatusUnauthorized
			message := "Token tidak valid atau kedaluwarsa"

			if errors.Is(err, auth.ErrUnavailable) {
				status = http.StatusServiceUnavailable
				message = "Layanan autentikasi tidak tersedia"
			}

			c.AbortWithStatusJSON(
				status,
				gin.H{"message": message},
			)
			return
		}

		ctx, cancel := context.WithTimeout(
			c.Request.Context(),
			5*time.Second,
		)
		defer cancel()

		var identity Identity

		err = db.QueryRow(
			ctx,
			`SELECT
				id::text,
				full_name,
				role_code,
				is_active
			FROM public.profiles
			WHERE id = $1::uuid`,
			user.ID,
		).Scan(
			&identity.ID,
			&identity.FullName,
			&identity.RoleCode,
			&identity.IsActive,
		)

		if errors.Is(err, pgx.ErrNoRows) {
			c.AbortWithStatusJSON(
				http.StatusForbidden,
				gin.H{"message": "Profil pengguna belum terdaftar"},
			)
			return
		}

		if err != nil {
			c.AbortWithStatusJSON(
				http.StatusServiceUnavailable,
				gin.H{"message": "Gagal memeriksa profil pengguna"},
			)
			return
		}

		if !identity.IsActive {

			c.AbortWithStatusJSON(
				http.StatusForbidden,
				gin.H{"message": "Akun pengguna tidak aktif"},
			)
			return
		}

		identity.Email = user.Email

		c.Set(identityKey, identity)
		c.Next()
	}
}

func CurrentIdentity(c *gin.Context) (Identity, bool) {
	value, exists := c.Get(identityKey)
	if !exists {
		return Identity{}, false
	}

	identity, ok := value.(Identity)
	return identity, ok
}

func RequireRoles(roles ...string) gin.HandlerFunc {
	allowed := make(map[string]struct{}, len(roles))

	for _, role := range roles {
		allowed[role] = struct{}{}
	}

	return func(c *gin.Context) {
		identity, ok := CurrentIdentity(c)

		if !ok {
			c.AbortWithStatusJSON(
				http.StatusUnauthorized,
				gin.H{"message": "Autentikasi diperlukan"},
			)
			return
		}

		if _, exists := allowed[identity.RoleCode]; !exists {
			c.AbortWithStatusJSON(
				http.StatusForbidden,
				gin.H{"message": "Akses tidak diizinkan"},
			)
			return
		}

		c.Next()
	}
}
