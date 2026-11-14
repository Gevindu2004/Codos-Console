"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { ScrollCloudReveal } from "./ScrollCloudReveal";
import {
  KeyRound,
  BrainCircuit,
  Volume2,
  Play,
  Pause,
  Copy,
  Check,
  Zap,
  ArrowUpRight,
  Shield,
  Activity,
  Code2,
  Sliders,
  Sparkles,
  Layers,
  Network,
} from "lucide-react";

interface ServicesSectionProps {
  onSelectService?: (serviceId: "voice" | "api" | "llm") => void;
}

interface TiltCardProps {
  id: string;
  children: React.ReactNode;
  accentColor: string;
  isFocused?: boolean;
}

const Parallax3DServiceCard: React.FC<TiltCardProps> = ({
  id,
  children,
  accentColor,
  isFocused = false,
}) => {
  const cardRef = useRef<HTMLElement | null>(null);
  const [tilt, setTilt] = useState({
    x: 0,
    y: 0,
    glareX: 50,
    glareY: 50,
    hovered: false,
  });

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;
    const rotateY = (relX - 0.5) * 12;
    const rotateX = (0.5 - relY) * 12;
    setTilt({
      x: rotateX,
      y: rotateY,
      glareX: relX * 100,
      glareY: relY * 100,
      hovered: true,
    });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0, glareX: 50, glareY: 50, hovered: false });
  };

  return (
    <article
      ref={cardRef}
      id={id}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: `perspective(1100px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateZ(${
          tilt.hovered || isFocused ? "10px" : "0px"
        })`,
        transformStyle: "preserve-3d",
      }}
      className={`scroll-mt-24 lg:scroll-mt-44 rounded-3xl glass-panel p-5 sm:p-6 flex flex-col justify-between border transition-all duration-300 ease-out relative group overflow-hidden h-full bg-[#0F172A]/80 ${
        isFocused
          ? "border-[#14B8A6] ring-2 ring-[#14B8A6]/40 shadow-[0_24px_60px_rgba(20,184,166,0.22)]"
          : "border-[#F1F5F9]/15 hover:border-[#14B8A6]/60 shadow-[0_20px_50px_rgba(0,0,0,0.45)]"
      }`}
    >
      {/* Dynamic 3D Specular Glare */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-300 z-20"
        style={{
          opacity: tilt.hovered || isFocused ? 1 : 0,
          background: `radial-gradient(circle at ${tilt.glareX}% ${tilt.glareY}%, ${accentColor}, transparent 60%)`,
        }}
      />
      {children}
    </article>
  );
};

