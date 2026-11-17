-- =====================================================================
-- CallColleague.ai Database Migration (PostgreSQL)
-- Run this migration on top of skybeak_schema.sql:
--   psql -U postgres -d <your_db_name> -f backend/migrations/001_call_colleague.sql
-- Safe to re-run multiple times (uses IF NOT EXISTS & ON CONFLICT DO NOTHING).
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.cc_tenants (
    id character varying(64) NOT NULL,
    user_id character varying(128) NOT NULL,
    email character varying(255) NOT NULL,
    business_name character varying(200) NOT NULL,
    industry character varying(32) NOT NULL,
    timezone character varying(80) NOT NULL,
    plan_tier character varying(32) NOT NULL,
    agent_active boolean NOT NULL DEFAULT true,
    voice_persona json NOT NULL,
    vapi_assistant_id character varying(64),
    vapi_phone_number_id character varying(64),
    virtual_phone_number character varying(40),
    telephony_setup_type character varying(40) NOT NULL,
    forwarding_number character varying(40),
    selected_carrier_id character varying(64),
    is_number_verified boolean NOT NULL DEFAULT false,
    sip_config json NOT NULL,
    google_calendar_connected boolean NOT NULL DEFAULT false,
    calendar_email character varying(255),
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT cc_tenants_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS ix_cc_tenants_user_id ON public.cc_tenants USING btree (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS ix_cc_tenants_vapi_assistant_id ON public.cc_tenants USING btree (vapi_assistant_id);

CREATE TABLE IF NOT EXISTS public.cc_operating_hours (
    id character varying(64) NOT NULL,
    tenant_id character varying(64) NOT NULL,
    day character varying(20) NOT NULL,
    open_time character varying(10) NOT NULL,
    close_time character varying(10) NOT NULL,
    is_closed boolean NOT NULL DEFAULT false,
    CONSTRAINT cc_operating_hours_pkey PRIMARY KEY (id),
    CONSTRAINT cc_operating_hours_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.cc_tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_cc_operating_hours_tenant_id ON public.cc_operating_hours USING btree (tenant_id);

CREATE TABLE IF NOT EXISTS public.cc_services (
    id character varying(64) NOT NULL,
    tenant_id character varying(64) NOT NULL,
    name character varying(200) NOT NULL,
    staff_member character varying(150),
    price numeric(10, 2) NOT NULL DEFAULT 0,
    duration_minutes integer NOT NULL DEFAULT 30,
    description text NOT NULL DEFAULT '',
    CONSTRAINT cc_services_pkey PRIMARY KEY (id),
    CONSTRAINT cc_services_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.cc_tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_cc_services_tenant_id ON public.cc_services USING btree (tenant_id);

CREATE TABLE IF NOT EXISTS public.cc_departments (
    id character varying(64) NOT NULL,
    tenant_id character varying(64) NOT NULL,
    name character varying(160) NOT NULL,
    phone_number character varying(40) NOT NULL,
    description text NOT NULL DEFAULT '',
    CONSTRAINT cc_departments_pkey PRIMARY KEY (id),
    CONSTRAINT cc_departments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.cc_tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_cc_departments_tenant_id ON public.cc_departments USING btree (tenant_id);

CREATE TABLE IF NOT EXISTS public.cc_knowledge_faqs (
    id character varying(64) NOT NULL,
    tenant_id character varying(64) NOT NULL,
    category character varying(32) NOT NULL,
    question text NOT NULL,
    answer text NOT NULL,
    CONSTRAINT cc_knowledge_faqs_pkey PRIMARY KEY (id),
    CONSTRAINT cc_knowledge_faqs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.cc_tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_cc_knowledge_faqs_tenant_id ON public.cc_knowledge_faqs USING btree (tenant_id);

CREATE TABLE IF NOT EXISTS public.cc_call_logs (
    id character varying(64) NOT NULL,
    tenant_id character varying(64) NOT NULL,
    vapi_call_id character varying(100),
    caller_name character varying(160) NOT NULL,
    caller_phone character varying(40) NOT NULL,
    timestamp_label character varying(80) NOT NULL,
    duration character varying(32) NOT NULL,
    status character varying(32) NOT NULL,
    sentiment character varying(32) NOT NULL,
    service_requested character varying(255),
    summary text NOT NULL DEFAULT '',
    recording_url text,
    transcript json NOT NULL,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT cc_call_logs_pkey PRIMARY KEY (id),
    CONSTRAINT cc_call_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.cc_tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_cc_call_logs_tenant_id ON public.cc_call_logs USING btree (tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS ix_cc_call_logs_vapi_call_id ON public.cc_call_logs USING btree (vapi_call_id);

CREATE TABLE IF NOT EXISTS public.cc_appointments (
    id character varying(64) NOT NULL,
    tenant_id character varying(64) NOT NULL,
    client_name character varying(160) NOT NULL,
    client_phone character varying(40) NOT NULL,
    service_name character varying(200) NOT NULL,
    staff_member character varying(160) NOT NULL,
    date_time character varying(120) NOT NULL,
    duration_minutes integer NOT NULL DEFAULT 30,
    price numeric(10, 2) NOT NULL DEFAULT 0,
    status character varying(32) NOT NULL,
    booked_via character varying(64) NOT NULL,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT cc_appointments_pkey PRIMARY KEY (id),
    CONSTRAINT cc_appointments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.cc_tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_cc_appointments_tenant_id ON public.cc_appointments USING btree (tenant_id);

CREATE TABLE IF NOT EXISTS public.cc_voice_api_keys (
    id character varying(64) NOT NULL,
    tenant_id character varying(64) NOT NULL,
    name character varying(160) NOT NULL,
    agent_name character varying(200) NOT NULL,
    key_prefix character varying(24) NOT NULL,
    key_hash character varying(64) NOT NULL,
    masked_secret character varying(40) NOT NULL,
    scopes json NOT NULL,
    webhook_url text NOT NULL,
    created_label character varying(80) NOT NULL,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT cc_voice_api_keys_pkey PRIMARY KEY (id),
    CONSTRAINT cc_voice_api_keys_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.cc_tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_cc_voice_api_keys_tenant_id ON public.cc_voice_api_keys USING btree (tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS ix_cc_voice_api_keys_key_hash ON public.cc_voice_api_keys USING btree (key_hash);

-- =====================================================================
-- Seed Default Demo Tenant & Initial Workspace Data
-- =====================================================================

INSERT INTO public.cc_tenants (
    id, user_id, email, business_name, industry, timezone, plan_tier,
    agent_active, voice_persona, vapi_assistant_id, virtual_phone_number,
    telephony_setup_type, forwarding_number, selected_carrier_id,
    is_number_verified, sip_config, google_calendar_connected, calendar_email
) VALUES (
    'usr_demo_01',
    'usr_demo_01',
    'owner@luxehairlounge.com',
    'Luxe Hair & Color Lounge',
    'salon',
    'America/New_York',
    'growth',
    true,
    '{"id":"v-sophia","name":"Sophia","gender":"Female","accent":"American","tone":"Friendly & Warm — Ideal for Salons, Spas & Hospitality","previewText":"Hi! Thank you for calling Luxe Hair & Color Lounge. This is Sophia, how can I brighten your day?"}'::json,
    'ag_demo_luxe_salon',
    '+1 (888) 412-9940',
    'new_dedicated_number',
    '',
    'dialog_sl',
    false,
    '{"sipUri":"","authUsername":"","transport":"TLS"}'::json,
    false,
    ''
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.cc_operating_hours (id, tenant_id, day, open_time, close_time, is_closed) VALUES
    ('usr_demo_01_Monday', 'usr_demo_01', 'Monday', '09:00', '18:00', false),
    ('usr_demo_01_Tuesday', 'usr_demo_01', 'Tuesday', '09:00', '18:00', false),
    ('usr_demo_01_Wednesday', 'usr_demo_01', 'Wednesday', '09:00', '18:00', false),
    ('usr_demo_01_Thursday', 'usr_demo_01', 'Thursday', '09:00', '19:00', false),
    ('usr_demo_01_Friday', 'usr_demo_01', 'Friday', '09:00', '19:00', false),
    ('usr_demo_01_Saturday', 'usr_demo_01', 'Saturday', '09:00', '17:00', false),
    ('usr_demo_01_Sunday', 'usr_demo_01', 'Sunday', '10:00', '16:00', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.cc_services (id, tenant_id, name, staff_member, price, duration_minutes, description) VALUES
    ('usr_demo_01_srv_salon_1', 'usr_demo_01', 'Women''s Cut & Signature Blowout', 'Sarah / Elena', 65.00, 45, 'Includes deep cleansing wash, custom cut, and styled blowout.'),
    ('usr_demo_01_srv_salon_2', 'usr_demo_01', 'Full Balayage & Highlights', 'Elena (Master Colorist)', 185.00, 120, 'Hand-painted dimensional blonde/caramel tones with gloss toner.'),
    ('usr_demo_01_srv_salon_3', 'usr_demo_01', 'Men''s Precision Cut & Style', 'Jake', 35.00, 30, 'Detailed fade or scissor cut, scalp massage, and styling.'),
    ('usr_demo_01_srv_salon_4', 'usr_demo_01', 'Brazilian Keratin Smoothing', 'Sarah', 160.00, 90, 'Eliminates frizz and creates mirror shine lasting 3-4 months.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.cc_departments (id, tenant_id, name, phone_number, description) VALUES
    ('usr_demo_01_dept_salon_1', 'usr_demo_01', 'Salon Front Desk', '+1 (415) 392-8810', 'Transfer when caller asks for bridal group bookings or front desk coordinator.'),
    ('usr_demo_01_dept_salon_2', 'usr_demo_01', 'Owner / VIP Escalation', '+1 (415) 392-8899', 'Transfer for urgent complaints or VIP stylist requests.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.cc_knowledge_faqs (id, tenant_id, category, question, answer) VALUES
    ('usr_demo_01_faq_salon_1', 'usr_demo_01', 'policy', 'What is your cancellation policy?', 'We kindly ask for 24 hours notice for cancellations or reschedules to avoid a 50% deposit fee.'),
    ('usr_demo_01_faq_salon_2', 'usr_demo_01', 'parking', 'Where can I park?', 'We offer free dedicated client parking directly behind the salon on 4th Avenue, plus 2-hour street parking out front.'),
    ('usr_demo_01_faq_salon_3', 'usr_demo_01', 'general', 'Should I wash my hair before a balayage appointment?', 'We recommend arriving with dry hair washed within the last 24 hours without heavy oils.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.cc_call_logs (
    id, tenant_id, vapi_call_id, caller_name, caller_phone, timestamp_label,
    duration, status, sentiment, service_requested, summary, transcript
) VALUES (
    'call_101',
    'usr_demo_01',
    'call_101',
    'Jessica Miller',
    '+1 (555) 234-8910',
    '12 mins ago',
    '1m 48s',
    'booked',
    'positive',
    'Women''s Cut & Signature Blowout ($65)',
    'Caller asked if Elena or Sarah had an opening tomorrow morning. AI checked Google Calendar, confirmed 11:00 AM with Sarah, and sent SMS confirmation.',
    '[{"role":"agent","text":"Hi! Thank you for calling Luxe Hair & Color Lounge. This is Sophia, your AI receptionist. How can I brighten your day?"},{"role":"user","text":"Hi Sophia! Do you have any openings tomorrow morning for a women''s cut and blowout?"},{"role":"agent","text":"I''d love to check that for you! Our Women''s Cut & Signature Blowout is $65 and takes 45 minutes. Sarah has 11:00 AM open tomorrow. Would 11:00 AM work?"}]'::json
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.cc_appointments (
    id, tenant_id, client_name, client_phone, service_name, staff_member,
    date_time, duration_minutes, price, status, booked_via
) VALUES (
    'apt_201',
    'usr_demo_01',
    'Jessica Miller',
    '+1 (555) 234-8910',
    'Women''s Cut & Signature Blowout',
    'Sarah (Senior Stylist)',
    'Tomorrow, 11:00 AM',
    45,
    65.00,
    'confirmed',
    'AI Voice Receptionist'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.cc_voice_api_keys (
    id, tenant_id, name, agent_name, key_prefix, key_hash,
    masked_secret, scopes, webhook_url, created_label
) VALUES
    ('cc-key-1', 'usr_demo_01', 'Production Inbound SIP & Calendar Key', 'Luxe Hair & Color Lounge (Sophia)', 'cc_live_demo1', 'demo_hash_1', 'API**********', '["voice:inbound-sip","voice:vapi-assistant","calendar:google-sync"]'::json, 'https://api.viacodos.com/v1/webhooks/call-colleague', 'Active • Auto-Provisioned'),
    ('cc-key-2', 'usr_demo_01', 'Staging WebRTC Sandbox Key', 'Apex Family Dental & Wellness', 'cc_live_demo2', 'demo_hash_2', 'API**********', '["voice:webrtc-stream","voice:warm-transfer"]'::json, 'https://staging.viacodos.com/v1/webhooks/call-colleague', '2 days ago')
ON CONFLICT (id) DO NOTHING;

COMMIT;
