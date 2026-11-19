--
-- PostgreSQL database dump
--

\restrict 2V0cO9lYlCvtzoTpfHv9PJXrY0OQLHJDG4M3OAlGPo4biX2NnRSdkmV9K0dUeSZ

-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: vector; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


--
-- Name: EXTENSION vector; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION vector IS 'vector data type and ivfflat and hnsw access methods';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: api_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_keys (
    id character varying(36) NOT NULL,
    user_id character varying(128) NOT NULL,
    configured_model_id character varying(36) NOT NULL,
    name character varying(100) NOT NULL,
    key_prefix character varying(24) NOT NULL,
    key_hash character varying(64) NOT NULL,
    is_active boolean NOT NULL,
    created_at timestamp without time zone NOT NULL,
    last_used_at timestamp without time zone
);


--
-- Name: base_model_catalog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.base_model_catalog (
    id character varying(64) NOT NULL,
    name character varying(120) NOT NULL,
    category character varying(32) NOT NULL,
    industry character varying(80),
    base_hf_repo character varying(180) NOT NULL,
    adapter_name character varying(100),
    adapter_path character varying(255),
    description text NOT NULL,
    default_system_prompt text NOT NULL,
    is_active boolean NOT NULL
);


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_messages (
    id character varying(36) NOT NULL,
    user_id character varying(128) NOT NULL,
    configured_model_id character varying(36) NOT NULL,
    role character varying(16) NOT NULL,
    content text NOT NULL,
    sources_used json,
    latency_ms integer,
    tokens_used integer,
    created_at timestamp without time zone NOT NULL
);


--
-- Name: configured_models; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.configured_models (
    id character varying(36) NOT NULL,
    user_id character varying(128) NOT NULL,
    name character varying(140) NOT NULL,
    base_model_id character varying(64) NOT NULL,
    industry character varying(80),
    system_prompt text NOT NULL,
    temperature double precision NOT NULL,
    chunk_size integer NOT NULL,
    status character varying(32) NOT NULL,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL
);


--
-- Name: custom_feature_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.custom_feature_requests (
    id character varying(36) NOT NULL,
    user_id character varying(128) NOT NULL,
    configured_model_id character varying(36),
    title character varying(160) NOT NULL,
    details text NOT NULL,
    status character varying(24) NOT NULL,
    created_at timestamp without time zone NOT NULL
);


--
-- Name: document_chunks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_chunks (
    id character varying(36) NOT NULL,
    user_id character varying(128) NOT NULL,
    configured_model_id character varying(36) NOT NULL,
    source_id character varying(36) NOT NULL,
    source_label character varying(255) NOT NULL,
    chunk_index integer NOT NULL,
    content text NOT NULL,
    metadata_json json,
    embedding public.vector(384) NOT NULL
);


--
-- Name: knowledge_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_sources (
    id character varying(36) NOT NULL,
    user_id character varying(128) NOT NULL,
    configured_model_id character varying(36) NOT NULL,
    source_type character varying(20) NOT NULL,
    file_name character varying(255),
    file_path character varying(500),
    file_format character varying(20),
    file_size_bytes integer,
    token_count integer NOT NULL,
    db_type character varying(32),
    db_label character varying(120),
    encrypted_connection_uri text,
    selected_tables json,
    status character varying(32) NOT NULL,
    error_message text,
    created_at timestamp without time zone NOT NULL
);


--
-- Name: processing_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.processing_jobs (
    id character varying(36) NOT NULL,
    user_id character varying(128) NOT NULL,
    configured_model_id character varying(36) NOT NULL,
    status character varying(24) NOT NULL,
    current_step integer NOT NULL,
    step_label character varying(180) NOT NULL,
    progress_percent integer NOT NULL,
    error_message text,
    started_at timestamp without time zone NOT NULL,
    completed_at timestamp without time zone
);


--
-- Name: usage_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usage_logs (
    id character varying(36) NOT NULL,
    user_id character varying(128) NOT NULL,
    configured_model_id character varying(36) NOT NULL,
    channel character varying(16) NOT NULL,
    prompt_tokens integer NOT NULL,
    completion_tokens integer NOT NULL,
    latency_ms integer NOT NULL,
    status_code integer NOT NULL,
    created_at timestamp without time zone NOT NULL
);


