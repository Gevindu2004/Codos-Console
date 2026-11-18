"use client";

import { BadgeCheck, ShieldCheck, Headphones } from "lucide-react";
import type { MarketplaceModel } from "./types";

export default function DeveloperAndPricingCard({ model }: { model: MarketplaceModel }) {
  return (
    <aside className="glass-panel rounded-2xl p-5 space-y-5">
      <div>
        <p className="text-[10px] uppercase tracking-wider text-[#CBD5E1]/70">Provider</p>
        <div className="mt-2 flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-[#14B8A6]/12 border border-[#14B8A6]/25 flex items-center justify-center">
            {model.providerType === "via_codos" ? <ShieldCheck className="w-4 h-4 text-[#14B8A6]" /> : <BadgeCheck className="w-4 h-4 text-[#14B8A6]" />}
          </div>
          <div>
            <p className="text-sm font-bold">{model.developerName}</p>
            <p className="text-[10px] text-[#CBD5E1]">{model.providerType === "via_codos" ? "Via Codos Official" : "Verified developer"}</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div><p className="text-[#CBD5E1]/70">Base model</p><p className="mt-1 font-semibold break-words">{model.baseModel}</p></div>
        <div><p className="text-[#CBD5E1]/70">License</p><p className="mt-1 font-semibold">{model.license}</p></div>
      </div>
      <div className="pt-4 border-t border-[#F1F5F9]/10">
        <p className="text-[10px] uppercase tracking-wider text-[#CBD5E1]/70">Pricing</p>
        <p className="mt-2 text-lg font-bold text-[#14B8A6]">{model.priceDisplay}</p>
        <p className="text-[10px] text-[#CBD5E1]">{model.unitLabel}</p>
        <p className="mt-2 text-xs text-[#CBD5E1]">Free allowance: {model.freeTierAllowance}</p>
      </div>
      <a href={`mailto:${model.supportContact}`} className="flex items-center gap-2 text-xs text-[#CBD5E1] hover:text-[#14B8A6]">
        <Headphones className="w-4 h-4" />{model.supportContact}
      </a>
    </aside>
  );
}
