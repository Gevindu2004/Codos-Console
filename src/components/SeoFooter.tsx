import React from "react";
import { ViaCodosLogo } from "./ViaCodosLogo";
import { ShieldCheck, PhoneCall, KeyRound, BrainCircuit } from "lucide-react";

export const SeoFooter: React.FC = () => {
  return (
    <footer className="border-t border-[#F1F5F9]/10 bg-[#090E1A] text-[#F1F5F9]/70 pt-14 pb-10 px-6 sm:px-10 lg:px-12">
      <div className="w-full space-y-10">
        {/* Top footer row: brand & overview */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 items-start">
          <div className="md:col-span-2 space-y-4">
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
          </div>

          {/* Pillar 1: Core Services */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#F1F5F9]">
              Core SaaS Services
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#voice-service" className="hover:text-[#14B8A6] transition-colors flex items-center gap-1.5">
                  <PhoneCall className="w-3.5 h-3.5 text-[#14B8A6]" />
                  <span>AI Call Colleague</span>
                </a>
              </li>
              <li>
                <a href="#api-service" className="hover:text-[#14B8A6] transition-colors flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-[#14B8A6]" />
                  <span>Thumbs Up API</span>
                </a>
              </li>
              <li>
                <a href="#llm-service" className="hover:text-[#14B8A6] transition-colors flex items-center gap-1.5">
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
          </div>

          {/* Pillar 2: Developers & SDKs */}
          <div className="space-y-3">
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
          </div>

          {/* Pillar 3: Company & Enterprise */}
          <div className="space-y-3">
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
          </div>
        </div>

        {/* Bottom copyright row */}
        <div className="pt-8 border-t border-[#F1F5F9]/10 flex flex-col sm:flex-row items-center justify-between text-xs text-[#F1F5F9]/50 gap-4">
          <p>
            &copy; 2026 Via Codos (PVT) LTD. All rights reserved. Codos Console, AI Call Colleague, and Thumbs Up API are registered trademarks.
          </p>
          <div className="flex items-center gap-4">
            <span>Unified SaaS Platform</span>
            <span>•</span>
            <span>Engineered for Global Scale</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
