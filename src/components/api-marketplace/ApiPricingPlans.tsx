"use client";

import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import type { ApiPricingPlan, MarketplaceApi } from "./types";

interface Props {
  api: MarketplaceApi;
  onSubscribe?: (plan: ApiPricingPlan) => void;
}

export default function ApiPricingPlans({ api, onSubscribe }: Props) {
  const [activePlan, setActivePlan] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">Plans for {api.name}</h2>
        <p className="mt-1 text-xs text-[#CBD5E1]">Choose a tier; you can adjust it as usage changes.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {api.pricingPlans.map((plan) => (
          <article key={plan.id} className={`glass-panel rounded-2xl p-4 flex flex-col ${activePlan === plan.id ? "border-[#14B8A6]/60" : ""}`}>
            <div className="flex items-center justify-between"><h3 className="text-sm font-bold">{plan.name}</h3>{plan.id === "pro-monthly" && <Sparkles className="w-4 h-4 text-[#14B8A6]" />}</div>
            <p className="mt-3 text-xl font-bold text-[#14B8A6]">{plan.priceDisplay}</p>
            <p className="mt-2 min-h-9 text-[10px] text-[#CBD5E1]">{plan.description}</p>
            <div className="mt-4 space-y-2 border-t border-[#F1F5F9]/10 pt-3 text-[10px]">
              <Row label="Monthly requests" value={plan.monthlyRequestLimit?.toLocaleString() ?? "Usage-based"} />
              <Row label="RPM cap" value={plan.rateLimitRpm.toLocaleString()} />
              <Row label="Overage" value={plan.overageRate} />
            </div>
            <button onClick={() => { setActivePlan(plan.id); onSubscribe?.(plan); }} className="mt-auto pt-4">
              <span className={`h-9 w-full rounded-lg flex items-center justify-center gap-1 text-xs font-bold ${activePlan === plan.id ? "border border-[#14B8A6]/40 text-[#14B8A6]" : "bg-[#14B8A6] text-[#0F172A]"}`}>
                {activePlan === plan.id ? <><Check className="w-3.5 h-3.5" />Plan selected</> : "Subscribe / Activate Plan"}
              </span>
            </button>
          </article>
        ))}
      </div>
      {activePlan && <p role="status" className="text-xs text-[#14B8A6]">Plan selected. API access setup is ready for this account.</p>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-2"><span className="text-[#CBD5E1]">{label}</span><span className="text-right font-semibold">{value}</span></div>;
}
