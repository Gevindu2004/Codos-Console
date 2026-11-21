BEGIN;

ALTER TABLE public.marketplace_products
    ADD COLUMN IF NOT EXISTS base_price double precision NOT NULL DEFAULT 0.0,
    ADD COLUMN IF NOT EXISTS pricing_tier character varying(16),
    ADD COLUMN IF NOT EXISTS profit_margin_percent double precision NOT NULL DEFAULT 0.0,
    ADD COLUMN IF NOT EXISTS final_retail_price double precision NOT NULL DEFAULT 0.0,
    ADD COLUMN IF NOT EXISTS agreement_signed boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS agreement_signed_by character varying(180),
    ADD COLUMN IF NOT EXISTS agreement_signed_at timestamp without time zone,
    ADD COLUMN IF NOT EXISTS agreement_version character varying(32) NOT NULL DEFAULT 'v1.0';

UPDATE public.marketplace_products
SET status = 'Approved'
WHERE status = 'Published' AND agreement_signed = false;

ALTER TABLE public.marketplace_products
    ALTER COLUMN base_price DROP DEFAULT,
    ALTER COLUMN profit_margin_percent DROP DEFAULT,
    ALTER COLUMN final_retail_price DROP DEFAULT,
    ALTER COLUMN agreement_signed DROP DEFAULT,
    ALTER COLUMN agreement_version DROP DEFAULT;

COMMIT;
