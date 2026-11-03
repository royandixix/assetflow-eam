BEGIN;

    CREATE TABLE public.roles
    (
        code TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT
    );

    INSERT INTO public.roles
        (code, name, description)
    VALUES
        ('SUPER_ADMIN', 'Super Admin', 'Pengelola sistem'),
        ('ASSET_ADMIN', 'Admin Aset', 'Pengelola aset'),
        ('MANAGER', 'Manager', 'Pengawas operasional'),
        ('TECHNICIAN', 'Teknisi', 'Pelaksana pemeliharaan'),
        ('STAFF', 'Staff', 'Pengguna aset')
    ON CONFLICT
    (code) DO NOTHING;

CREATE TABLE public.profiles
(
    id UUID PRIMARY KEY REFERENCES auth.users(id)
        ON DELETE CASCADE,
    full_name VARCHAR(150) NOT NULL,
    role_code TEXT NOT NULL DEFAULT 'STAFF'
        REFERENCES public.roles(code),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.asset_categories
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(40) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.locations
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(40) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.departments
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(40) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.assets
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_code VARCHAR(40) NOT NULL UNIQUE,
    name VARCHAR(160) NOT NULL,
    category_id UUID NOT NULL
        REFERENCES public.asset_categories(id),
    location_id UUID NOT NULL
        REFERENCES public.locations(id),
    department_id UUID
        REFERENCES public.departments(id),
    status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE'
        CHECK (status IN (
            'AVAILABLE',
            'ASSIGNED',
            'MAINTENANCE',
            'RETIRED'
        )),
    condition VARCHAR(30) NOT NULL DEFAULT 'GOOD'
        CHECK (condition IN (
            'GOOD',
            'FAIR',
            'DAMAGED'
        )),
    purchase_date DATE,
    purchase_price NUMERIC(14,2)
        CHECK (purchase_price >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_role
ON public.profiles(role_code);

CREATE INDEX idx_assets_category
ON public.assets(category_id);

CREATE INDEX idx_assets_location
ON public.assets(location_id);

CREATE INDEX idx_assets_department
ON public.assets(department_id);

CREATE INDEX idx_assets_status
ON public.assets(status);

CREATE INDEX idx_assets_created
ON public.assets(created_at DESC);

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;


REVOKE ALL ON public.roles,
    public.profiles,
    public.asset_categories,
    public.locations,
    public.departments,
    public.assets
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.roles TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;

CREATE POLICY roles_read_authenticated
ON public.roles FOR
SELECT
    TO authenticated
USING
(TRUE);

CREATE POLICY profiles_read_own
ON public.profiles FOR
SELECT
    TO authenticated
USING
((SELECT auth.uid())
= id);

COMMIT;
