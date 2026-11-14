"use client";

import React from "react";
import { ViaCodosLogo } from "./ViaCodosLogo";
import { ShieldCheck, PhoneCall, KeyRound, BrainCircuit } from "lucide-react";
import { ScrollCloudReveal } from "./ScrollCloudReveal";

export const SeoFooter: React.FC = () => {
  const handleServiceLinkClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    targetId: "voice-service" | "api-service" | "llm-service"
  ) => {
    e.preventDefault();
    window.dispatchEvent(
      new CustomEvent("codos:highlight-service", { detail: targetId })
    );

    if (window.innerWidth >= 1024) {
      const servicesSection = document.getElementById("services");
      if (servicesSection) {
        servicesSection.scrollIntoView({ behavior: "smooth", block: "start" });
        window.history.replaceState(null, "", `#${targetId}`);
        return;
      }
    }

    const targetEl = document.getElementById(targetId);
    if (targetEl) {
      const y = targetEl.getBoundingClientRect().top + window.scrollY - 88;
      window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
      window.history.replaceState(null, "", `#${targetId}`);
    }
  };

  return (
    <footer className="relative z-10 w-full border-t border-[#F1F5F9]/10 bg-[#090E1A] text-[#F1F5F9]/70 pt-14 pb-10 px-6 sm:px-10 lg:px-12 overflow-hidden">
      <div className="w-full space-y-10">
        {/* Top footer row: brand & overview */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 items-start">
          <ScrollCloudReveal
            direction="left"
            delayMs={40}
            threshold={0.05}
            className="md:col-span-2 space-y-4"
          >
            <ViaCodosLogo size="md" />
            <p className="text-xs text-[#F1F5F9]/60 max-w-sm leading-relaxed">
              Codos Console by <strong className="text-[#F1F5F9]">Via Codos (PVT) LTD</strong> is the leading unified SaaS platform providing autonomous Call Colleagues, high-throughput Thumbs Up APIs, and Sky Beak LLM routing.
            </p>
            <div className="flex items-center gap-3 pt-2 text-xs text-[#F1F5F9]/80">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F1F5F9]/5 border border-[#F1F5F9]/10">
                <span className="w-2 h-2 rounded-full bg-[#14B8A6]" />
                <span>All Services Operational</span>
              </span>
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F1F5F9]/5 border border-[#F1F5F9]/10">
                <ShieldCheck className="w-3.5 h-3.5 text-[#14B8A6]" />
                <span>SOC-2 Certified</span>
              </span>
            </div>
          </ScrollCloudReveal>

          {/* Pillar 1: Core Services */}
          <ScrollCloudReveal
            direction="up"
            delayMs={120}
            threshold={0.05}
            className="space-y-3"
          >
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#F1F5F9]">
              Core SaaS Services
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a
                  href="#voice-service"
                  onClick={(e) => handleServiceLinkClick(e, "voice-service")}
                  className="hover:text-[#14B8A6] transition-colors flex items-center gap-1.5"
                >
                  <PhoneCall className="w-3.5 h-3.5 text-[#14B8A6]" />
                  <span>AI Call Colleague</span>
                </a>
              </li>
              <li>
                <a
                  href="#api-service"
                  onClick={(e) => handleServiceLinkClick(e, "api-service")}
                  className="hover:text-[#14B8A6] transition-colors flex items-center gap-1.5"
                >
                  <KeyRound className="w-3.5 h-3.5 text-[#14B8A6]" />
                  <span>Thumbs Up API</span>
                </a>
              </li>
              <li>
                <a
                  href="#llm-service"
                  onClick={(e) => handleServiceLinkClick(e, "llm-service")}
                  className="hover:text-[#14B8A6] transition-colors flex items-center gap-1.5"
                >
                  <BrainCircuit className="w-3.5 h-3.5 text-[#14B8A6]" />
                  <span>Sky Beak LLM</span>
                </a>
              </li>
              <li>
                <a href="#architecture" className="hover:text-[#F1F5F9] transition-colors">
                  Single Account Architecture
                </a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-[#F1F5F9] transition-colors">
                  Unified Cloud Pricing
                </a>
              </li>
            </ul>
          </ScrollCloudReveal>

          {/* Pillar 2: Developers & SDKs */}
          <ScrollCloudReveal
            direction="up"
            delayMs={200}
            threshold={0.05}
            className="space-y-3"
          >
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#F1F5F9]">
              Developers &amp; APIs
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#architecture" className="hover:text-[#F1F5F9] transition-colors">
                  API Documentation
                </a>
              </li>
              <li>
                <a href="#architecture" className="hover:text-[#F1F5F9] transition-colors">
                  Node.js / TypeScript SDK
                </a>
              </li>
              <li>
                <a href="#architecture" className="hover:text-[#F1F5F9] transition-colors">
                  Python Telephony Client
                </a>
              </li>
              <li>
                <a href="#architecture" className="hover:text-[#F1F5F9] transition-colors">
                  Go &amp; cURL Examples
                </a>
              </li>
              <li>
                <span className="text-[#F1F5F9]/40">Status: 99.999% SLA</span>
              </li>
            </ul>
          </ScrollCloudReveal>

          {/* Pillar 3: Company & Enterprise */}
          <ScrollCloudReveal
            direction="right"
            delayMs={280}
            threshold={0.05}
            className="space-y-3"
          >
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#F1F5F9]">
              Via Codos (PVT) LTD
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <span className="text-[#F1F5F9] font-medium">Via Codos (PVT) LTD</span>
              </li>
              <li>
                <span className="text-[#F1F5F9]/60">Enterprise Cloud Solutions</span>
              </li>
              <li>
                <a href="#pricing" className="hover:text-[#F1F5F9] transition-colors">
                  Security &amp; Data Privacy
                </a>
              </li>
              <li>
                <a href="#overview" className="hover:text-[#F1F5F9] transition-colors">
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="#overview" className="hover:text-[#F1F5F9] transition-colors">
                  Privacy Policy
                </a>
              </li>
            </ul>
          </ScrollCloudReveal>
        </div>

        {/* Bottom copyright row */}
        <ScrollCloudReveal
          direction="up"
          delayMs={320}
          threshold={0.05}
          className="pt-8 border-t border-[#F1F5F9]/10 flex flex-col sm:flex-row items-center justify-between text-xs text-[#F1F5F9]/50 gap-4"
        >
          <p>
            &copy; 2026 Via Codos (PVT) LTD. All rights reserved. Codos Console, AI Call Colleague, and Thumbs Up API are registered trademarks.
          </p>
          <div className="flex items-center gap-4">
            <span>Unified SaaS Platform</span>
            <span>•</span>
            <span>Engineered for Global Scale</span>
          </div>
        </ScrollCloudReveal>
      </div>
    </footer>
  );
};
