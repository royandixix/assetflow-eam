package middleware

import (
	"context"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

var auditChangesResources = map[string]bool{
	"asset-categories":     true,
	"assets":               true,
	"asset-assignments":    true,
	"asset-transfers":      true,
	"departments":          true,
	"locations":            true,
	"maintenance-requests": true,
	"work-orders":          true,
	"users":                true,
	"vendors":              true,
	"settings":             true,
	"user-preferences":     true,
}

func auditChangesResource(route string) string {
	const prefix = "/api/v1/"

	if !strings.HasPrefix(route, prefix) {
		return ""
	}

	parts := strings.Split(
		strings.TrimPrefix(route, prefix),
		"/",
	)

	if len(parts) == 0 {
		return ""
	}

	resource := parts[0]

	if !auditChangesResources[resource] {
		return ""
	}

	return resource
}

func auditChangesAction(method, route string) string {
	parts := strings.Split(
		strings.Trim(route, "/"),
		"/",
	)

	last := ""

	if len(parts) > 0 {
		last = strings.ToLower(parts[len(parts)-1])
	}

	switch last {
	case "invite":
		return "INVITE"
	case "start":
		return "START"
	case "complete":
		return "COMPLETE"
	case "close":
		return "CLOSE"
	case "approve":
		return "APPROVE"
	case "reject":
		return "REJECT"
	case "cancel":
		return "CANCEL"
	case "return":
		return "RETURN"
	case "review":
		return "REVIEW"
	case "image":
		return "IMAGE_CHANGE"
	}

	switch method {
	case http.MethodPost:
		return "CREATE"
	case http.MethodPut, http.MethodPatch:
		return "UPDATE"
	case http.MethodDelete:
		return "DELETE"
	default:
		return ""
	}
}

func AuditChanges(db *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		method := c.Request.Method

		if method != http.MethodPost &&
			method != http.MethodPut &&
			method != http.MethodPatch &&
			method != http.MethodDelete {
			return
		}

		status := c.Writer.Status()

		if status < 200 || status >= 300 {
			return
		}

		identity, ok := CurrentIdentity(c)
		if !ok {
			return
		}

		route := c.FullPath()
		resource := auditChangesResource(route)

		if resource == "" {
			return
		}

		action := auditChangesAction(method, route)
		if action == "" {
			return
		}

		resourceID := c.Param("id")

		userAgent := strings.ToValidUTF8(
			c.Request.UserAgent(),
			"",
		)

		if len(userAgent) > 500 {
			userAgent = strings.ToValidUTF8(
				userAgent[:500],
				"",
			)
		}

		ctx, cancel := context.WithTimeout(
			c.Request.Context(),
			5*time.Second,
		)
		defer cancel()

		_, err := db.Exec(
			ctx,
			`INSERT INTO public.assetflow_audit_logs (
                actor_id,
                actor_name,
                actor_email,
                actor_role,
                action,
                resource,
                resource_id,
                method,
                route,
                http_status,
                ip_address,
                user_agent
            ) VALUES (
                $1::uuid, $2, $3, $4,
                $5, $6, $7, $8,
                $9, $10, $11, $12
            )`,
			identity.ID,
			identity.FullName,
			identity.Email,
			identity.RoleCode,
			action,
			resource,
			resourceID,
			method,
			route,
			status,
			c.ClientIP(),
			userAgent,
		)

		if err != nil {
			log.Printf(
				"[audit-trail] gagal mencatat %s %s: %v",
				method,
				route,
				err,
			)
		}
	}
}