export const ServicesSection: React.FC<ServicesSectionProps> = ({
  onSelectService,
}) => {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [selectedModel, setSelectedModel] = useState("claude-3-5-sonnet");
  const [focusedServiceId, setFocusedServiceId] = useState<string | null>(null);

  useEffect(() => {
    const handleHighlight = (e: Event) => {
      const customEvent = e as CustomEvent<string | null>;
      setFocusedServiceId(customEvent.detail || null);
    };
    window.addEventListener("codos:highlight-service", handleHighlight);
    return () =>
      window.removeEventListener("codos:highlight-service", handleHighlight);
  }, []);

  const sampleGreeting =
    "Hello! This is Eleanor from Codos Console. How may I assist your call?";

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleToggleVoiceSample = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setIsPlayingAudio((prev) => !prev);
      return;
    }

    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(sampleGreeting);
    utterance.rate = 0.98;
    utterance.pitch = 1.06;

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice =
      voices.find(
        (v) =>
          v.lang.startsWith("en-GB") &&
          (v.name.includes("Natural") ||
            v.name.includes("Google") ||
            v.name.includes("Libby") ||
            v.name.includes("Sonia") ||
            v.name.includes("Female"))
      ) ||
      voices.find(
        (v) =>
          v.lang.startsWith("en") &&
          (v.name.includes("Natural") ||
            v.name.includes("Google") ||
            v.name.includes("Samantha") ||
            v.name.includes("Victoria") ||
            v.name.includes("Aria"))
      ) ||
      voices.find((v) => v.lang.startsWith("en"));

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => setIsPlayingAudio(true);
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);

    setIsPlayingAudio(true);
    window.speechSynthesis.speak(utterance);
  };

  const sampleCurl = `curl -X POST https://api.viacodos.com/v1/gateway/keys/rotate \\
  -H "Authorization: Bearer $CODOS_ADMIN_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"service":"thumbs_up_api","rate_limit_rpm":60000}'`;

  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <section
      id="services"
      className="relative w-full lg:h-screen lg:max-h-screen min-h-[680px] pt-16 pb-6 px-6 sm:px-10 lg:px-12 flex flex-col justify-between gap-5 overflow-hidden bg-[#0F172A]"
    >
      {/* Ambient Drifting Cloud Horizon Layers Behind Three Core Services */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden z-0"
      >
        <div className="codos-service-cloud-orb codos-service-cloud-orb-1" />
        <div className="codos-service-cloud-orb codos-service-cloud-orb-2" />
        <div className="codos-service-cloud-orb codos-service-cloud-orb-3" />
      </div>

      {/* Compact Top Section Header */}
      <ScrollCloudReveal
        direction="up"
        delayMs={0}
        className="relative z-10 text-center space-y-2 max-w-4xl mx-auto flex-shrink-0"
      >
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#F1F5F9]">
          Three Core Services.{" "}
          <span className="text-[#14B8A6]">One Codos Console.</span>
        </h2>

        <p className="text-xs sm:text-sm text-[#F1F5F9]/70 max-w-2xl mx-auto">
          Every service has its own dedicated identity while sharing a single unified account,
          master API key, and consolidated monthly invoice.
        </p>
      </ScrollCloudReveal>

      {/* Full-Screen Width 3-Column Service Cards Grid */}
      <div className="relative z-10 w-full grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0 items-stretch">
        {/* =========================================
            CARD 01: AI CALL COLLEAGUE (VOICE SERVICE)
           ========================================= */}
        <ScrollCloudReveal
          direction="left"
          delayMs={50}
          className="h-full flex flex-col codos-cloud-float-1"
        >
        <Parallax3DServiceCard
          id="voice-service"
          accentColor="var(--cursor-glare)"
          isFocused={focusedServiceId === "voice-service"}
        >
          <div
            className="space-y-3.5 relative z-10 flex flex-col flex-1 justify-between"
            style={{ transform: "translateZ(20px)" }}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-[#F1F5F9] p-1 shadow-lg border border-[#F1F5F9]/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                    <Image
                      src="/assets/call-colleague-logo.jpg"
                      alt="Call Colleague Official Logo - Autonomous Voice AI"
                      width={56}
                      height={56}
                      className="object-contain w-full h-full scale-105"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#14B8A6] block">
                      Service 01 • Telephony AI
                    </span>
                    <h3 className="text-lg sm:text-xl font-bold text-[#F1F5F9] leading-tight">
                      Call Colleague
                    </h3>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-[#14B8A6] whitespace-nowrap">
                  Sub-80ms Voice
                </span>
              </div>

              <p className="text-xs sm:text-[13px] text-[#F1F5F9]/75 leading-relaxed">
                Deploy autonomous, human-sounding AI voice colleagues that handle inbound support,
                outbound appointment setting, and customer calls over live telephone lines.
              </p>

              <ul className="space-y-1.5 text-xs text-[#F1F5F9]/85">
                <li className="flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-[#14B8A6] flex-shrink-0" />
                  <span>
                    <strong>Instant Telephony Hook:</strong> WebRTC, SIP &amp; Global PSTN ready
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <Volume2 className="w-3.5 h-3.5 text-[#14B8A6] flex-shrink-0" />
                  <span>
                    <strong>Hyper-Realistic Speech:</strong> Natural tone &amp; emotion
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-[#14B8A6] flex-shrink-0" />
                  <span>
                    <strong>Real-Time Interruption:</strong> Zero-pause turn-taking
                  </span>
                </li>
              </ul>
            </div>

            <ScrollCloudReveal direction="up" delayMs={180}>
              <div className="p-3 rounded-2xl bg-[#090E1A]/70 border border-[#F1F5F9]/10 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-[#F1F5F9]">Test Voice Persona</span>
                  <span className="text-[10px] font-mono text-[#14B8A6]">72ms Latency</span>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={handleToggleVoiceSample}
                    className="codos-cta-btn w-9 h-9 rounded-full bg-[#14B8A6] hover:bg-[#0D9488] text-[#0F172A] flex items-center justify-center shadow-md transition-all flex-shrink-0 cursor-pointer"
                    aria-label={isPlayingAudio ? "Stop sample voice" : "Play sample voice"}
                  >
                    {isPlayingAudio ? (
                      <Pause className="w-3.5 h-3.5" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-[#F1F5F9] line-clamp-2">
                      &quot;{sampleGreeting}&quot;
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[10px] text-[#F1F5F9]/50">
                        {isPlayingAudio
                          ? "Speaking 48kHz neural stream..."
                          : "Click play to listen"}
                      </p>
                      {isPlayingAudio && (
                        <div className="flex items-end gap-0.5 h-3">
                          <span className="w-0.5 bg-[#14B8A6] rounded-full wave-bar" style={{ animationDelay: "0ms" }} />
                          <span className="w-0.5 bg-[#14B8A6] rounded-full wave-bar" style={{ animationDelay: "150ms" }} />
                          <span className="w-0.5 bg-[#14B8A6] rounded-full wave-bar" style={{ animationDelay: "300ms" }} />
                          <span className="w-0.5 bg-[#14B8A6] rounded-full wave-bar" style={{ animationDelay: "450ms" }} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </ScrollCloudReveal>
          </div>

          <div
            style={{ transform: "translateZ(24px)" }}
            className="pt-3.5 mt-3.5 border-t border-[#F1F5F9]/10 flex items-center justify-between relative z-10 flex-shrink-0"
          >
            <span className="text-xs font-mono text-[#F1F5F9]/60">
              $0.07 / call minute
            </span>
            <button
              onClick={() => onSelectService && onSelectService("voice")}
              className="inline-flex items-center gap-1.5 text-[#14B8A6] hover:opacity-80 text-xs font-bold transition-all cursor-pointer"
            >
              <span>Manage Colleague</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </Parallax3DServiceCard>
        </ScrollCloudReveal>

        {/* =========================================
            CARD 02: THUMBS UP API (GATEWAY & KEYS)
           ========================================= */}
        <ScrollCloudReveal
          direction="scale"
          delayMs={180}
          className="h-full flex flex-col codos-cloud-float-2"
        >
        <Parallax3DServiceCard
          id="api-service"
          accentColor="var(--cursor-glare)"
          isFocused={focusedServiceId === "api-service"}
        >
          <div
            className="space-y-3.5 relative z-10 flex flex-col flex-1 justify-between"
            style={{ transform: "translateZ(20px)" }}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-[#F1F5F9] p-1 shadow-lg border border-[#F1F5F9]/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                    <Image
                      src="/assets/thumbs-up-api-logo.jpg"
                      alt="Thumbs Up API Official Logo - High Throughput Gateway"
                      width={56}
                      height={56}
                      className="object-contain w-full h-full"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#14B8A6] block">
                      Service 02 • Developer Engine
                    </span>
                    <h3 className="text-lg sm:text-xl font-bold text-[#F1F5F9] leading-tight">
                      Thumbs Up API
                    </h3>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-[#14B8A6] whitespace-nowrap">
                  50k+ req/sec
                </span>
              </div>

              <p className="text-xs sm:text-[13px] text-[#F1F5F9]/75 leading-relaxed">
                Industrial-grade API gateway engineered for ultra-fast routing, zero-trust
                cryptographic key management, rate-limiting, and webhook orchestration.
              </p>

              <ul className="space-y-1.5 text-xs text-[#F1F5F9]/85">
                <li className="flex items-center gap-2">
                  <KeyRound className="w-3.5 h-3.5 text-[#14B8A6] flex-shrink-0" />
                  <span>
                    <strong>Instant Key Generation:</strong> Scoped RBAC &amp; auto-rotation
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-[#14B8A6] flex-shrink-0" />
                  <span>
                    <strong>DDoS &amp; Rate-Limiting:</strong> Token bucket 99.999% SLA
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <Code2 className="w-3.5 h-3.5 text-[#14B8A6] flex-shrink-0" />
                  <span>
                    <strong>Unified SDKs:</strong> TypeScript, Python, Go &amp; cURL
                  </span>
                </li>
              </ul>
            </div>

            <ScrollCloudReveal direction="up" delayMs={300}>
              <div className="p-3 rounded-2xl bg-[#090E1A]/70 border border-[#F1F5F9]/10 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 font-mono text-[#14B8A6]">
                    <span className="px-1.5 py-0.5 rounded bg-[#14B8A6]/20 text-[10px] font-bold">
                      POST
                    </span>
                    <span className="text-[#F1F5F9]/70">/v1/gateway/keys/rotate</span>
                  </div>
                  <button
                    onClick={() => handleCopyCode(sampleCurl)}
                    className="flex items-center gap-1 text-[10px] text-[#F1F5F9]/60 hover:text-[#F1F5F9] cursor-pointer"
                    title="Copy cURL snippet"
                  >
                    {copiedCode ? (
                      <Check className="w-3 h-3 text-[#14B8A6]" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>{copiedCode ? "Copied" : "cURL"}</span>
                  </button>
                </div>

                <pre className="text-[10px] font-mono text-[#F1F5F9]/80 overflow-x-auto p-2 bg-black/40 rounded-lg leading-tight">
                  <code>
                    <span className="tok-keyword">await</span>{" "}
                    <span className="tok-var">codos</span>
                    <span className="tok-punct">.</span>
                    <span className="tok-prop">apiKey</span>
                    <span className="tok-punct">.</span>
                    <span className="tok-fn">create</span>
                    <span className="tok-punct">({"{"}</span>
                    {"\n  "}
                    <span className="tok-prop">scope</span>
                    <span className="tok-punct">: [</span>
                    <span className="tok-string">&quot;voice:write&quot;</span>
                    <span className="tok-punct">, </span>
                    <span className="tok-string">&quot;llm:read&quot;</span>
                    <span className="tok-punct">],</span>
                    {"\n  "}
                    <span className="tok-prop">rateLimit</span>
                    <span className="tok-punct">: </span>
                    <span className="tok-num">10000</span>
                    {"\n"}
                    <span className="tok-punct">{"});"}</span>
                  </code>
                </pre>
              </div>
            </ScrollCloudReveal>
          </div>

          <div
            style={{ transform: "translateZ(24px)" }}
            className="pt-3.5 mt-3.5 border-t border-[#F1F5F9]/10 flex items-center justify-between relative z-10 flex-shrink-0"
          >
            <span className="text-xs font-mono text-[#F1F5F9]/60">
              100k free reqs / month
            </span>
            <button
              onClick={() => onSelectService && onSelectService("api")}
              className="inline-flex items-center gap-1.5 text-[#14B8A6] hover:opacity-80 text-xs font-bold transition-all cursor-pointer"
            >
              <span>Manage API Keys</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </Parallax3DServiceCard>
        </ScrollCloudReveal>

        {/* =========================================
            CARD 03: SKY BEAK LLM (MULTI-MODEL ROUTER)
           ========================================= */}
        <ScrollCloudReveal
          direction="right"
          delayMs={310}
          className="h-full flex flex-col codos-cloud-float-3"
        >
        <Parallax3DServiceCard
          id="llm-service"
          accentColor="var(--cursor-glare)"
          isFocused={focusedServiceId === "llm-service"}
        >
          <div
            className="space-y-3.5 relative z-10 flex flex-col flex-1 justify-between"
            style={{ transform: "translateZ(20px)" }}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-[#F1F5F9] p-1 shadow-lg border border-[#F1F5F9]/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                    <Image
                      src="/assets/sky-beak-llm-logo.jpg"
                      alt="Sky Beak LLM Official Logo - Multi-Model Cloud Intelligence"
                      width={56}
                      height={56}
                      className="object-contain w-full h-full"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#14B8A6] block">
                      Service 03 • AI Orchestration
                    </span>
                    <h3 className="text-lg sm:text-xl font-bold text-[#F1F5F9] leading-tight">
                      Sky Beak LLM
                    </h3>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-[#14B8A6] whitespace-nowrap">
                  Multi-Provider
                </span>
              </div>

              <p className="text-xs sm:text-[13px] text-[#F1F5F9]/75 leading-relaxed">
                Unified abstraction layer that dynamically routes queries across Claude, GPT-4o,
                Gemini, and open-weights models with intelligent failover and prompt caching.
              </p>

              <ul className="space-y-1.5 text-xs text-[#F1F5F9]/85">
                <li className="flex items-center gap-2">
                  <Network className="w-3.5 h-3.5 text-[#14B8A6] flex-shrink-0" />
                  <span>
                    <strong>Zero-Downtime Fallback:</strong> Auto-reroute on rate limits
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#14B8A6] flex-shrink-0" />
                  <span>
                    <strong>Semantic Prompt Cache:</strong> Cut token costs up to 45%
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-[#14B8A6] flex-shrink-0" />
                  <span>
                    <strong>Unified Token Quota:</strong> Centralized team budget caps
                  </span>
                </li>
              </ul>
            </div>

            <ScrollCloudReveal direction="up" delayMs={420}>
              <div className="p-3 rounded-2xl bg-[#090E1A]/70 border border-[#F1F5F9]/10 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-[#F1F5F9]">Dynamic Routing Matrix</span>
                  <span className="text-[10px] text-[#14B8A6] font-mono">Auto-Failover Active</span>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: "claude-3-5-sonnet", name: "Claude 3.5", cost: "$3/M" },
                    { id: "gpt-4o", name: "GPT-4o", cost: "$2.5/M" },
                    { id: "gemini-1-5-pro", name: "Gemini 1.5", cost: "$1.25/M" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedModel(m.id)}
                      className={`p-1.5 rounded-lg text-left border transition-all cursor-pointer ${
                        selectedModel === m.id
                          ? "codos-cta-btn bg-[#14B8A6]/20 border-[#14B8A6] text-[#F1F5F9]"
                          : "bg-[#F1F5F9]/5 border-transparent text-[#F1F5F9]/70 hover:bg-[#F1F5F9]/10"
                      }`}
                    >
                      <div className="text-[10px] font-bold truncate">{m.name}</div>
                      <div className="text-[9px] opacity-75">{m.cost}</div>
                    </button>
                  ))}
                </div>
              </div>
            </ScrollCloudReveal>
          </div>

          <div
            style={{ transform: "translateZ(24px)" }}
            className="pt-3.5 mt-3.5 border-t border-[#F1F5F9]/10 flex items-center justify-between relative z-10 flex-shrink-0"
          >
            <span className="text-xs font-mono text-[#F1F5F9]/60">
              40+ LLMs supported
            </span>
            <button
              onClick={() => onSelectService && onSelectService("llm")}
              className="inline-flex items-center gap-1.5 text-[#14B8A6] hover:opacity-80 text-xs font-bold transition-all cursor-pointer"
            >
              <span>Open Sky Beak LLM</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </Parallax3DServiceCard>
        </ScrollCloudReveal>
      </div>
    </section>
  );
};
