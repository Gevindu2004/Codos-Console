"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { ViaCodosLogo } from "./ViaCodosLogo";
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
} from "lucide-react";

interface InteractiveConsoleDashboardProps {
  onReturnToLanding?: () => void;
}

export const InteractiveConsoleDashboard: React.FC<
  InteractiveConsoleDashboardProps
> = ({ onReturnToLanding }) => {
  const [activeTab, setActiveTab] = useState<
    "overview" | "voice" | "api" | "llm" | "analytics" | "billing"
  >("overview");
  const [isLightTheme, setIsLightTheme] = useState(false);

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

  // API Key management state
  const [apiKeys, setApiKeys] = useState([
    {
      id: "key-1",
      name: "Production Webhook Key",
      prefix: "codos_live_prod_99f4...28a1",
      created: "2026-11-01",
      scopes: ["voice:dispatch", "api:all", "llm:route"],
      status: "active",
    },
    {
      id: "key-2",
      name: "Staging Test Key",
      prefix: "codos_test_stg_11a8...99d4",
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
    const newKey = {
      id: `key-${Date.now()}`,
      name: newKeyName,
      prefix: `codos_live_${Math.random().toString(36).substring(2, 8)}...${Math.random()
        .toString(36)
        .substring(2, 6)}`,
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
            title={isLightTheme ? "Switch to Dark Theme" : "Switch to Light Theme"}
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
                  badge: "50k/s",
                },
                {
                  id: "llm",
                  label: "Sky Beak LLM",
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
                              {apiKeys.length} Active API Keys
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
                        High-throughput secure developer API gateway, cryptographic signing &amp; rate limiting.
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab("api")}
                      className="codos-cta-btn w-full py-2.5 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] text-[#0F172A] text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>Manage API Gateway</span>
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
            <div className="space-y-8 animate-in fade-in duration-200">
              <div className="flex items-start justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-[#14B8A6]/15 text-[#14B8A6] border border-[#14B8A6]/35 text-xs font-semibold mb-2">
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>Telephony &amp; Conversational AI</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-[#F1F5F9]">
                    Call Colleague Studio
                  </h1>
                  <p className="text-xs sm:text-sm text-[#F1F5F9]/75 mt-1">
                    Manage autonomous voice agents, connect telephony SIP trunks, and test real-time speech.
                  </p>
                </div>
              </div>

              {/* Test Call Interactive Dialer */}
              <div className="p-6 rounded-2xl glass-panel border border-[#14B8A6]/35 space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-[#F1F5F9] flex items-center gap-2">
                    <Zap className="w-4 h-4 text-[#14B8A6]" />
                    <span>Live Test Call Simulator</span>
                  </h2>
                  <span className="text-xs font-mono font-semibold text-[#14B8A6]">
                    WebRTC &amp; SIP Ready
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[#F1F5F9]/75">
                      Recipient Phone Number
                    </label>
                    <input
                      type="text"
                      value={dialerNumber}
                      onChange={(e) => setDialerNumber(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-[#F1F5F9]/15 text-xs font-mono text-[#F1F5F9] outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[#F1F5F9]/75">
                      Voice Persona
                    </label>
                    <select className="w-full px-3.5 py-2 rounded-xl bg-[#0F172A] border border-[#F1F5F9]/15 text-xs text-[#F1F5F9] outline-none">
                      <option>Eleanor - Executive Support (Natural British)</option>
                      <option>Marcus - Technical Specialist (Clear US)</option>
                      <option>Aria - Warm Concierge (Empathetic)</option>
                    </select>
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={handleTriggerTestCall}
                      disabled={isCalling}
                      className="codos-cta-btn w-full py-2.5 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] text-[#0F172A] text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                    >
                      <PhoneForwarded className="w-4 h-4" />
                      <span>
                        {isCalling ? "Dialing..." : "Simulate Outbound Call"}
                      </span>
                    </button>
                  </div>
                </div>

                {callStatus && (
                  <div className="p-3 rounded-xl bg-black/40 border border-[#F1F5F9]/15 text-xs font-mono text-[#14B8A6] font-semibold flex items-center gap-2 animate-in fade-in">
                    <span
                      className={`w-2 h-2 rounded-full animate-pulse ${
                        isLightTheme ? "bg-[#14213D]" : "bg-[#14B8A6]"
                      }`}
                    />
                    <span>{callStatus}</span>
                  </div>
                )}
              </div>

              {/* Deployed Colleague List */}
              <div className="space-y-4">
                <h2 className="text-base font-bold text-[#F1F5F9]">
                  Active Call Colleagues
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    {
                      name: "Colleague #01 - Inbound Reception",
                      persona: "Eleanor (Receptionist)",
                      handled: "1,420 calls",
                      latency: "72ms",
                      csat: "99.2%",
                    },
                    {
                      name: "Colleague #02 - VIP Incident Response",
                      persona: "Marcus (Technical)",
                      handled: "348 calls",
                      latency: "79ms",
                      csat: "98.8%",
                    },
                  ].map((agent, i) => (
                    <div
                      key={i}
                      className="p-5 rounded-2xl glass-panel border border-[#F1F5F9]/12 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-[#14B8A6]/15 flex items-center justify-center text-[#14B8A6]">
                            <PhoneCall className="w-4 h-4" />
                          </div>
                          <div>
                            <h3 className="text-xs font-bold text-[#F1F5F9]">
                              {agent.name}
                            </h3>
                            <p className="text-[10px] text-[#F1F5F9]/65">
                              {agent.persona}
                            </p>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#14B8A6]/15 text-[#14B8A6]">
                          Active
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#F1F5F9]/10 text-[11px]">
                        <div>
                          <span className="text-[#F1F5F9]/60 block">
                            Calls Handled
                          </span>
                          <span className="font-bold text-[#F1F5F9]">
                            {agent.handled}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#F1F5F9]/60 block">
                            Avg Latency
                          </span>
                          <span className="font-bold text-[#14B8A6]">
                            {agent.latency}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#F1F5F9]/60 block">
                            CSAT Score
                          </span>
                          <span className="font-bold text-[#14B8A6]">
                            {agent.csat}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              VIEW 3: THUMBS UP API GATEWAY TAB
             ======================================================== */}
          {activeTab === "api" && (
            <div className="space-y-8 animate-in fade-in duration-200">
              <div className="flex items-start justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-[#14B8A6]/15 text-[#14B8A6] border border-[#14B8A6]/35 text-xs font-semibold mb-2">
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Developer Gateway &amp; Keys</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-[#F1F5F9]">
                    Thumbs Up API Gateway
                  </h1>
                  <p className="text-xs sm:text-sm text-[#F1F5F9]/75 mt-1">
                    Generate cryptographically signed API keys, set rate limits, and inspect real-time request metrics.
                  </p>
                </div>

                <button
                  onClick={() => setShowNewKeyModal(true)}
                  className="codos-cta-btn px-4 py-2 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] text-[#0F172A] text-xs font-bold flex items-center gap-1.5 shadow-lg transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create API Key</span>
                </button>
              </div>

              {/* API Keys Table */}
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
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-[#14B8A6]/15 text-[#14B8A6]">
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

              {/* Endpoint Health & Rate Limits */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl glass-panel border border-[#F1F5F9]/12 space-y-1.5">
                  <span className="text-[10px] font-mono font-bold text-[#14B8A6]">
                    POST /v1/voice/colleague
                  </span>
                  <div className="text-lg font-bold font-mono text-[#F1F5F9]">
                    18ms
                  </div>
                  <p className="text-[11px] font-medium text-[#14B8A6]">
                    100% Availability
                  </p>
                </div>
                <div className="p-4 rounded-xl glass-panel border border-[#F1F5F9]/12 space-y-1.5">
                  <span className="text-[10px] font-mono font-bold text-[#14B8A6]">
                    POST /v1/llm/route
                  </span>
                  <div className="text-lg font-bold font-mono text-[#F1F5F9]">
                    142ms
                  </div>
                  <p className="text-[11px] font-medium text-[#14B8A6]">
                    100% Availability
                  </p>
                </div>
                <div className="p-4 rounded-xl glass-panel border border-[#F1F5F9]/12 space-y-1.5">
                  <span className="text-[10px] font-mono font-bold text-[#14B8A6]">
                    GET /v1/gateway/metrics
                  </span>
                  <div className="text-lg font-bold font-mono text-[#F1F5F9]">
                    9ms
                  </div>
                  <p className="text-[11px] font-medium text-[#14B8A6]">
                    100% Availability
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              VIEW 4: SKY BEAK LLM STUDIO TAB
             ======================================================== */}
          {activeTab === "llm" && (
            <div className="space-y-8 animate-in fade-in duration-200">
              <div className="flex items-start justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-[#14B8A6]/15 text-[#14B8A6] border border-[#14B8A6]/35 text-xs font-semibold mb-2">
                    <BrainCircuit className="w-3.5 h-3.5" />
                    <span>Multi-Model AI Router</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-[#F1F5F9]">
                    Sky Beak LLM &amp; Smart Router
                  </h1>
                  <p className="text-xs sm:text-sm text-[#F1F5F9]/75 mt-1">
                    Route prompts dynamically between Claude, GPT-4o, and Gemini with auto-fallback and prompt caching.
                  </p>
                </div>
              </div>

              {/* Interactive Prompt Tester */}
              <div className="p-6 rounded-2xl glass-panel border border-[#14B8A6]/35 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-[#F1F5F9] flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#14B8A6]" />
                    <span>Prompt Router Playground</span>
                  </h2>
                  <span className="text-xs text-[#F1F5F9]/65">
                    Primary: Claude 3.5 Sonnet • Fallback: GPT-4o
                  </span>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#F1F5F9]/75">
                    Test Prompt
                  </label>
                  <textarea
                    rows={3}
                    value={playgroundPrompt}
                    onChange={(e) => setPlaygroundPrompt(e.target.value)}
                    className="w-full p-3 rounded-xl bg-black/40 border border-[#F1F5F9]/15 text-xs font-mono text-[#F1F5F9] outline-none"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#F1F5F9]/65 font-mono">
                    Estimated tokens: ~45 • Cache savings: 42%
                  </span>
                  <button
                    onClick={handleRunPlayground}
                    disabled={isGenerating}
                    className="codos-cta-btn px-5 py-2 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] text-[#0F172A] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{isGenerating ? "Routing..." : "Run Test Prompt"}</span>
                  </button>
                </div>

                {llmOutput && (
                  <div className="p-4 rounded-xl bg-black/40 border border-[#14B8A6]/35 space-y-2 animate-in fade-in">
                    <span className="text-[10px] uppercase font-bold text-[#14B8A6]">
                      Live Router Response
                    </span>
                    <pre className="text-xs font-mono text-[#F1F5F9] overflow-x-auto">
                      <code>{llmOutput}</code>
                    </pre>
                  </div>
                )}
              </div>
            </div>
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
