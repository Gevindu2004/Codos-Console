"use client";

import React, { useState, useEffect, useRef } from "react";
import { ScrollCloudReveal } from "./ScrollCloudReveal";
import {
  MapPin,
  Home,
  Clock,
  Lock,
  Sparkles,
  Check,
  ArrowUpRight,
  ArrowRight,
} from "lucide-react";

interface HeroSectionProps {
  onOpenDashboard?: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onOpenDashboard }) => {
  const heroRef = useRef<HTMLElement | null>(null);

  // Smooth 3D Parallax state (normalized -1 to 1)
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [scrollY, setScrollY] = useState(0);
  const [activeBottomIndex, setActiveBottomIndex] = useState(0);
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

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    if (!heroRef.current) return;
    const rect = heroRef.current.getBoundingClientRect();
    const normX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const normY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    setMouse({ x: normX, y: normY });
  };

  const handleMouseLeave = () => {
    setMouse({ x: 0, y: 0 });
  };

  const bottomFeatures = [
    {
      icon: Home,
      line1: "Three core AI services",
      line2: "on one unified console",
    },
    {
      icon: Clock,
      line1: "Sub-80ms voice latency",
      line2: "from global edge nodes",
    },
    {
      icon: Lock,
      line1: "Single API key,",
      line2: "any service, any time",
    },
    {
      icon: Sparkles,
      line1: "AI Call Colleague",
      line2: "ready on every trunk",
    },
    {
      icon: Check,
      line1: "Consolidated billing",
      line2: "up to 40% cost savings",
    },
  ];

  return (
    <section
      ref={heroRef}
      id="overview"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ perspective: "1400px" }}
      className={`relative h-screen min-h-[640px] max-h-screen w-full flex flex-col justify-between pt-20 pb-5 overflow-hidden select-none transition-colors duration-500 ${
        isLightTheme ? "bg-[#F4EDE0]" : "bg-[#0F172A]"
      }`}
    >
      {/* =====================================================================
          LAYER 1: 3D PARALLAX ATMOSPHERIC GLOW ORBS
          Dark Theme: #0F172A Primary + #14B8A6 Secondary + #F1F5F9
          Light Theme: #F4EDE0 Cream Primary + #14B8A6 Secondary + #F1F5F9
         ===================================================================== */}
      <div
        className="absolute inset-0 pointer-events-none transition-transform duration-500 ease-out"
        style={{
          transform: `translate3d(${mouse.x * -26}px, ${
            mouse.y * -22 + scrollY * 0.15
          }px, -80px) scale(1.08)`,
        }}
      >
        {/* Ambient Primary Base */}
        <div
          className={`absolute inset-0 transition-colors duration-500 ${
            isLightTheme
              ? "bg-gradient-to-br from-[#F4EDE0] via-[#EFE6D5] to-[#F4EDE0]"
              : "bg-gradient-to-br from-[#090E1A] via-[#0F172A] to-[#0B1120]"
          }`}
        />

        {/* Center-right glow behind the fluted glass: Rich Navy (#14213D) in Light Theme, Teal (#14B8A6) in Dark Theme */}
        <div
          className="absolute top-[10%] left-[32%] w-[600px] h-[600px] rounded-full opacity-95 blur-[95px]"
          style={{
            background: isLightTheme
              ? "radial-gradient(circle, #14213D 0%, rgba(20,33,61,0.88) 40%, rgba(20,33,61,0.45) 68%, transparent 100%)"
              : "radial-gradient(circle, #14B8A6 0%, rgba(20,184,166,0.65) 38%, rgba(13,148,136,0.25) 68%, transparent 100%)",
          }}
        />

        {/* Core glow */}
        <div
          className="absolute top-[22%] left-[42%] w-[380px] h-[380px] rounded-full opacity-85 blur-[80px]"
          style={{
            background: isLightTheme
              ? "radial-gradient(circle, #14213D 0%, rgba(20,33,61,0.75) 55%, transparent 100%)"
              : "radial-gradient(circle, #F1F5F9 0%, rgba(20,184,166,0.38) 55%, transparent 100%)",
          }}
        />

        {/* Left highlight */}
        <div
          className="absolute -top-[10%] left-[4%] w-[480px] h-[600px] rounded-full opacity-45 blur-[105px]"
          style={{
            background: isLightTheme
              ? "radial-gradient(ellipse, #F1F5F9 0%, #F4EDE0 65%, transparent 100%)"
              : "radial-gradient(ellipse, rgba(241,245,249,0.28) 0%, #0F172A 65%, transparent 100%)",
          }}
        />
      </div>

      {/* =====================================================================
          LAYER 2: VERTICAL FLUTED / REEDED GLASS COLUMNS (PARALLAX MIDGROUND)
         ===================================================================== */}
      <div
        className="absolute inset-0 pointer-events-none transition-transform duration-300 ease-out"
        style={{
          transform: `translate3d(${mouse.x * 8}px, ${scrollY * 0.05}px, 0px)`,
          backgroundImage: isLightTheme
            ? `
            repeating-linear-gradient(
              90deg,
              rgba(241, 245, 249, 0.24) 0px,
              rgba(244, 237, 224, 0.08) 3px,
              rgba(20, 33, 61, 0.14) 7px,
              rgba(244, 237, 224, 0.1) 11px,
              rgba(241, 245, 249, 0.24) 14px
            )
          `
            : `
            repeating-linear-gradient(
              90deg,
              rgba(241, 245, 249, 0.055) 0px,
              rgba(241, 245, 249, 0.015) 3px,
              rgba(9, 14, 26, 0.34) 7px,
              rgba(15, 23, 42, 0.14) 11px,
              rgba(241, 245, 249, 0.055) 14px
            )
          `,
        }}
      />

      {/* Subtle bottom vignette for crisp text legibility */}
      <div
        className={`absolute inset-x-0 bottom-0 h-52 bg-gradient-to-t pointer-events-none ${
          isLightTheme
            ? "from-[#F4EDE0]/95 via-[#F4EDE0]/40 to-transparent"
            : "from-[#0F172A]/95 via-[#0F172A]/40 to-transparent"
        }`}
      />

      {/* =====================================================================
          MAIN FULL-SCREEN STAGE (UPPER-RIGHT 3D CARD + LOWER HEADLINE & CTAs)
         ===================================================================== */}
      <div className="relative z-20 flex-1 w-full px-6 sm:px-10 lg:px-12 flex flex-col justify-end pb-5">
        {/* UPPER-RIGHT FLOATING 3D PARALLAX FROSTED GLASS CARD */}
        <ScrollCloudReveal
          direction="right"
          delayMs={120}
          className="w-full flex justify-end lg:absolute lg:top-2 lg:right-12 lg:w-auto mb-4 lg:mb-0"
        >
          <div
            style={{
              transform: `perspective(1100px) rotateX(${
                mouse.y * -9
              }deg) rotateY(${mouse.x * 11}deg) translate3d(${
                mouse.x * 14
              }px, ${mouse.y * 10 - scrollY * 0.06}px, 40px)`,
              transformStyle: "preserve-3d",
            }}
            className={`w-full sm:w-[395px] max-w-full rounded-[24px] backdrop-blur-2xl border p-4 transition-transform duration-200 ease-out ${
              isLightTheme
                ? "bg-[#F1F5F9]/80 border-[#0F172A]/[0.14] shadow-[0_24px_60px_rgba(15,23,42,0.12),inset_0_1px_1px_rgba(255,255,255,0.8)]"
                : "bg-[#0F172A]/65 border-[#F1F5F9]/[0.18] shadow-[0_28px_70px_rgba(0,0,0,0.55),inset_0_1px_1px_rgba(241,245,249,0.22)]"
            }`}
          >
            {/* Dynamic 3D Specular Glare Overlay */}
            <div
              className="absolute inset-0 rounded-[24px] pointer-events-none transition-opacity duration-300"
              style={{
                background: `radial-gradient(circle at ${
                  50 + mouse.x * 40
                }% ${50 + mouse.y * 40}%, ${
                  isLightTheme ? "rgba(20,33,61,0.16)" : "rgba(20,184,166,0.18)"
                }, transparent 60%)`,
              }}
            />

            {/* Top pill handle bar */}
            <div
              className={`w-8 h-1 rounded-full mx-auto mb-2.5 shadow-sm ${
                isLightTheme ? "bg-[#0B0B0C]/40" : "bg-[#F1F5F9]/90"
              }`}
            />

            {/* Location / Platform status header */}
            <div
              style={{ transform: "translateZ(18px)" }}
              className="flex items-center gap-1.5 text-[11px] font-medium text-[#F1F5F9]/85 mb-2.5 px-1"
            >
              <MapPin
                className={`w-3.5 h-3.5 stroke-[2] ${
                  isLightTheme ? "text-[#14213D]" : "text-[#14B8A6]"
                }`}
              />
              <span>Via Codos Cloud, three unified services</span>
            </div>

            {/* Inner Sub-Card 1: Call Colleague */}
            <div
              onClick={onOpenDashboard}
              style={{ transform: "translateZ(26px)" }}
              className={`rounded-xl border px-4 py-3 mb-2.5 transition-all duration-300 cursor-pointer shadow-sm group ${
                isLightTheme
                  ? "bg-[#F4EDE0]/75 hover:bg-[#F4EDE0] border-[#0B0B0C]/10"
                  : "bg-[#F1F5F9]/[0.07] hover:bg-[#F1F5F9]/[0.12] border-[#F1F5F9]/[0.14]"
              }`}
            >
              <div className="flex items-center justify-between text-[11px] mb-1.5">
                <span className="font-semibold text-[#F1F5F9] group-hover:text-[#14B8A6] transition-colors">
                  Call Colleague
                </span>
                <span className="text-[#F1F5F9]/75 font-medium">4.99 rating</span>
              </div>

              <div className="flex items-center justify-between text-[10px] text-[#F1F5F9]/60 mb-1">
                <span>Voice latency</span>
                <span>Uptime SLA</span>
              </div>

              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                <span className="text-[17px] font-semibold text-[#F1F5F9] tracking-tight text-left whitespace-nowrap">
                  72 ms
                </span>
                <span
                  className={`w-[82px] text-center py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${
                    isLightTheme
                      ? "bg-[#14213D]/12 border border-[#14213D]/35 text-[#14213D]"
                      : "bg-[#14B8A6]/20 border border-[#14B8A6]/40 text-[#14B8A6]"
                  }`}
                >
                  24/7 live
                </span>
                <span className="text-[17px] font-semibold text-[#F1F5F9] tracking-tight text-right whitespace-nowrap">
                  99.9%
                </span>
              </div>
            </div>

            {/* Inner Sub-Card 2: Thumbs Up API & Sky Beak LLM */}
            <div
              onClick={onOpenDashboard}
              style={{ transform: "translateZ(26px)" }}
              className={`rounded-xl border px-4 py-3 mb-3 transition-all duration-300 cursor-pointer shadow-sm group ${
                isLightTheme
                  ? "bg-[#F4EDE0]/75 hover:bg-[#F4EDE0] border-[#0B0B0C]/10"
                  : "bg-[#F1F5F9]/[0.07] hover:bg-[#F1F5F9]/[0.12] border-[#F1F5F9]/[0.14]"
              }`}
            >
              <div className="flex items-center justify-between text-[11px] mb-1.5">
                <span className="font-semibold text-[#F1F5F9] group-hover:text-[#14B8A6] transition-colors">
                  Thumbs Up API &amp; Sky Beak
                </span>
                <span className="text-[#F1F5F9]/75 font-medium">4.97 rating</span>
              </div>

              <div className="flex items-center justify-between text-[10px] text-[#F1F5F9]/60 mb-1">
                <span>API Gateway</span>
                <span>Sky Beak LLM</span>
              </div>

              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                <span className="text-[17px] font-semibold text-[#F1F5F9] tracking-tight text-left whitespace-nowrap">
                  50k/s
                </span>
                <span
                  className={`w-[82px] text-center py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${
                    isLightTheme
                      ? "bg-[#14213D]/12 border border-[#14213D]/35 text-[#14213D]"
                      : "bg-[#14B8A6]/20 border border-[#14B8A6]/40 text-[#14B8A6]"
                  }`}
                >
                  1 account
                </span>
                <span className="text-[17px] font-semibold text-[#F1F5F9] tracking-tight text-right whitespace-nowrap">
                  40+ LLM
                </span>
              </div>
            </div>

            {/* Badge Button at bottom of floating card */}
            <div
              style={{ transform: "translateZ(32px)" }}
              className="flex items-center justify-start"
            >
              <button
                onClick={onOpenDashboard}
                className={`codos-cta-btn px-3.5 py-1 rounded-full text-[11px] font-bold shadow-lg transition-all hover:scale-105 cursor-pointer ${
                  isLightTheme
                    ? "bg-[#14213D] hover:bg-[#0B0B0C] !text-[#FFFFFF] shadow-[#14213D]/30"
                    : "bg-[#14B8A6] hover:bg-[#0D9488] text-[#0F172A] shadow-[#14B8A6]/40"
                }`}
              >
                Save 20% unified bundle
              </button>
            </div>
          </div>
        </ScrollCloudReveal>

        {/* LOWER HERO HEADLINE + SUBCOPY (LEFT) & CTA BUTTONS (RIGHT) */}
        <ScrollCloudReveal direction="up" delayMs={40} className="w-full">
        <div
          style={{
            transform: `translate3d(${mouse.x * -10}px, ${
              mouse.y * -6 - scrollY * 0.04
            }px, 20px)`,
          }}
          className="transition-transform duration-200 ease-out w-full"
        >
          {/* Giant Two-Line Editorial Headline */}
          <h1
            className={`text-4xl sm:text-5xl md:text-6xl lg:text-[66px] font-normal tracking-[-0.03em] text-[#F1F5F9] leading-[1.02] max-w-3xl ${
              isLightTheme
                ? "drop-shadow-[0_4px_16px_rgba(11,11,12,0.08)]"
                : "drop-shadow-[0_8px_28px_rgba(0,0,0,0.35)]"
            }`}
          >
            Platforms that feel
            <br />
            like a colleague.
          </h1>

          {/* Subcopy Row + Right-Aligned CTA Buttons */}
          <div className="mt-4 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <p className="text-xs sm:text-sm text-[#F1F5F9]/85 max-w-lg leading-relaxed font-normal">
              Call Colleague, Thumbs Up API, and Sky Beak LLM unified in one enterprise
              console. No fragmented logins, no separate bills, just the master key under your account.
            </p>

            {/* Right Action Buttons: Pill + Text Link */}
            <div className="flex items-center gap-5 flex-shrink-0">
              <button
                onClick={onOpenDashboard}
                className={`codos-cta-btn inline-flex items-center gap-2 px-6 py-3 rounded-full text-xs sm:text-sm font-bold transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer ${
                  isLightTheme
                    ? "bg-[#14213D] hover:bg-[#0B0B0C] !text-[#FFFFFF] shadow-[0_10px_30px_rgba(20,33,61,0.32)]"
                    : "bg-[#14B8A6] hover:bg-[#0D9488] text-[#0F172A] shadow-[0_10px_30px_rgba(20,184,166,0.45)] hover:shadow-[0_14px_36px_rgba(20,184,166,0.65)]"
                }`}
              >
                <span>Launch Console</span>
                <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
              </button>

              <a
                href="#services"
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-[#F1F5F9] hover:text-[#14B8A6] transition-colors"
              >
                <span>See the services</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
        </ScrollCloudReveal>
      </div>

      {/* =====================================================================
          LAYER 5: BOTTOM 5-COLUMN FEATURE BAR
         ===================================================================== */}
      <ScrollCloudReveal
        direction="up"
        delayMs={220}
        className="relative z-20 w-full px-6 sm:px-10 lg:px-12 flex-shrink-0"
      >
        <div className="border-t border-[#F1F5F9]/[0.16] grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 pt-3.5">
          {bottomFeatures.map((feat, idx) => {
            const Icon = feat.icon;
            const isHighlighted = activeBottomIndex === idx;
            return (
              <div
                key={idx}
                onMouseEnter={() => setActiveBottomIndex(idx)}
                className={`relative pt-0.5 cursor-pointer transition-colors duration-300 ${
                  isHighlighted
                    ? isLightTheme
                      ? "text-[#14213D]"
                      : "text-[#14B8A6]"
                    : "text-[#F1F5F9]/80 hover:text-[#F1F5F9]"
                }`}
              >
                {/* Top Indicator Line */}
                {isHighlighted && (
                  <div
                    className={`absolute -top-[15px] left-0 right-4 h-[2.5px] ${
                      isLightTheme
                        ? "bg-[#14213D] shadow-[0_0_12px_rgba(20,33,61,0.35)]"
                        : "bg-[#14B8A6] shadow-[0_0_12px_#14B8A6]"
                    }`}
                  />
                )}

                <Icon
                  className={`w-3.5 h-3.5 mb-1.5 ${
                    isHighlighted
                      ? isLightTheme
                        ? "text-[#14213D]"
                        : "text-[#14B8A6]"
                      : "text-[#F1F5F9]/75"
                  }`}
                />
                <div className="text-[11px] sm:text-xs font-medium leading-snug">
                  <div>{feat.line1}</div>
                  <div
                    className={
                      isHighlighted
                        ? isLightTheme
                          ? "text-[#14213D]/90"
                          : "text-[#14B8A6]/90"
                        : "text-[#F1F5F9]/65"
                    }
                  >
                    {feat.line2}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollCloudReveal>
    </section>
  );
};
