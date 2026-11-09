CREATE TABLE IF NOT EXISTS public.assetflow_user_preferences (
    user_id UUID PRIMARY KEY,
    theme VARCHAR(16) NOT NULL DEFAULT 'system',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT assetflow_user_preferences_theme_check
        CHECK (theme IN ('light', 'dark', 'system'))
);

ALTER TABLE public.assetflow_user_preferences
ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.assetflow_user_preferences
FROM anon, authenticated;