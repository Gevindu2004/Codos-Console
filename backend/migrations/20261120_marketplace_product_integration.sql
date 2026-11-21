BEGIN;

ALTER TABLE public.marketplace_products
    ADD COLUMN IF NOT EXISTS gateway_url character varying(2048) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS public_page_url character varying(2048) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS integration_snippets json NOT NULL DEFAULT '{}'::json;

UPDATE public.marketplace_products
SET gateway_url = 'http://localhost:8000/api/v1/gateway/' || slug
WHERE gateway_url = '';

UPDATE public.marketplace_products
SET public_page_url = CASE
    WHEN product_type = 'api' THEN '/apis/' || slug
    ELSE '/models/' || slug
END
WHERE public_page_url = '';

ALTER TABLE public.marketplace_products
    ALTER COLUMN gateway_url DROP DEFAULT,
    ALTER COLUMN public_page_url DROP DEFAULT,
    ALTER COLUMN integration_snippets DROP DEFAULT;

COMMIT;