--
-- Name: developers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.developers (
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
    updated_at timestamp without time zone NOT NULL
);


--
-- Name: gateway_usage_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gateway_usage_logs (
    id character varying(36) NOT NULL,
    product_id character varying(36) NOT NULL,
    developer_id character varying(128) NOT NULL,
    customer_key_id character varying(36) NOT NULL,
    endpoint character varying(2048) NOT NULL,
    method character varying(10) NOT NULL,
    status_code integer NOT NULL,
    latency_ms integer NOT NULL,
    created_at timestamp without time zone NOT NULL
);


--
-- Name: marketplace_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketplace_products (
    id character varying(36) NOT NULL,
    slug character varying(180) NOT NULL,
    developer_id character varying(128) NOT NULL,
    provider_type character varying(32) NOT NULL,
    product_type character varying(16) NOT NULL,
    name character varying(180) NOT NULL,
    version character varying(80) NOT NULL,
    category character varying(120) NOT NULL,
    short_description character varying(500) NOT NULL,
    detailed_description text NOT NULL,
    logo_url character varying(2048),
    base_url character varying(2048) NOT NULL,
    health_check_url character varying(2048),
    gateway_url character varying(2048) NOT NULL,
    public_page_url character varying(2048) NOT NULL,
    integration_snippets json NOT NULL,
    auth_method character varying(32) NOT NULL,
    upstream_auth_header character varying(128),
    upstream_api_key text,
    openapi_spec json,
    io_schema json,
    pricing_model character varying(64) NOT NULL,
    pricing_plans json,
    base_price double precision NOT NULL,
    pricing_tier character varying(16),
    profit_margin_percent double precision NOT NULL,
    final_retail_price double precision NOT NULL,
    agreement_signed boolean NOT NULL,
    agreement_signed_by character varying(180),
    agreement_signed_at timestamp without time zone,
    agreement_version character varying(32) NOT NULL,
    rate_limit_rpm integer NOT NULL,
    avg_latency_ms double precision,
    status character varying(32) NOT NULL,
    review_notes text NOT NULL,
    audit_logs json,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL
);


--
-- Name: api_keys api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_pkey PRIMARY KEY (id);


--
-- Name: base_model_catalog base_model_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.base_model_catalog
    ADD CONSTRAINT base_model_catalog_pkey PRIMARY KEY (id);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: configured_models configured_models_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.configured_models
    ADD CONSTRAINT configured_models_pkey PRIMARY KEY (id);


--
-- Name: custom_feature_requests custom_feature_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_feature_requests
    ADD CONSTRAINT custom_feature_requests_pkey PRIMARY KEY (id);


--
-- Name: document_chunks document_chunks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_chunks
    ADD CONSTRAINT document_chunks_pkey PRIMARY KEY (id);


--
-- Name: knowledge_sources knowledge_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_sources
    ADD CONSTRAINT knowledge_sources_pkey PRIMARY KEY (id);


--
-- Name: processing_jobs processing_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processing_jobs
    ADD CONSTRAINT processing_jobs_pkey PRIMARY KEY (id);


--
-- Name: usage_logs usage_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_logs
    ADD CONSTRAINT usage_logs_pkey PRIMARY KEY (id);


--
-- Name: developers developers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.developers
    ADD CONSTRAINT developers_pkey PRIMARY KEY (id);


--
-- Name: gateway_usage_logs gateway_usage_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gateway_usage_logs
    ADD CONSTRAINT gateway_usage_logs_pkey PRIMARY KEY (id);


--
-- Name: marketplace_products marketplace_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_products
    ADD CONSTRAINT marketplace_products_pkey PRIMARY KEY (id);


--
-- Name: ix_api_keys_configured_model_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_api_keys_configured_model_id ON public.api_keys USING btree (configured_model_id);


--
-- Name: ix_api_keys_key_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_api_keys_key_hash ON public.api_keys USING btree (key_hash);


--
-- Name: ix_api_keys_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_api_keys_user_id ON public.api_keys USING btree (user_id);


--
-- Name: ix_chat_messages_configured_model_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_chat_messages_configured_model_id ON public.chat_messages USING btree (configured_model_id);


