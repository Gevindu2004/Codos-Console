-- CallColleague.ai: Google Calendar integration + real appointment timestamps.
-- Additive & idempotent. Touches only cc_* tables.

CREATE TABLE IF NOT EXISTS public.cc_tenant_integrations (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES public.cc_tenants(id) ON DELETE CASCADE,
    provider VARCHAR(40) NOT NULL DEFAULT 'google_calendar',
    encrypted_credentials TEXT NOT NULL,
    calendar_id VARCHAR(255) NOT NULL DEFAULT 'primary',
    account_email VARCHAR(255),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, provider)
);
CREATE INDEX IF NOT EXISTS ix_cc_tenant_integrations_tenant ON public.cc_tenant_integrations(tenant_id);

ALTER TABLE public.cc_appointments ADD COLUMN IF NOT EXISTS starts_at TIMESTAMP;
ALTER TABLE public.cc_appointments ADD COLUMN IF NOT EXISTS gcal_event_id VARCHAR(255);
CREATE INDEX IF NOT EXISTS ix_cc_appointments_tenant_starts ON public.cc_appointments(tenant_id, starts_at);
