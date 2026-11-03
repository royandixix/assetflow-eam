
BEGIN;

CREATE TABLE IF NOT EXISTS public.asset_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    asset_id UUID NOT NULL
        REFERENCES public.assets(id)
        ON DELETE RESTRICT,

    assigned_to UUID NOT NULL
        REFERENCES public.profiles(id)
        ON DELETE RESTRICT,

    assigned_at DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_return_at DATE,
    returned_at DATE,

    condition_out VARCHAR(20) NOT NULL
        CHECK (condition_out IN ('GOOD', 'FAIR', 'DAMAGED')),

    condition_in VARCHAR(20)
        CHECK (
            condition_in IS NULL
            OR condition_in IN ('GOOD', 'FAIR', 'DAMAGED')
        ),

    notes TEXT NOT NULL DEFAULT '',
    return_notes TEXT NOT NULL DEFAULT '',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT asset_assignments_expected_date_check
        CHECK (
            expected_return_at IS NULL
            OR expected_return_at >= assigned_at
        ),

    CONSTRAINT asset_assignments_return_date_check
        CHECK (
            returned_at IS NULL
            OR returned_at >= assigned_at
        ),

    CONSTRAINT asset_assignments_return_condition_check
        CHECK (
            returned_at IS NULL
            OR condition_in IS NOT NULL
        )
);

CREATE UNIQUE INDEX IF NOT EXISTS
    idx_asset_assignments_one_active
ON public.asset_assignments(asset_id)
WHERE returned_at IS NULL;

CREATE INDEX IF NOT EXISTS
    idx_asset_assignments_assigned_to
ON public.asset_assignments(assigned_to);

CREATE INDEX IF NOT EXISTS
    idx_asset_assignments_created_at
ON public.asset_assignments(created_at DESC);

ALTER TABLE public.asset_assignments
ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.asset_assignments
FROM PUBLIC, anon, authenticated;

COMMIT;