--
-- Name: ix_chat_messages_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_chat_messages_user_id ON public.chat_messages USING btree (user_id);


--
-- Name: ix_chunks_user_model; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_chunks_user_model ON public.document_chunks USING btree (user_id, configured_model_id);


--
-- Name: ix_configured_models_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_configured_models_user_id ON public.configured_models USING btree (user_id);


--
-- Name: ix_custom_feature_requests_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_custom_feature_requests_user_id ON public.custom_feature_requests USING btree (user_id);


--
-- Name: ix_document_chunks_configured_model_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_document_chunks_configured_model_id ON public.document_chunks USING btree (configured_model_id);


--
-- Name: ix_document_chunks_source_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_document_chunks_source_id ON public.document_chunks USING btree (source_id);


--
-- Name: ix_document_chunks_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_document_chunks_user_id ON public.document_chunks USING btree (user_id);


--
-- Name: ix_knowledge_sources_configured_model_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_knowledge_sources_configured_model_id ON public.knowledge_sources USING btree (configured_model_id);


--
-- Name: ix_knowledge_sources_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_knowledge_sources_user_id ON public.knowledge_sources USING btree (user_id);


--
-- Name: ix_processing_jobs_configured_model_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_processing_jobs_configured_model_id ON public.processing_jobs USING btree (configured_model_id);


--
-- Name: ix_processing_jobs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_processing_jobs_user_id ON public.processing_jobs USING btree (user_id);


--
-- Name: ix_usage_logs_configured_model_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_usage_logs_configured_model_id ON public.usage_logs USING btree (configured_model_id);


--
-- Name: ix_usage_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_usage_logs_user_id ON public.usage_logs USING btree (user_id);


--
-- Name: ix_developers_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_developers_email ON public.developers USING btree (email);


--
-- Name: ix_developers_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_developers_status ON public.developers USING btree (status);


--
-- Name: ix_gateway_usage_logs_customer_key_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_gateway_usage_logs_customer_key_id ON public.gateway_usage_logs USING btree (customer_key_id);


--
-- Name: ix_gateway_usage_logs_developer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_gateway_usage_logs_developer_id ON public.gateway_usage_logs USING btree (developer_id);


--
-- Name: ix_gateway_usage_logs_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_gateway_usage_logs_product_id ON public.gateway_usage_logs USING btree (product_id);


--
-- Name: ix_gateway_usage_product_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_gateway_usage_product_created ON public.gateway_usage_logs USING btree (product_id, created_at);


--
-- Name: ix_marketplace_products_developer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_marketplace_products_developer_id ON public.marketplace_products USING btree (developer_id);


--
-- Name: ix_marketplace_products_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_marketplace_products_slug ON public.marketplace_products USING btree (slug);


--
-- Name: ix_marketplace_products_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_marketplace_products_status ON public.marketplace_products USING btree (status);


--
-- Name: api_keys api_keys_configured_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_configured_model_id_fkey FOREIGN KEY (configured_model_id) REFERENCES public.configured_models(id) ON DELETE CASCADE;


--
-- Name: chat_messages chat_messages_configured_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_configured_model_id_fkey FOREIGN KEY (configured_model_id) REFERENCES public.configured_models(id) ON DELETE CASCADE;


--
-- Name: configured_models configured_models_base_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.configured_models
    ADD CONSTRAINT configured_models_base_model_id_fkey FOREIGN KEY (base_model_id) REFERENCES public.base_model_catalog(id);


--
-- Name: document_chunks document_chunks_configured_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_chunks
    ADD CONSTRAINT document_chunks_configured_model_id_fkey FOREIGN KEY (configured_model_id) REFERENCES public.configured_models(id) ON DELETE CASCADE;


--
-- Name: document_chunks document_chunks_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_chunks
    ADD CONSTRAINT document_chunks_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.knowledge_sources(id) ON DELETE CASCADE;


--
-- Name: knowledge_sources knowledge_sources_configured_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_sources
    ADD CONSTRAINT knowledge_sources_configured_model_id_fkey FOREIGN KEY (configured_model_id) REFERENCES public.configured_models(id) ON DELETE CASCADE;


