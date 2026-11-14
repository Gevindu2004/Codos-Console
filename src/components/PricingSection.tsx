"use client";

import React, { useState } from "react";
import { Check, Sparkles, ArrowRight } from "lucide-react";

export const PricingSection: React.FC<{ onGetStarted?: () => void }> = ({
  onGetStarted,
}) => {
  const [annual, setAnnual] = useState(true);

  const plans = [
    {
      name: "Developer",
      desc: "Ideal for prototyping voice agents & testing APIs with no upfront cost.",
      price: "$0",
      period: "forever free",
      badge: null,
      highlight: false,
      features: [
        "100 AI Voice Colleague minutes / mo",
        "100,000 Thumbs Up API requests",
        "500,000 Sky Beak LLM tokens / mo",
        "Community support & docs",
        "Single API master key",
      ],
      cta: "Start Free",
    },
    {
      name: "Scale Pro",
      desc: "Built for scaling startups & agencies managing multiple client workflows.",
      price: annual ? "$79" : "$99",
      period: "per month",
      badge: "Save 20% Annual",
      highlight: true,
      features: [
        "2,500 AI Voice Colleague minutes / mo",
        "5,000,000 Thumbs Up API requests",
        "25,000,000 Sky Beak LLM tokens / mo",
        "Sub-80ms low-latency telephony priority",
        "Multi-model auto-failover engine",
        "Unified billing & consolidated invoice",
      ],
      cta: "Launch Scale Pro",
    },
    {
      name: "Enterprise Custom",
      desc: "Tailored infrastructure, dedicated SIP trunks, VPC peering & custom SLAs.",
      price: "Custom",
      period: "billed annually",
      badge: "Enterprise SLA",
      highlight: false,
      features: [
        "Unlimited custom voice concurrency",
        "Dedicated Thumbs Up API edge clusters",
        "Fine-tuned LLM self-hosting & zero retention",
        "Custom telephony SIP trunk carrier peering",
        "SOC-2 Type II, HIPAA & GDPR compliance",
        "Dedicated technical solutions architect",
      ],
      cta: "Contact Enterprise Team",
    },
  ];

  return (
    <section
      id="pricing"
      className="w-full lg:h-screen lg:max-h-screen min-h-[660px] pt-16 pb-6 px-6 sm:px-10 lg:px-12 flex flex-col justify-between gap-5 overflow-hidden bg-[#0F172A]"
    >
      {/* Compact Header */}
      <div className="text-center space-y-2 max-w-3xl mx-auto flex-shrink-0">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#F1F5F9]">
          One Plan. <span className="text-[#14B8A6]">Three Unified Services.</span>
        </h2>
        <p className="text-xs sm:text-sm text-[#F1F5F9]/70">
          No separate subscriptions for voice agents, API gateways, and LLMs. Codos Console bundles all 3 services into a single cost-effective tier.
        </p>

        {/* Annual billing toggle */}
        <div className="flex items-center justify-center gap-3 pt-1">
          <span
            className={`text-xs ${
              !annual ? "text-[#F1F5F9] font-bold" : "text-[#F1F5F9]/60"
            }`}
          >
            Monthly
          </span>
          <button
            onClick={() => setAnnual(!annual)}
            className="w-11 h-5.5 rounded-full bg-[#090E1A] border border-[#F1F5F9]/20 p-0.5 relative transition-colors focus:outline-none cursor-pointer"
            aria-label="Toggle annual billing"
          >
            <div
              className={`w-4 h-4 rounded-full bg-[#14B8A6] transition-transform ${
                annual ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
          <div className="flex items-center gap-1.5">
            <span
              className={`text-xs ${
                annual ? "text-[#F1F5F9] font-bold" : "text-[#F1F5F9]/60"
              }`}
            >
              Annual
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#14B8A6] text-[#0F172A]">
              Save 20%
            </span>
          </div>
        </div>
      </div>

      {/* Full-Width Pricing Cards Grid */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0 items-stretch pt-2">
        {plans.map((p) => (
          <div
            key={p.name}
            className={`rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 relative h-full ${
              p.highlight
                ? "glass-panel border-2 border-[#14B8A6] shadow-2xl bg-[#0F172A]/95"
                : "glass-panel border border-[#F1F5F9]/12 hover:border-[#14B8A6]/40"
            }`}
          >
            {p.badge && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold bg-[#14B8A6] text-[#0F172A] shadow-md">
                {p.badge}
              </div>
            )}

            <div className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-[#F1F5F9]">{p.name}</h3>
                  <p className="text-xs text-[#F1F5F9]/70 mt-0.5">{p.desc}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-2xl sm:text-3xl font-extrabold text-[#F1F5F9] font-mono block leading-none">
                    {p.price}
                  </span>
                  <span className="text-[10px] text-[#F1F5F9]/60">/{p.period}</span>
                </div>
              </div>

              <div className="space-y-2.5 pt-3 border-t border-[#F1F5F9]/10">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#F1F5F9]/60 block">
                  Included in this plan:
                </span>
                <ul className="space-y-2 text-xs text-[#F1F5F9]/85">
                  {p.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-[#14B8A6] flex-shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-[#F1F5F9]/10 flex-shrink-0">
              <button
                onClick={onGetStarted}
                className={`codos-cta-btn w-full py-2.5 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  p.highlight
                    ? "bg-[#14B8A6] hover:bg-[#0D9488] text-[#0F172A] shadow-lg hover:-translate-y-0.5"
                    : "glass-panel hover:bg-[#F1F5F9]/10 text-[#F1F5F9]"
                }`}
              >
                <span>{p.cta}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
