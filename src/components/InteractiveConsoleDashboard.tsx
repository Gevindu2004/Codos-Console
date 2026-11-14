"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { ViaCodosLogo } from "./ViaCodosLogo";
import { SkyBeakAiWorkspace, SkyBeakSubView } from "./SkyBeakAiWorkspace";
import { CallColleagueWorkspace } from "./CallColleagueWorkspace";
import {
  LayoutDashboard,
  PhoneCall,
  KeyRound,
  BrainCircuit,
  BarChart3,
  CreditCard,
  Plus,
  Play,
  Copy,
  Check,
  ShieldCheck,
  Zap,
  Activity,
  Trash2,
  PhoneForwarded,
  ArrowRight,
  Sparkles,
  Sun,
  Moon,
  Search,
  Code2,
  Terminal,
  Layers,
  Building2,
  MessageSquare,
  UploadCloud,
} from "lucide-react";

interface InteractiveConsoleDashboardProps {
  initialTab?: "overview" | "voice" | "api" | "llm" | "analytics" | "billing";
  onReturnToLanding?: () => void;
}

interface ApiEndpointItem {
  id: string;
  category: "voice" | "gateway" | "llm" | "billing";
  categoryLabel: string;
  name: string;
  method: "POST" | "GET" | "WSS" | "DELETE";
  path: string;
  description: string;
  scope: string;
  latency: string;
  rateLimit: string;
  version: string;
  sampleRequest: string;
  sampleResponse: string;
}

