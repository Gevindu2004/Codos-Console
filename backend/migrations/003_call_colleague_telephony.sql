-- CallColleague.ai: Twilio phone number SID & country tracking per tenant.
-- Additive & idempotent. Touches only cc_tenants.

ALTER TABLE public.cc_tenants ADD COLUMN IF NOT EXISTS twilio_phone_sid VARCHAR(64);
ALTER TABLE public.cc_tenants ADD COLUMN IF NOT EXISTS phone_country VARCHAR(8) DEFAULT 'US';
