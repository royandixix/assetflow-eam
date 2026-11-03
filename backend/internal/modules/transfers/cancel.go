package transfers

import (
	"errors"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

type CancelInput struct {
	Reason string `json:"reason"`
}

func (h *Handler) Cancel(c *gin.Context) {
	id := c.Param("id")

	if !validUUID(id) {
		fail(c, http.StatusBadRequest, "ID mutasi tidak valid")
		return
	}

	var input CancelInput

	if err := c.ShouldBindJSON(&input); err != nil {
		fail(c, http.StatusBadRequest, "Data pembatalan tidak valid")
		return
	}

	input.Reason = strings.TrimSpace(input.Reason)

	if n := utf8.RuneCountInString(input.Reason); n < 10 || n > 500 {
		fail(c, http.StatusBadRequest,
			"Alasan pembatalan harus 10 sampai 500 karakter")
		return
	}

	actorID, ok := authenticatedProfileID(c).(string)

	if !ok || !validUUID(actorID) {
		fail(c, http.StatusUnauthorized,
			"Identitas pengguna tidak valid")
		return
	}

	ctx := c.Request.Context()

	tx, err := h.db.Begin(ctx)
	if err != nil {
		dbError(c, err)
		return
	}
	defer tx.Rollback(ctx)

	var assetID string

	err = tx.QueryRow(ctx, `
		SELECT asset_id::text
		FROM public.asset_transfers
		WHERE id = $1::uuid
	`, id).Scan(&assetID)

	if errors.Is(err, pgx.ErrNoRows) {
		fail(c, http.StatusNotFound, "Mutasi tidak ditemukan")
		return
	}

	if err != nil {
		dbError(c, err)
		return
	}

	var currentLocation, currentDepartment, status string

	err = tx.QueryRow(ctx, `
		SELECT
			location_id::text,
			COALESCE(department_id::text, ''),
			status
		FROM public.assets
		WHERE id = $1::uuid
		FOR UPDATE
	`, assetID).Scan(
		&currentLocation,
		&currentDepartment,
		&status,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		fail(c, http.StatusNotFound, "Aset tidak ditemukan")
		return
	}

	if err != nil {
		dbError(c, err)
		return
	}

	var fromLocation, toLocation string
	var fromDepartment, toDepartment string
	var createdAt time.Time
	var cancelledAt *time.Time

	err = tx.QueryRow(ctx, `
		SELECT
			from_location_id::text,
			to_location_id::text,
			COALESCE(from_department_id::text, ''),
			COALESCE(to_department_id::text, ''),
			created_at,
			cancelled_at
		FROM public.asset_transfers
		WHERE id = $1::uuid
		FOR UPDATE
	`, id).Scan(
		&fromLocation,
		&toLocation,
		&fromDepartment,
		&toDepartment,
		&createdAt,
		&cancelledAt,
	)

	if err != nil {
		dbError(c, err)
		return
	}

	if cancelledAt != nil {
		fail(c, http.StatusConflict,
			"Mutasi ini sudah pernah dibatalkan")
		return
	}

	if status != "AVAILABLE" {
		fail(c, http.StatusConflict,
			"Aset sedang tidak tersedia untuk pembatalan mutasi")
		return
	}

	var hasAssignment bool

	err = tx.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM public.asset_assignments
			WHERE asset_id = $1::uuid
			  AND returned_at IS NULL
		)
	`, assetID).Scan(&hasAssignment)

	if err != nil {
		dbError(c, err)
		return
	}

	if hasAssignment {
		fail(c, http.StatusConflict,
			"Aset sedang memiliki penugasan aktif")
		return
	}

	var hasNewerTransfer bool

	err = tx.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM public.asset_transfers
			WHERE asset_id = $1::uuid
			  AND cancelled_at IS NULL
			  AND (created_at, id) >
			      ($2::timestamptz, $3::uuid)
		)
	`, assetID, createdAt, id).Scan(&hasNewerTransfer)

	if err != nil {
		dbError(c, err)
		return
	}

	if hasNewerTransfer {
		fail(c, http.StatusConflict,
			"Mutasi tidak dapat dibatalkan karena ada mutasi lanjutan")
		return
	}

	if currentLocation != toLocation ||
		currentDepartment != toDepartment {
		fail(c, http.StatusConflict,
			"Posisi aset sudah berbeda dari tujuan mutasi ini")
		return
	}

	tag, err := tx.Exec(ctx, `
		UPDATE public.assets
		SET
			location_id = $2::uuid,
			department_id = NULLIF($3::text, '')::uuid,
			updated_at = NOW()
		WHERE id = $1::uuid
		  AND status = 'AVAILABLE'
		  AND location_id = $4::uuid
		  AND department_id IS NOT DISTINCT FROM
		      NULLIF($5::text, '')::uuid
	`,
		assetID,
		fromLocation,
		fromDepartment,
		toLocation,
		toDepartment,
	)

	if err != nil {
		dbError(c, err)
		return
	}

	if tag.RowsAffected() != 1 {
		fail(c, http.StatusConflict,
			"Data aset berubah saat pembatalan")
		return
	}

	tag, err = tx.Exec(ctx, `
		UPDATE public.asset_transfers
		SET
			cancelled_at = NOW(),
			cancelled_by = $2::uuid,
			cancellation_reason = $3
		WHERE id = $1::uuid
		  AND cancelled_at IS NULL
	`, id, actorID, input.Reason)

	if err != nil {
		dbError(c, err)
		return
	}

	if tag.RowsAffected() != 1 {
		fail(c, http.StatusConflict,
			"Transaksi sudah dibatalkan")
		return
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO public.assetflow_audit_events (
			asset_id,
			entity_type,
			entity_id,
			action,
			actor_id,
			reason
		)
		VALUES (
			$1::uuid,
			'ASSET_TRANSFER',
			$2::uuid,
			'TRANSFER_CANCELLED',
			$3::uuid,
			$4
		)
	`, assetID, id, actorID, input.Reason)

	if err != nil {
		dbError(c, err)
		return
	}

	if err := tx.Commit(ctx); err != nil {
		dbError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Mutasi berhasil dibatalkan",
		"status":  "CANCELLED",
		"id":      id,
	})
}
