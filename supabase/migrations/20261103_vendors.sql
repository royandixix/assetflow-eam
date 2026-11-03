
BEGIN;

DO $$
BEGIN
    IF to_regclass('public.vendors') IS NOT NULL
       OR to_regclass('public.vendor_number_seq') IS NOT NULL THEN
        RAISE EXCEPTION
            'Objek Vendor sudah tersedia. Periksa skema sebelum migrasi.';
    END IF;
END;
$$;

CREATE SEQUENCE public.vendor_number_seq START WITH 1;

CREATE TABLE public.vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    code VARCHAR(32) NOT NULL UNIQUE DEFAULT (
        'VND-' ||
        TO_CHAR(CURRENT_DATE, 'YYYY') ||
        '-' ||
        LPAD(
            NEXTVAL('public.vendor_number_seq')::TEXT,
            6,
            '0'
        )
    ),

    name VARCHAR(160) NOT NULL,
    category VARCHAR(16) NOT NULL
        CHECK (category IN ('SUPPLIER', 'SERVICE', 'BOTH')),

    contact_person VARCHAR(120) NOT NULL DEFAULT '',
    phone VARCHAR(30) NOT NULL DEFAULT '',
    email VARCHAR(254) NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_by UUID NOT NULL
        REFERENCES public.profiles(id) ON DELETE RESTRICT,

    updated_by UUID
        REFERENCES public.profiles(id) ON DELETE RESTRICT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT vendors_name_length CHECK (
        CHAR_LENGTH(BTRIM(name)) BETWEEN 3 AND 160
    ),

    CONSTRAINT vendors_contact_length CHECK (
        CHAR_LENGTH(contact_person) <= 120
    ),

    CONSTRAINT vendors_address_length CHECK (
        CHAR_LENGTH(address) <= 500
    ),

    CONSTRAINT vendors_notes_length CHECK (
        CHAR_LENGTH(notes) <= 1000
    ),

    CONSTRAINT vendors_phone_length CHECK (
        CHAR_LENGTH(phone) <= 30
    )
);

CREATE INDEX vendors_status_created_idx
    ON public.vendors(is_active, created_at DESC);

CREATE INDEX vendors_created_idx
    ON public.vendors(created_at DESC, id DESC);

CREATE INDEX vendors_category_idx
    ON public.vendors(category);

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.vendors
FROM PUBLIC, anon, authenticated;

COMMIT;