const CATEGORIZED_API_CATALOG: ApiEndpointItem[] = [
  // Category 1: Call Colleague & Voice Telephony APIs
  {
    id: "voice-dispatch",
    category: "voice",
    categoryLabel: "Call Colleague & Telephony APIs",
    name: "Dispatch Autonomous Voice Colleague",
    method: "POST",
    path: "/v1/voice/colleague/dispatch",
    description:
      "Initiates an outbound or inbound SIP/PSTN call handled by a low-latency AI Call Colleague persona with custom context.",
    scope: "voice:dispatch",
    latency: "72ms",
    rateLimit: "10,000 req/s",
    version: "v1.4",
    sampleRequest: `{
  "recipient_phone": "+15550198273",
  "persona": "eleanor_executive",
  "sip_trunk_id": "trunk_us_east_01",
  "record_call": true
}`,
    sampleResponse: `{
  "status": 200,
  "session_id": "call_col_98f2a10b",
  "state": "connected",
  "edge_latency_ms": 72
}`,
  },
  {
    id: "voice-stream",
    category: "voice",
    categoryLabel: "Call Colleague & Telephony APIs",
    name: "Bi-Directional Neural Audio Stream",
    method: "WSS",
    path: "wss://stream.viacodos.com/v1/voice/realtime",
    description:
      "Full-duplex 48kHz WebRTC & WebSocket audio stream with sub-80ms turn-taking and automatic barge-in interruption handling.",
    scope: "voice:stream",
    latency: "38ms",
    rateLimit: "25,000 concurrent",
    version: "v1.4",
    sampleRequest: `{
  "event": "media.stream.start",
  "codec": "pcm_48000",
  "vad_sensitivity": 0.85
}`,
    sampleResponse: `{
  "event": "media.stream.ack",
  "stream_id": "strm_77c190a",
  "jitter_buffer_ms": 12
}`,
  },
  {
    id: "voice-transcripts",
    category: "voice",
    categoryLabel: "Call Colleague & Telephony APIs",
    name: "Fetch Call Transcript & Sentiment",
    method: "GET",
    path: "/v1/voice/calls/{session_id}/transcript",
    description:
      "Retrieves speaker-diarized call transcriptions, CSAT sentiment scores, and structured action items extracted post-call.",
    scope: "voice:read",
    latency: "19ms",
    rateLimit: "30,000 req/s",
    version: "v1.2",
    sampleRequest: `GET /v1/voice/calls/call_col_98f2a10b/transcript`,
    sampleResponse: `{
  "session_id": "call_col_98f2a10b",
  "duration_sec": 142,
  "csat_score": 0.99,
  "resolution": "appointment_confirmed"
}`,
  },

  // Category 2: Thumbs Up API Gateway & Security APIs
  {
    id: "gateway-rotate",
    category: "gateway",
    categoryLabel: "Thumbs Up Gateway & Security APIs",
    name: "Zero-Downtime Cryptographic Key Rotation",
    method: "POST",
    path: "/v1/gateway/keys/rotate",
    description:
      "Atomically rotates master or scoped API keys with configurable grace windows and fine-grained RBAC permission scopes.",
    scope: "api:admin",
    latency: "11ms",
    rateLimit: "50,000 req/s",
    version: "v1.5",
    sampleRequest: `{
  "key_id": "key_prod_99f4",
  "grace_period_seconds": 3600,
  "scopes": ["voice:dispatch", "api:all", "llm:route"]
}`,
    sampleResponse: `{
  "status": "rotated",
  "new_key_prefix": "${
    process.env.NEXT_PUBLIC_CODOS_ROTATED_KEY_PREFIX ||
    "$NEXT_PUBLIC_CODOS_ROTATED_KEY_PREFIX"
  }",
  "old_key_expires_in": 3600
}`,
  },
  {
    id: "gateway-ratelimit",
    category: "gateway",
    categoryLabel: "Thumbs Up Gateway & Security APIs",
    name: "Configure Token-Bucket Rate Limiter",
    method: "POST",
    path: "/v1/gateway/policies/ratelimit",
    description:
      "Enforces edge DDoS protection, burst quotas, and per-tenant token bucket throttling across 38 global edge PoPs.",
    scope: "api:write",
    latency: "9ms",
    rateLimit: "50,000 req/s",
    version: "v1.5",
    sampleRequest: `{
  "service": "thumbs_up_api",
  "requests_per_second": 50000,
  "burst_capacity": 75000,
  "action_on_exceed": "queue_or_429"
}`,
    sampleResponse: `{
  "policy_id": "pol_edge_5501",
  "propagated_pops": 38,
  "active": true
}`,
  },
  {
    id: "gateway-webhooks",
    category: "gateway",
    categoryLabel: "Thumbs Up Gateway & Security APIs",
    name: "Register Signed Webhook Endpoint",
    method: "POST",
    path: "/v1/gateway/webhooks/endpoints",
    description:
      "Subscribes an HTTPS URL to real-time voice, gateway, and LLM lifecycle events with HMAC-SHA256 replay protection.",
    scope: "api:webhooks",
    latency: "14ms",
    rateLimit: "25,000 req/s",
    version: "v1.3",
    sampleRequest: `{
  "url": "https://api.enterprise.com/webhooks/codos",
  "events": ["call.completed", "llm.failover", "key.rotated"],
  "signing_alg": "hmac-sha256"
}`,
    sampleResponse: `{
  "webhook_id": "wh_live_309a",
  "signing_secret": "whsec_codos_991a8f...",
  "verified": true
}`,
  },
  {
    id: "gateway-revoke",
    category: "gateway",
    categoryLabel: "Thumbs Up Gateway & Security APIs",
    name: "Instant API Key Revocation",
    method: "DELETE",
    path: "/v1/gateway/keys/{key_id}",
    description:
      "Immediately invalidates a compromised or retired API key across all global edge caches in under 50 milliseconds.",
    scope: "api:admin",
    latency: "8ms",
    rateLimit: "50,000 req/s",
    version: "v1.5",
    sampleRequest: `DELETE /v1/gateway/keys/key_stg_11a8`,
    sampleResponse: `{
  "revoked": true,
  "key_id": "key_stg_11a8",
  "edge_purge_ms": 18
}`,
  },

  // Category 3: Sky Beak LLM & Smart Routing APIs
  {
    id: "llm-completions",
    category: "llm",
    categoryLabel: "Sky Beak LLM & Smart Routing APIs",
    name: "Unified Multi-Model Chat Completion",
    method: "POST",
    path: "/v1/llm/chat/completions",
    description:
      "Routes prompts across Claude 3.5 Sonnet, GPT-4o, Gemini 1.5 Pro, and Llama 3.3 with automatic zero-downtime failover.",
    scope: "llm:route",
    latency: "142ms",
    rateLimit: "40,000 req/s",
    version: "v1.6",
    sampleRequest: `{
  "primary_model": "claude-3-5-sonnet",
  "fallback_models": ["gpt-4o", "gemini-1-5-pro"],
  "routing_strategy": "lowest-latency",
  "semantic_cache": true,
  "messages": [{ "role": "user", "content": "Summarize incident #402" }]
}`,
    sampleResponse: `{
  "id": "skybeak_cmpl_8821",
  "routed_model": "claude-3-5-sonnet",
  "cache_hit": true,
  "tokens_saved": 410,
  "latency_ms": 62
}`,
  },
  {
    id: "llm-embeddings",
    category: "llm",
    categoryLabel: "Sky Beak LLM & Smart Routing APIs",
    name: "High-Dimensional Vector Embeddings",
    method: "POST",
    path: "/v1/llm/embeddings",
    description:
      "Generates normalized 1536 or 3072-dimension embeddings for RAG knowledge bases and real-time Call Colleague memory lookup.",
    scope: "llm:read",
    latency: "28ms",
    rateLimit: "60,000 req/s",
    version: "v1.4",
    sampleRequest: `{
  "model": "sky-beak-embed-v3",
  "dimensions": 1536,
  "input": "Enterprise SLA refund & escalation policy"
}`,
    sampleResponse: `{
  "object": "list",
  "dimensions": 1536,
  "embedding_preview": [0.0214, -0.0481, 0.0912, "..."],
  "latency_ms": 28
}`,
  },
  {
    id: "llm-cache",
    category: "llm",
    categoryLabel: "Sky Beak LLM & Smart Routing APIs",
    name: "Semantic Prompt Cache Analytics",
    method: "GET",
    path: "/v1/llm/cache/metrics",
    description:
      "Returns real-time semantic cache hit ratios, token cost reductions, and similarity thresholds across your organization.",
    scope: "llm:read",
    latency: "12ms",
    rateLimit: "50,000 req/s",
    version: "v1.4",
    sampleRequest: `GET /v1/llm/cache/metrics?window=24h`,
    sampleResponse: `{
  "cache_hit_ratio": 0.442,
  "tokens_cached_24h": "6.18M",
  "estimated_savings_usd": 184.50
}`,
  },

  // Category 4: Telemetry & Unified Billing APIs
  {
    id: "billing-usage",
    category: "billing",
    categoryLabel: "Telemetry & Unified Billing APIs",
    name: "Consolidated Cross-Service Usage Metering",
    method: "GET",
    path: "/v1/billing/usage/unified",
    description:
      "Aggregates Call Colleague minutes, Thumbs Up API request volume, and Sky Beak LLM token spend under a single master account.",
    scope: "billing:read",
    latency: "15ms",
    rateLimit: "20,000 req/s",
    version: "v1.2",
    sampleRequest: `GET /v1/billing/usage/unified?period=2026-11`,
    sampleResponse: `{
  "account_id": "org_viacodos_ent",
  "voice_minutes": 1840,
  "api_requests": 2840000,
  "llm_tokens": 14200000,
  "total_spend_usd": 380.40
}`,
  },
  {
    id: "billing-alerts",
    category: "billing",
    categoryLabel: "Telemetry & Unified Billing APIs",
    name: "Set Unified Quota & Spend Guardrails",
    method: "POST",
    path: "/v1/billing/quotas/guardrails",
    description:
      "Configures automated budget caps and Slack/webhook alerts across voice, API gateway, and LLM services to prevent overages.",
    scope: "billing:write",
    latency: "16ms",
    rateLimit: "10,000 req/s",
    version: "v1.2",
    sampleRequest: `{
  "monthly_cap_usd": 2500.00,
  "soft_alert_threshold": 0.80,
  "auto_throttle_non_critical": true
}`,
    sampleResponse: `{
  "guardrail_id": "grd_9012",
  "status": "armed",
  "current_utilization": 0.152
}`,
  },
];

export const InteractiveConsoleDashboard: React.FC<
  InteractiveConsoleDashboardProps