--
-- Name: processing_jobs processing_jobs_configured_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processing_jobs
    ADD CONSTRAINT processing_jobs_configured_model_id_fkey FOREIGN KEY (configured_model_id) REFERENCES public.configured_models(id) ON DELETE CASCADE;


--
-- Name: marketplace_products marketplace_products_developer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_products
    ADD CONSTRAINT marketplace_products_developer_id_fkey FOREIGN KEY (developer_id) REFERENCES public.developers(id) ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict 2V0cO9lYlCvtzoTpfHv9PJXrY0OQLHJDG4M3OAlGPo4biX2NnRSdkmV9K0dUeSZ

--
-- PostgreSQL database dump
--

\restrict F7OVd8KgycN3MwEONldAiQ4vpwAnsIIF3EPPdj8jWtgEOLVH1lSzbWDmUtrXP1u

-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: base_model_catalog; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.base_model_catalog (id, name, category, industry, base_hf_repo, adapter_name, adapter_path, description, default_system_prompt, is_active) VALUES ('skybeak-general-llama3', 'SkyBeak General AI (Llama-3-8B)', 'general', NULL, 'meta-llama/Meta-Llama-3-8B-Instruct', NULL, NULL, 'General-purpose SkyBeak foundation model ready for immediate chat or custom RAG grounding.', 'You are SkyBeak General AI, an accurate and helpful assistant. Answer strictly using the provided RAG context when available.', true);
INSERT INTO public.base_model_catalog (id, name, category, industry, base_hf_repo, adapter_name, adapter_path, description, default_system_prompt, is_active) VALUES ('skybeak-general-qwen25', 'SkyBeak General AI (Qwen-2.5-7B)', 'general', NULL, 'Qwen/Qwen2.5-7B-Instruct', NULL, NULL, 'High-speed general-purpose reasoning and coding model.', 'You are SkyBeak General AI powered by Qwen 2.5. Provide concise, grounded responses.', true);
INSERT INTO public.base_model_catalog (id, name, category, industry, base_hf_repo, adapter_name, adapter_path, description, default_system_prompt, is_active) VALUES ('skybeak-sme-v4', 'SkyBeak SME Daily Business v4', 'industry', 'SME & Daily Business', 'meta-llama/Meta-Llama-3-8B-Instruct', 'sme_v4', './adapters/llama_sme_v4', 'RAG-aware champion model fine-tuned on SME operations, SOPs, invoicing, and daily business workflows (0.8% hallucination rate).', 'You are SkyBeak SME Business AI (v4). Use retrieved company SOPs and database records to provide accurate operational guidance.', true);
INSERT INTO public.base_model_catalog (id, name, category, industry, base_hf_repo, adapter_name, adapter_path, description, default_system_prompt, is_active) VALUES ('skybeak-retail-ecom-mfg-v4', 'SkyBeak Retail, E-Commerce & Manufacturing v4', 'industry', 'Retail, E-commerce & Manufacturing', 'meta-llama/Meta-Llama-3-8B-Instruct', 'retail_ecom_mfg_v4', './adapters/llama_retail_ecom_mfg_v4', 'Specialized in customer order support, returns, inventory lookup, and Lean Six Sigma manufacturing quality controls.', 'You are SkyBeak Retail & Manufacturing AI (v4). Resolve customer inquiries and manufacturing process questions using retrieved knowledge.', true);
INSERT INTO public.base_model_catalog (id, name, category, industry, base_hf_repo, adapter_name, adapter_path, description, default_system_prompt, is_active) VALUES ('skybeak-healthcare-v4', 'SkyBeak Healthcare & Clinical v4', 'industry', 'Healthcare', 'meta-llama/Meta-Llama-3-8B-Instruct', 'healthcare_v4', './adapters/llama_healthcare_v4', 'RAG-aware clinical and healthcare assistant fine-tuned across four controlled sprint iterations.', 'You are SkyBeak Healthcare AI (v4). Provide accurate, context-grounded healthcare information based on connected records and documents.', true);


--
-- PostgreSQL database dump complete
--

\unrestrict F7OVd8KgycN3MwEONldAiQ4vpwAnsIIF3EPPdj8jWtgEOLVH1lSzbWDmUtrXP1u

