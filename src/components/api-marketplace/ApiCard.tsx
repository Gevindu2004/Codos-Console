"use client";

import Link from "next/link";
import { ArrowUpRight, Bot, Code2, Headphones, PhoneCall, ShieldCheck } from "lucide-react";
import type { MarketplaceApi } from "./types";

export default function ApiCard({ api }: { api: MarketplaceApi }) {
  const Icon = api.category === "Voice & Communications" ? PhoneCall : api.category === "AI & NLP" ? Bot : api.category === "Developer Tools" ? Code2 : Headphones;
  const startingPlan = api.pricingPlans.find((plan) => plan.id === "pay-per-request");
  const hasFreeTier = api.pricingPlans.some((plan) => plan.id === "free" && plan.monthlyRequestLimit);
  return (
    <article className="glass-panel rounded-2xl p-5 flex flex-col min-h-[310px] hover:border-[#14B8A6]/45 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="w-11 h-11 rounded-xl bg-[#14B8A6]/12 border border-[#14B8A6]/25 flex items-center justify-center">
          <Icon className="w-5 h-5 text-[#14B8A6]" />
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`text-[9px] font-bold px-2 py-1 rounded-full ${api.providerType === "via_codos" ? "bg-[#14B8A6] text-[#0F172A]" : "bg-[#1E293B] border border-[#F1F5F9]/12"}`}>
            {api.providerType === "via_codos" ? "Via Codos Official" : `Verified · ${api.developerName}`}
          </span>
          <span className="text-[9px] font-mono text-[#CBD5E1]">{api.version}</span>
        </div>
      </div>
      <h2 className="mt-4 text-base font-bold">{api.name}</h2>
      <p className="mt-1 text-xs text-[#CBD5E1] leading-relaxed line-clamp-2">{api.tagline}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="text-[10px] px-2 py-1 rounded-md bg-[#F1F5F9]/6 text-[#CBD5E1]">{api.category}</span>
        {hasFreeTier && <span className="text-[10px] px-2 py-1 rounded-md bg-[#14B8A6]/12 text-[#14B8A6]">Free tier</span>}
      </div>
      <div className="mt-4 text-[10px] font-mono text-[#CBD5E1] truncate" title={api.baseUrl}>{api.baseUrl}</div>
      <div className="mt-auto pt-4">
        <div className="flex justify-between gap-3 text-[10px] text-[#CBD5E1]">
          <span className="inline-flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-[#14B8A6]" />{api.uptimeSla}% SLA</span>
          <span>{api.avgLatencyMs} ms avg</span>
          <span className="text-[#F1F5F9]">{startingPlan?.priceDisplay ?? "Custom"}</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link href={`/apis/${api.slug}`} className="h-9 rounded-lg border border-[#F1F5F9]/12 text-xs font-semibold flex items-center justify-center gap-1 hover:border-[#14B8A6]/50">
            View Docs <ArrowUpRight className="w-3 h-3" />
          </Link>
          <Link href={`/apis/${api.slug}?tab=pricing`} className="h-9 rounded-lg bg-[#14B8A6] text-[#0F172A] text-xs font-bold flex items-center justify-center hover:bg-[#0D9488]">Subscribe</Link>
        </div>
      </div>
    </article>
  );
}
