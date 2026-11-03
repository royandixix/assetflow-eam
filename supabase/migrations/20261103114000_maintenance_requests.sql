BEGIN;

DO $$
BEGIN
  IF to_regclass('public.maintenance_requests') IS NOT NULL THEN
    RAISE EXCEPTION 'Tabel maintenance_requests sudah ada';
  END IF;
END
$$;

CREATE TABLE public.maintenance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL
    REFERENCES public.assets(id) ON DELETE RESTRICT,
  reported_by UUID NOT NULL
    REFERENCES public.profiles(id) ON DELETE RESTRICT,
  description TEXT NOT NULL
    CHECK (char_length(btrim(description)) BETWEEN 10 AND 2000),
  priority TEXT NOT NULL DEFAULT 'MEDIUM'
    CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  status TEXT NOT NULL DEFAULT 'REPORTED'
    CHECK (
      status IN (
        'REPORTED',
        'APPROVED',
        'REJECTED',
        'IN_PROGRESS',
        'COMPLETED',
        'CLOSED'
      )
    ),
  reviewed_by UUID
    REFERENCES public.profiles(id) ON DELETE RESTRICT,
  review_note TEXT NOT NULL DEFAULT ''
    CHECK (char_length(review_note) <= 1000),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT maintenance_review_consistency CHECK (
    (
      status = 'REPORTED'
      AND reviewed_by IS NULL
      AND reviewed_at IS NULL
    )
    OR
    (
      status <> 'REPORTED'
      AND reviewed_by IS NOT NULL
      AND reviewed_at IS NOT NULL
    )
  )
);

CREATE UNIQUE INDEX maintenance_one_active_report
ON public.maintenance_requests(asset_id)
WHERE status IN ('REPORTED', 'APPROVED', 'IN_PROGRESS');

CREATE INDEX maintenance_report_created_idx
ON public.maintenance_requests(created_at DESC, id DESC);

CREATE INDEX maintenance_report_reporter_idx
ON public.maintenance_requests(reported_by, created_at DESC);

ALTER TABLE public.maintenance_requests
ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.maintenance_requests
FROM PUBLIC, anon, authenticated;

COMMIT;