> = ({ initialTab = "overview", onReturnToLanding }) => {
  const [activeTab, setActiveTab] = useState<
    "overview" | "voice" | "api" | "llm" | "analytics" | "billing"
  >(initialTab);
  const [skyBeakSubView, setSkyBeakSubView] =
    useState<SkyBeakSubView>("models");
  const [isLightTheme, setIsLightTheme] = useState(false);

  // Categorized API Services Filter State
  const [selectedApiCategory, setSelectedApiCategory] = useState<
    "all" | "voice" | "gateway" | "llm" | "billing"
  >("all");
  const [selectedHttpMethod, setSelectedHttpMethod] = useState<
    "ALL" | "POST" | "GET" | "WSS" | "DELETE"
  >("ALL");
  const [apiSearchQuery, setApiSearchQuery] = useState("");
  const [expandedApiId, setExpandedApiId] = useState<string | null>(
    "gateway-rotate"
  );
  const [copiedEndpointId, setCopiedEndpointId] = useState<string | null>(null);
  const [testedEndpointId, setTestedEndpointId] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    const checkTheme = () => {
      setIsLightTheme(
        document.documentElement.getAttribute("data-theme") === "light"
      );
    };
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  const toggleTheme = () => {
    const nextTheme = isLightTheme ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("codos-theme", nextTheme);
  };

  // API Key management state (loaded from .env)
  const [apiKeys, setApiKeys] = useState([
    {
      id: "key-1",
      name: "Production Webhook Key",
      prefix:
        process.env.NEXT_PUBLIC_CODOS_PROD_KEY_PREFIX ||
        "$NEXT_PUBLIC_CODOS_PROD_KEY_PREFIX",
      created: "2026-11-01",
      scopes: ["voice:dispatch", "api:all", "llm:route"],
      status: "active",
    },
    {
      id: "key-2",
      name: "Staging Test Key",
      prefix:
        process.env.NEXT_PUBLIC_CODOS_STAGING_KEY_PREFIX ||
        "$NEXT_PUBLIC_CODOS_STAGING_KEY_PREFIX",
      created: "2026-11-10",
      scopes: ["voice:read", "api:read", "llm:read"],
      status: "active",
    },
  ]);
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyScope, setNewKeyScope] = useState("all");
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // Live Test Call State
  const [dialerNumber, setDialerNumber] = useState("+1 (555) 234-8900");
  const [isCalling, setIsCalling] = useState(false);
  const [callStatus, setCallStatus] = useState<string | null>(null);

  // LLM Playground State
  const [playgroundPrompt, setPlaygroundPrompt] = useState(
    "Analyze incoming customer support transcription and route appropriate resolution."
  );
  const [llmOutput, setLlmOutput] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateKey = () => {
    if (!newKeyName.trim()) return;
    const keyPrefix =
      process.env.NEXT_PUBLIC_CODOS_GENERATED_KEY_PREFIX || "codos_env_key";
    const newKey = {
      id: `key-${Date.now()}`,
      name: newKeyName,
      prefix: `${keyPrefix}_${Math.random()
        .toString(36)
        .substring(2, 8)}...${Math.random().toString(36).substring(2, 6)}`,
      created: "2026-11-14",
      scopes:
        newKeyScope === "all"
          ? ["voice:all", "api:all", "llm:all"]
          : ["api:read"],
      status: "active",
    };
    setApiKeys([newKey, ...apiKeys]);
    setNewKeyName("");
    setShowNewKeyModal(false);
  };

  const handleCopyKey = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const handleCopyEndpoint = (id: string, path: string) => {
    navigator.clipboard.writeText(`https://api.viacodos.com${path}`);
    setCopiedEndpointId(id);
    setTimeout(() => setCopiedEndpointId(null), 2000);
  };

  const handleSimulateEndpoint = (id: string) => {
    setTestedEndpointId(id);
    setTimeout(() => setTestedEndpointId(null), 3000);
  };

  const handleDeleteKey = (id: string) => {
    setApiKeys(apiKeys.filter((k) => k.id !== id));
  };

  const handleTriggerTestCall = () => {
    setIsCalling(true);
    setCallStatus("Dialing SIP trunk via AI Call Colleague...");
    setTimeout(() => {
      setCallStatus("Connected! Eleanor AI Voice Colleague is speaking.");
    }, 1500);
    setTimeout(() => {
      setIsCalling(false);
      setCallStatus("Call completed cleanly • Duration: 0:42 • Latency: 78ms");
    }, 6000);
  };

  const handleRunPlayground = () => {
    setIsGenerating(true);
    setLlmOutput(null);
    setTimeout(() => {
      setIsGenerating(false);
      setLlmOutput(
        JSON.stringify(
          {
            routed_model: "claude-3-5-sonnet",
            cache_hit: true,
            cost_savings: "42%",
            latency_ms: 182,
            intent: "billing_inquiry_high_priority",
            suggested_action: "dispatch_voice_colleague_followup",
          },
          null,
          2
        )
      );
    }, 1000);
  };

  // Filtered API Catalog
  const filteredApis = CATEGORIZED_API_CATALOG.filter((api) => {
    const matchesCategory =
      selectedApiCategory === "all" || api.category === selectedApiCategory;
    const matchesMethod =
      selectedHttpMethod === "ALL" || api.method === selectedHttpMethod;
    const q = apiSearchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      api.name.toLowerCase().includes(q) ||
      api.path.toLowerCase().includes(q) ||
      api.description.toLowerCase().includes(q) ||
      api.scope.toLowerCase().includes(q);
    return matchesCategory && matchesMethod && matchesSearch;
  });

  const apiCategories = [
    {
      id: "all" as const,
      label: "All API Services",
      count: CATEGORIZED_API_CATALOG.length,
      icon: Layers,
      desc: "Complete unified catalog across Voice, Gateway, LLM & Billing",
    },
    {
      id: "voice" as const,
      label: "Call Colleague Voice APIs",
      count: CATEGORIZED_API_CATALOG.filter((a) => a.category === "voice")
        .length,
      icon: PhoneCall,
      desc: "SIP trunking, outbound AI voice dispatch, and real-time audio streams",
    },
    {
      id: "gateway" as const,
      label: "Thumbs Up Gateway APIs",
      count: CATEGORIZED_API_CATALOG.filter((a) => a.category === "gateway")
        .length,
      icon: KeyRound,
      desc: "Zero-trust cryptographic keys, rate limiting, and signed webhooks",
    },
    {
      id: "llm" as const,
      label: "Sky Beak LLM APIs",
      count: CATEGORIZED_API_CATALOG.filter((a) => a.category === "llm").length,
      icon: BrainCircuit,
      desc: "Multi-model chat completions, vector embeddings, and semantic cache",
    },
    {
      id: "billing" as const,
      label: "Telemetry & Billing APIs",
      count: CATEGORIZED_API_CATALOG.filter((a) => a.category === "billing")
        .length,
      icon: CreditCard,
      desc: "Cross-service usage metering, spend guardrails, and invoices",
    },
  ];

  const groupedCategoriesToDisplay =
    selectedApiCategory === "all"
      ? (["voice", "gateway", "llm", "billing"] as const)
      : ([selectedApiCategory] as const);

  return (
    <div
      className={`codos-dashboard min-h-screen flex flex-col antialiased transition-colors duration-300 ${
        isLightTheme
          ? "bg-[#FFFFFF] text-[#0B0B0C]"
          : "bg-[#0F172A] text-[#F1F5F9]"
      }`}
    >
      {/* Top Header Bar */}
      <header
        className={`h-16 border-b px-4 sm:px-6 flex items-center justify-between backdrop-blur-md sticky top-0 z-40 transition-colors duration-300 ${
          isLightTheme
            ? "bg-[#FFFFFF] border-[#0B0B0C]/12"
            : "bg-[#090E1A]/95 border-[#F1F5F9]/12"
        }`}
      >
        <div className="flex items-center gap-4">
          <ViaCodosLogo size="sm" />
          <div className="hidden md:flex items-center gap-2 pl-4 border-l border-[#F1F5F9]/15">
            <span className="text-xs font-semibold text-[#F1F5F9]/75">
              Organization:
            </span>
            <span
              className={`text-xs font-bold px-2.5 py-0.5 rounded-md ${
                isLightTheme
                  ? "bg-[#14213D]/10 text-[#14213D]"
                  : "bg-[#F1F5F9]/10 text-[#F1F5F9]"
              }`}
            >
              Via Codos Enterprise
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* System status pill */}
          <div
            className={`hidden sm:flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono border ${
              isLightTheme
                ? "bg-[#14213D]/10 text-[#14213D] border-[#14213D]/25 font-semibold"
                : "bg-[#14B8A6]/15 text-[#14B8A6] border-[#14B8A6]/30"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full animate-pulse ${
                isLightTheme ? "bg-[#14213D]" : "bg-[#14B8A6]"
              }`}
            />
            <span>99.99% Operational</span>
          </div>

          {/* Credits Balance */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full glass-panel text-xs">
            <CreditCard className="w-3.5 h-3.5 text-[#14B8A6]" />
            <span className="text-[#F1F5F9]/70">Credits:</span>
            <span className="font-bold text-[#F1F5F9]">$4,820.00</span>
          </div>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            title={
              isLightTheme ? "Switch to Dark Theme" : "Switch to Light Theme"
            }
            className="codos-cta-btn w-8 h-8 rounded-full bg-[#14B8A6] text-[#0F172A] flex items-center justify-center shadow transition-all cursor-pointer"
            aria-label="Toggle Light/Dark Theme"
          >
            {isLightTheme ? (
              <Moon className="w-4 h-4" />
            ) : (
              <Sun className="w-4 h-4" />
            )}
          </button>

          {onReturnToLanding && (
            <button
              onClick={onReturnToLanding}
              className="codos-cta-btn px-3.5 py-1.5 rounded-full bg-[#14B8A6] text-[#0F172A] text-xs font-bold transition-all cursor-pointer"
            >
              Exit to Landing
            </button>
          )}

          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-md ${
              isLightTheme
                ? "bg-[#14213D] !text-[#FFFFFF]"
                : "bg-[#14B8A6] text-[#0F172A]"
            }`}
          >
            VC
          </div>
        </div>
      </header>

      {/* Main Body with Sidebar + Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <aside
          className={`w-64 border-r hidden md:flex flex-col justify-between p-4 flex-shrink-0 transition-colors duration-300 ${
            isLightTheme
              ? "bg-[#FFFFFF] border-[#0B0B0C]/12"
              : "bg-[#090E1A] border-[#F1F5F9]/10"
          }`}
        >
          <div className="space-y-5">
            <div
              className={`text-[11px] font-bold uppercase tracking-wider px-3 ${
                isLightTheme ? "text-[#0B0B0C]/60" : "text-[#F1F5F9]/50"
              }`}
            >
              Platform Services
            </div>

            <nav className="space-y-1.5">
              {[
                {
                  id: "overview",
                  label: "Dashboard Overview",
                  icon: LayoutDashboard,
                  badge: null,
                },
                {
                  id: "voice",
                  label: "Call Colleague",
                  icon: PhoneCall,
                  badge: "Live",
                },
                {
                  id: "api",
                  label: "Thumbs Up API",
                  icon: KeyRound,
                  badge: "12 APIs",
                },
                {
                  id: "llm",
                  label: "SkyBeak AI Models",
                  icon: BrainCircuit,
                  badge: "Multi",
                },
                {
                  id: "analytics",
                  label: "Observability & Metrics",
                  icon: BarChart3,
                  badge: null,
                },
                {
                  id: "billing",
                  label: "Unified Invoices",
                  icon: CreditCard,
                  badge: null,
                },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() =>
                      setActiveTab(
                        item.id as
                          | "overview"
                          | "voice"
                          | "api"
                          | "llm"
                          | "analytics"
                          | "billing"
                      )
                    }
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all text-left cursor-pointer ${
                      isActive
                        ? "codos-cta-btn bg-[#14B8A6] text-[#0F172A] shadow-md"
                        : isLightTheme
                        ? "text-[#0B0B0C]/80 hover:bg-[#14213D]/10 hover:text-[#14213D]"
                        : "text-[#F1F5F9]/75 hover:bg-[#F1F5F9]/10 hover:text-[#F1F5F9]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon
                        className={`w-4 h-4 ${
                          isActive
                            ? ""
                            : isLightTheme
                            ? "text-[#14213D]"
                            : "text-[#14B8A6]"
                        }`}
                      />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${
                          isActive
                            ? "bg-black/20 !text-[#FFFFFF]"
                            : isLightTheme
                            ? "bg-[#14213D]/12 text-[#14213D]"
                            : "bg-[#F1F5F9]/10 text-[#F1F5F9]/85"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Bottom account info */}
          <div className="p-3.5 rounded-2xl glass-panel space-y-1.5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#14B8A6]" />
              <span className="text-[11px] font-bold text-[#F1F5F9]">
                Enterprise Tier
              </span>
            </div>
            <p className="text-[10px] text-[#F1F5F9]/70 leading-tight">
              Single account governing all 3 Codos Console services.
            </p>
          </div>
        </aside>

        {/* Right Dashboard Workspace */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-8">
          {/* Mobile Tab Navigation */}
          <div className="md:hidden flex gap-2 overflow-x-auto pb-2">
            {[
              { id: "overview", label: "Overview" },
              { id: "voice", label: "Call Colleague" },
              { id: "api", label: "Thumbs Up API" },
              { id: "llm", label: "Sky Beak LLM" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() =>
                  setActiveTab(t.id as "overview" | "voice" | "api" | "llm")
                }
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer ${
                  activeTab === t.id
                    ? "codos-cta-btn bg-[#14B8A6] text-[#0F172A]"
                    : "glass-panel text-[#F1F5F9]/80"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ========================================================
              VIEW 1: OVERVIEW TAB
             ======================================================== */}
          {activeTab === "overview" && (
            <div className="space-y-8 animate-in fade-in duration-200">
              {/* Header */}
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-[#F1F5F9]">
                  Codos Console Overview
                </h1>
                <p className="text-xs sm:text-sm text-[#F1F5F9]/75 mt-1">
                  Real-time status of your subscribed voice agents, API gateways, and Sky Beak LLM instances.
                </p>
              </div>

              {/* 4 Key Metrics Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl glass-panel border border-[#F1F5F9]/12 space-y-2">
                  <div className="flex items-center justify-between text-xs text-[#F1F5F9]/75 font-medium">
                    <span>Active Voice Calls</span>
                    <PhoneCall className="w-4 h-4 text-[#14B8A6]" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-[#F1F5F9]">
                    38
                  </div>
                  <div className="text-[11px] text-[#14B8A6] font-medium flex items-center gap-1">
                    <span>↑ 14% vs last hour</span>
                    <span className="text-[#F1F5F9]/40">•</span>
                    <span>72ms latency</span>
                  </div>
                </div>

                <div className="p-5 rounded-2xl glass-panel border border-[#F1F5F9]/12 space-y-2">
                  <div className="flex items-center justify-between text-xs text-[#F1F5F9]/75 font-medium">
                    <span>Thumbs Up API Reqs</span>
                    <KeyRound className="w-4 h-4 text-[#14B8A6]" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-[#F1F5F9]">
                    2.84M
                  </div>
                  <div className="text-[11px] text-[#14B8A6] font-medium flex items-center gap-1">
                    <span>99.998% Success</span>
                    <span className="text-[#F1F5F9]/40">•</span>
                    <span>14ms edge</span>
                  </div>
                </div>

                <div className="p-5 rounded-2xl glass-panel border border-[#F1F5F9]/12 space-y-2">
                  <div className="flex items-center justify-between text-xs text-[#F1F5F9]/75 font-medium">
                    <span>Sky Beak LLM Tokens</span>
                    <BrainCircuit className="w-4 h-4 text-[#14B8A6]" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-[#F1F5F9]">
                    14.2M
                  </div>
                  <div className="text-[11px] text-[#14B8A6] font-medium flex items-center gap-1">
                    <span>42% Prompt Cached</span>
                    <span className="text-[#F1F5F9]/40">•</span>
                    <span>-$48.20 saved</span>
                  </div>
                </div>

                <div className="p-5 rounded-2xl glass-panel border border-[#F1F5F9]/12 space-y-2">
                  <div className="flex items-center justify-between text-xs text-[#F1F5F9]/75 font-medium">
                    <span>Monthly Consolidated Spend</span>
                    <CreditCard className="w-4 h-4 text-[#14B8A6]" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-[#F1F5F9]">
                    $380.40
                  </div>
                  <div className="text-[11px] text-[#F1F5F9]/70 font-medium">
                    Budget: $2,500.00 (15.2% utilized)
                  </div>
                </div>
              </div>

              {/* Subscribed Services Management Grid */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-[#F1F5F9]">
                    Subscribed Platform Services
                  </h2>
                  <span className="text-xs font-semibold text-[#14B8A6]">
                    3 of 3 Active
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Service 1 Box */}
                  <div className="p-5 rounded-2xl glass-panel border border-[#F1F5F9]/12 space-y-4 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-white p-1 overflow-hidden shadow border border-black/10">
                            <Image
                              src="/assets/call-colleague-logo.jpg"
                              alt="Call Colleague Logo"
                              width={40}
                              height={40}
                              className="object-contain w-full h-full"
                            />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-[#F1F5F9]">
                              Call Colleague
                            </h3>
                            <span className="text-[10px] text-[#14B8A6] font-mono font-semibold">
                              4 Agents Provisioned
                            </span>
                          </div>
                        </div>
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            isLightTheme ? "bg-[#14213D]" : "bg-[#14B8A6]"
                          }`}
                        />
                      </div>
                      <p className="text-xs text-[#F1F5F9]/75 leading-relaxed">
                        Autonomous voice telephony agent handling inbound support and outbound scheduling.
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab("voice")}
                      className="codos-cta-btn w-full py-2.5 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] text-[#0F172A] text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>Configure Voice Colleague</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Service 2 Box */}
                  <div className="p-5 rounded-2xl glass-panel border border-[#F1F5F9]/12 space-y-4 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-white p-1 overflow-hidden shadow border border-black/10">
                            <Image
                              src="/assets/thumbs-up-api-logo.jpg"
                              alt="Thumbs Up API Logo"
                              width={40}
                              height={40}
                              className="object-contain w-full h-full"
                            />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-[#F1F5F9]">
                              Thumbs Up API
                            </h3>
                            <span className="text-[10px] text-[#14B8A6] font-mono font-semibold">
                              12 Categorized APIs • {apiKeys.length} Keys
                            </span>
                          </div>
                        </div>
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            isLightTheme ? "bg-[#14213D]" : "bg-[#14B8A6]"
                          }`}
                        />
                      </div>
                      <p className="text-xs text-[#F1F5F9]/75 leading-relaxed">
                        High-throughput secure developer API gateway, categorized REST/WSS endpoints &amp; rate limiting.
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab("api")}
                      className="codos-cta-btn w-full py-2.5 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] text-[#0F172A] text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>Open API Services Catalog</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Service 3 Box */}
                  <div className="p-5 rounded-2xl glass-panel border border-[#F1F5F9]/12 space-y-4 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-white p-1 overflow-hidden shadow border border-black/10">
                            <Image
                              src="/assets/sky-beak-llm-logo.jpg"
                              alt="Sky Beak LLM Logo"
                              width={40}
                              height={40}
                              className="object-contain w-full h-full"
                            />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-[#F1F5F9]">
                              Sky Beak LLM
                            </h3>
                            <span className="text-[10px] text-[#14B8A6] font-mono font-semibold">
                              Multi-Model Active
                            </span>
                          </div>
                        </div>
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            isLightTheme ? "bg-[#14213D]" : "bg-[#14B8A6]"
                          }`}
                        />
                      </div>
                      <p className="text-xs text-[#F1F5F9]/75 leading-relaxed">
                        Dynamic prompt routing across Claude, GPT-4o, and Gemini with auto-failover.
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab("llm")}
                      className="codos-cta-btn w-full py-2.5 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] text-[#0F172A] text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>Open Sky Beak LLM</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Live Request Stream / Real-Time Audit Log */}
              <div className="rounded-2xl glass-panel p-5 border border-[#F1F5F9]/12 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#14B8A6]" />
                    <h3 className="text-sm font-bold text-[#F1F5F9]">
                      Live Unified Stream
                    </h3>
                  </div>
                  <span className="text-[10px] text-[#F1F5F9]/60 font-mono">
                    Auto-refreshing • WebSocket connected
                  </span>
                </div>

                <div className="space-y-2 font-mono text-xs">
                  <div
                    className={`p-2.5 rounded-xl flex items-center justify-between border ${
                      isLightTheme
                        ? "bg-[#FFFFFF] border-[#0B0B0C]/12 text-[#0B0B0C]"
                        : "bg-black/40 border-white/5 text-[#F1F5F9]/85"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[#14B8A6] font-bold">[200 OK]</span>
                      <span className="font-semibold">POST</span>
                      <span>/v1/voice/colleague/dispatch</span>
                    </div>
                    <span className="text-[#F1F5F9]/60 text-[10px]">
                      14ms • US-East
                    </span>
                  </div>

                  <div
                    className={`p-2.5 rounded-xl flex items-center justify-between border ${
                      isLightTheme
                        ? "bg-[#FFFFFF] border-[#0B0B0C]/12 text-[#0B0B0C]"
                        : "bg-black/40 border-white/5 text-[#F1F5F9]/85"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[#14B8A6] font-bold">
                        [CACHE HIT]
                      </span>
                      <span className="font-semibold">Sky Beak LLM</span>
                      <span>claude-3-5-sonnet → cached response</span>
                    </div>
                    <span className="text-[#F1F5F9]/60 text-[10px]">
                      62ms • -45% cost
                    </span>
                  </div>

                  <div
                    className={`p-2.5 rounded-xl flex items-center justify-between border ${
                      isLightTheme
                        ? "bg-[#FFFFFF] border-[#0B0B0C]/12 text-[#0B0B0C]"
                        : "bg-black/40 border-white/5 text-[#F1F5F9]/85"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[#14B8A6] font-bold">
                        [CALL CONNECT]
                      </span>
                      <span className="font-semibold">Call Colleague</span>
                      <span>Inbound SIP Trunk #420-CODO • Eleanor persona</span>
                    </div>
                    <span className="text-[#F1F5F9]/60 text-[10px]">
                      72ms • 99.4% CSAT
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              VIEW 2: AI CALL COLLEAGUE SERVICE TAB
             ======================================================== */}
          {activeTab === "voice" && (
            <CallColleagueWorkspace isLightTheme={isLightTheme} />
          )}

          {/* ========================================================
              VIEW 3: API SERVICES INTERFACE WITH CATEGORIZED LISTINGS
             ======================================================== */}
          {activeTab === "api" && (
            <div className="space-y-8 animate-in fade-in duration-200">
              {/* Top Header & Create Key CTA */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 text-[#14B8A6] text-xs font-semibold mb-1.5">
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Thumbs Up API Gateway • Categorized API Services</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-[#F1F5F9]">
                    API Services &amp; Categorized Directory
                  </h1>
                  <p className="text-xs sm:text-sm text-[#F1F5F9]/75 mt-1">
                    Explore, filter, and test categorized REST &amp; WebSocket APIs across Call Colleague, Thumbs Up Gateway, Sky Beak LLM, and Unified Billing.
                  </p>
                </div>

                <button
                  onClick={() => setShowNewKeyModal(true)}
                  className="codos-cta-btn px-4 py-2.5 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] text-[#0F172A] text-xs font-bold flex items-center gap-1.5 shadow-lg transition-all cursor-pointer self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create API Key</span>
                </button>
              </div>

              {/* Category Cards Selector Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {apiCategories.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = selectedApiCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedApiCategory(cat.id)}
                      className={`p-4 rounded-2xl text-left transition-all cursor-pointer border flex flex-col justify-between gap-2.5 ${
                        isSelected
                          ? "codos-cta-btn bg-[#14B8A6] text-[#0F172A] border-[#14B8A6] shadow-lg"
                          : "glass-panel border-[#F1F5F9]/12 hover:border-[#14B8A6]/50"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <Icon
                          className={`w-4 h-4 ${
                            isSelected ? "" : "text-[#14B8A6]"
                          }`}
                        />
                        <span className="text-[11px] font-mono font-bold">
                          {cat.count} APIs
                        </span>
                      </div>
                      <div>
                        <div className="text-xs font-bold leading-snug">
                          {cat.label}
                        </div>
                        <p
                          className={`text-[10px] mt-1 line-clamp-2 leading-relaxed ${
                            isSelected ? "opacity-85" : "text-[#F1F5F9]/65"
                          }`}
                        >
                          {cat.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Search & HTTP Method Filter Bar */}
              <div className="p-4 rounded-2xl glass-panel border border-[#F1F5F9]/12 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-[#F1F5F9]/50 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search APIs by endpoint path (/v1/voice...), name, or scope..."
                    value={apiSearchQuery}
                    onChange={(e) => setApiSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-black/40 border border-[#F1F5F9]/15 text-xs text-[#F1F5F9] outline-none"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto">
                  {(["ALL", "POST", "GET", "WSS", "DELETE"] as const).map(
                    (method) => (
                      <button
                        key={method}
                        onClick={() => setSelectedHttpMethod(method)}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer ${
                          selectedHttpMethod === method
                            ? "codos-cta-btn bg-[#14B8A6] text-[#0F172A]"
                            : "text-[#F1F5F9]/70 hover:text-[#F1F5F9] bg-[#F1F5F9]/5"
                        }`}
                      >
                        {method}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Categorized API Endpoint Listings */}
              <div className="space-y-8">
                {groupedCategoriesToDisplay.map((catKey) => {
                  const categoryEndpoints = filteredApis.filter(
                    (api) => api.category === catKey
                  );
                  if (categoryEndpoints.length === 0) return null;

                  const categoryMeta = apiCategories.find(
                    (c) => c.id === catKey
                  );
                  const CatIcon = categoryMeta?.icon || Code2;

                  return (
                    <div key={catKey} className="space-y-3.5">
                      {/* Category Section Header */}
                      <div className="flex items-center justify-between border-b border-[#F1F5F9]/12 pb-2.5">
                        <div className="flex items-center gap-2.5">
                          <CatIcon className="w-4 h-4 text-[#14B8A6]" />
                          <h2 className="text-base font-bold text-[#F1F5F9]">
                            {categoryEndpoints[0].categoryLabel}
                          </h2>
                          <span className="text-xs font-mono font-semibold text-[#14B8A6]">
                            ({categoryEndpoints.length})
                          </span>
                        </div>
                        <span className="text-[11px] text-[#F1F5F9]/60 hidden sm:inline">
                          Base URL: <code className="font-mono">https://api.viacodos.com</code>
                        </span>
                      </div>

                      {/* Endpoints List inside this Category */}
                      <div className="grid grid-cols-1 gap-3.5">
                        {categoryEndpoints.map((api) => {
                          const isExpanded = expandedApiId === api.id;
                          const isCopied = copiedEndpointId === api.id;
                          const isTested = testedEndpointId === api.id;

                          return (
                            <div
                              key={api.id}
                              className="rounded-2xl glass-panel border border-[#F1F5F9]/12 hover:border-[#14B8A6]/45 transition-all overflow-hidden"
                            >
                              {/* Endpoint Summary Row */}
                              <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                <div className="space-y-1.5 flex-1">
                                  <div className="flex flex-wrap items-center gap-2.5">
                                    <span className="text-[11px] font-mono font-extrabold text-[#14B8A6]">
                                      {api.method}
                                    </span>
                                    <code className="text-xs sm:text-sm font-mono font-bold text-[#F1F5F9]">
                                      {api.path}
                                    </code>
                                    <button
                                      onClick={() =>
                                        handleCopyEndpoint(api.id, api.path)
                                      }
                                      className="inline-flex items-center gap-1 text-[10px] font-mono text-[#F1F5F9]/60 hover:text-[#14B8A6] cursor-pointer"
                                      title="Copy full endpoint URL"
                                    >
                                      {isCopied ? (
                                        <Check className="w-3 h-3 text-[#14B8A6]" />
                                      ) : (
                                        <Copy className="w-3 h-3" />
                                      )}
                                      <span>{isCopied ? "Copied" : "Copy"}</span>
                                    </button>
                                    <span className="text-[10px] font-mono text-[#F1F5F9]/50">
                                      {api.version}
                                    </span>
                                  </div>

                                  <h3 className="text-sm font-bold text-[#F1F5F9]">
                                    {api.name}
                                  </h3>
                                  <p className="text-xs text-[#F1F5F9]/75 leading-relaxed max-w-3xl">
                                    {api.description}
                                  </p>
                                </div>

                                {/* Right Metadata & Inspect Button */}
                                <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 lg:gap-5 justify-between lg:justify-end border-t lg:border-t-0 pt-3 lg:pt-0 border-[#F1F5F9]/10">
                                  <div className="flex items-center gap-4 text-[11px] font-mono">
                                    <div>
                                      <span className="text-[#F1F5F9]/55 block text-[10px]">
                                        Scope
                                      </span>
                                      <span className="font-bold text-[#14B8A6]">
                                        {api.scope}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-[#F1F5F9]/55 block text-[10px]">
                                        Avg Latency
                                      </span>
                                      <span className="font-bold text-[#F1F5F9]">
                                        {api.latency}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-[#F1F5F9]/55 block text-[10px]">
                                        Rate Limit
                                      </span>
                                      <span className="font-bold text-[#F1F5F9]">
                                        {api.rateLimit}
                                      </span>
                                    </div>
                                  </div>

                                  <button
                                    onClick={() =>
                                      setExpandedApiId(
                                        isExpanded ? null : api.id
                                      )
                                    }
                                    className="codos-cta-btn px-3.5 py-2 rounded-xl bg-[#14B8A6] text-[#0F172A] text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
                                  >
                                    {isExpanded
                                      ? "Hide Inspector"
                                      : "Inspect & Test"}
                                  </button>
                                </div>
                              </div>

                              {/* Expandable Request / Response Payload Inspector */}
                              {isExpanded && (
                                <div className="px-4 sm:px-5 pb-5 pt-3 border-t border-[#F1F5F9]/10 space-y-4 animate-in fade-in duration-150">
                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                      <div className="flex items-center justify-between text-[11px] font-mono">
                                        <span className="font-bold text-[#F1F5F9]">
                                          Request Payload / Query
                                        </span>
                                        <span className="text-[#14B8A6]">
                                          application/json
                                        </span>
                                      </div>
                                      <pre className="p-3.5 rounded-xl bg-black/40 border border-[#F1F5F9]/12 text-[11px] font-mono text-[#F1F5F9] overflow-x-auto leading-relaxed">
                                        <code>{api.sampleRequest}</code>
                                      </pre>
                                    </div>

                                    <div className="space-y-1.5">
                                      <div className="flex items-center justify-between text-[11px] font-mono">
                                        <span className="font-bold text-[#F1F5F9]">
                                          200 OK Sample Response
                                        </span>
                                        <span className="text-[#14B8A6]">
                                          Edge Verified ({api.latency})
                                        </span>
                                      </div>
                                      <pre className="p-3.5 rounded-xl bg-black/40 border border-[#F1F5F9]/12 text-[11px] font-mono text-[#F1F5F9] overflow-x-auto leading-relaxed">
                                        <code>{api.sampleResponse}</code>
                                      </pre>
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                                    <span className="text-[11px] font-mono text-[#F1F5F9]/65">
                                      Auth Header:{" "}
                                      <code>
                                        Authorization: Bearer{" "}
                                        {apiKeys[0]?.prefix || "codos_live_..."}
                                      </code>
                                    </span>

                                    <div className="flex items-center gap-3">
                                      {isTested && (
                                        <span className="text-xs font-mono font-bold text-[#14B8A6]">
                                          ✓ 200 OK • Response received in{" "}
                                          {api.latency}
                                        </span>
                                      )}
                                      <button
                                        onClick={() =>
                                          handleSimulateEndpoint(api.id)
                                        }
                                        className="codos-cta-btn px-4 py-2 rounded-xl bg-[#14B8A6] text-[#0F172A] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                                      >
                                        <Terminal className="w-3.5 h-3.5" />
                                        <span>Send Live Test Request</span>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Active API Keys Table */}
              <div className="rounded-2xl glass-panel border border-[#F1F5F9]/12 overflow-hidden">
                <div className="px-6 py-4 border-b border-[#F1F5F9]/10 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-[#F1F5F9]">
                    Active Thumbs Up API Keys
                  </h2>
                  <span className="text-xs text-[#F1F5F9]/65">
                    {apiKeys.length} keys provisioned
                  </span>
                </div>

                <div className="divide-y divide-[#F1F5F9]/10">
                  {apiKeys.map((key) => (
                    <div
                      key={key.id}
                      className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#14B8A6]/5 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#F1F5F9]">
                            {key.name}
                          </span>
                          <span className="text-[10px] font-mono font-bold text-[#14B8A6]">
                            {key.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-mono text-[#F1F5F9]/75">
                          <span>{key.prefix}</span>
                          <button
                            onClick={() => handleCopyKey(key.id, key.prefix)}
                            className="p-1 text-[#14B8A6] cursor-pointer"
                            title="Copy key"
                          >
                            {copiedKeyId === key.id ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-[#F1F5F9]/55 pt-0.5">
                          <span>Created {key.created}</span>
                          <span>•</span>
                          <span>Scopes: {key.scopes.join(", ")}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDeleteKey(key.id)}
                          className="p-2 rounded-lg hover:bg-red-500/15 text-red-500 text-xs transition-colors cursor-pointer"
                          title="Revoke Key"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              VIEW 4: SKYBEAK AI SUITE (MODELS, INDUSTRY, CHATBOT & CUSTOM TRAINING)
             ======================================================== */}
          {activeTab === "llm" && (
            <SkyBeakAiWorkspace
              key={skyBeakSubView}
              initialSubView={skyBeakSubView}
              isLightTheme={isLightTheme}
              onOpenApiCatalog={() => {
                setSelectedApiCategory("llm");
                setActiveTab("api");
              }}
            />
          )}

          {/* Fallback for analytics or billing tabs */}
          {(activeTab === "analytics" || activeTab === "billing") && (
            <div className="p-12 rounded-3xl glass-panel text-center space-y-4">
              <CreditCard className="w-10 h-10 text-[#14B8A6] mx-auto" />
              <h2 className="text-xl font-bold text-[#F1F5F9]">
                {activeTab === "analytics"
                  ? "Observability & Metrics"
                  : "Unified Invoices & Billing"}
              </h2>
              <p className="text-xs text-[#F1F5F9]/75 max-w-md mx-auto">
                Consolidated billing statements, real-time telemetry, and audit logs are accessible via the unified Codos Console account.
              </p>
              <button
                onClick={() => setActiveTab("overview")}
                className="codos-cta-btn px-4 py-2 rounded-xl bg-[#14B8A6] text-[#0F172A] text-xs font-bold cursor-pointer"
              >
                Return to Overview
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Modal: Create API Key */}
      {showNewKeyModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl glass-panel bg-[#0F172A] border border-[#F1F5F9]/20 p-6 space-y-5 animate-in zoom-in-95 duration-200">
            <h2 className="text-base font-bold text-[#F1F5F9]">
              Create Thumbs Up API Key
            </h2>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-[#F1F5F9]/75">
                  Key Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Production Webhook Key"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-[#F1F5F9]/15 text-xs text-[#F1F5F9] outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-[#F1F5F9]/75">
                  Permissions
                </label>
                <select
                  value={newKeyScope}
                  onChange={(e) => setNewKeyScope(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#0F172A] border border-[#F1F5F9]/15 text-xs text-[#F1F5F9] outline-none"
                >
                  <option value="all">Full Access (Voice, API, LLM)</option>
                  <option value="voice">Voice Only</option>
                  <option value="api">API Gateway Only</option>
                  <option value="llm">Sky Beak LLM Only</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowNewKeyModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#F1F5F9]/75 hover:bg-[#14B8A6]/10 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateKey}
                className="codos-cta-btn px-4 py-2 rounded-xl bg-[#14B8A6] text-[#0F172A] text-xs font-bold cursor-pointer"
              >
                Generate Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
