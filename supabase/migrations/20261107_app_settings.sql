CREATE TABLE IF NOT EXISTS public.assetflow_app_settings (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    app_name VARCHAR(100) NOT NULL DEFAULT 'AssetFlow EAM',
    organization_name VARCHAR(150) NOT NULL DEFAULT 'Organisasi',
    contact_email VARCHAR(254) NOT NULL DEFAULT '',
    timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Makassar',
    date_format VARCHAR(16) NOT NULL DEFAULT 'DD/MM/YYYY',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID,

    CONSTRAINT assetflow_settings_timezone_check
        CHECK (
            timezone IN (
                'Asia/Jakarta',
                'Asia/Makassar',
                'Asia/Jayapura'
            )
        ),

    CONSTRAINT assetflow_settings_date_format_check
        CHECK (
            date_format IN (
                'DD/MM/YYYY',
                'YYYY-MM-DD'
            )
        )
);

INSERT INTO public.assetflow_app_settings (
    id,
    app_name,
    organization_name,
    contact_email,
    timezone,
    date_format
)
VALUES (
    1,
    'AssetFlow EAM',
    'Organisasi',
    '',
    'Asia/Makassar',
    'DD/MM/YYYY'
)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.assetflow_app_settings
ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.assetflow_app_settings
FROM anon, authenticated;