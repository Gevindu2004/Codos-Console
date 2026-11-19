BEGIN;

CREATE TABLE IF NOT EXISTS public.developers (
    id character varying(128) NOT NULL,
    developer_name character varying(180) NOT NULL,
    company_name character varying(180) NOT NULL,
    email character varying(320) NOT NULL,
    email_verified boolean NOT NULL,
    country character varying(120) NOT NULL,
    website character varying(2048),
    support_contact character varying(320) NOT NULL,
    status character varying(32) NOT NULL,
    review_notes text NOT NULL,
    audit_logs json,
    submitted_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL,
    CONSTRAINT developers_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_developers_email
    ON public.developers USING btree (email);
CREATE INDEX IF NOT EXISTS ix_developers_status
    ON public.developers USING btree (status);

ALTER TABLE public.marketplace_products
    ADD COLUMN IF NOT EXISTS review_notes text;
UPDATE public.marketplace_products
    SET review_notes = ''
    WHERE review_notes IS NULL;
ALTER TABLE public.marketplace_products
    ALTER COLUMN review_notes SET NOT NULL;

ALTER TABLE public.marketplace_products
    ADD COLUMN IF NOT EXISTS audit_logs json;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'marketplace_products_developer_id_fkey'
          AND conrelid = 'public.marketplace_products'::regclass
    ) THEN
        ALTER TABLE public.marketplace_products
            ADD CONSTRAINT marketplace_products_developer_id_fkey
            FOREIGN KEY (developer_id)
            REFERENCES public.developers (id)
            ON DELETE RESTRICT
            NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.marketplace_products AS product
        LEFT JOIN public.developers AS developer ON developer.id = product.developer_id
        WHERE developer.id IS NULL
    ) THEN
        ALTER TABLE public.marketplace_products
            VALIDATE CONSTRAINT marketplace_products_developer_id_fkey;
    END IF;
END
$$;

COMMIT;
