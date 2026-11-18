"use client";

import Link from "next/link";
import { ArrowUpRight, BrainCircuit, Clock3, ImageIcon, Mic2, FileText, Video, Sparkles } from "lucide-react";
import type { MarketplaceModel } from "./types";

interface Props {
  model: MarketplaceModel;
  onTry: (model: MarketplaceModel) => void;
}

export default function ModelCard({ model, onTry }: Props) {
  const Icon = model.inputType === "Image" ? ImageIcon : model.inputType === "Audio" ? Mic2 : model.inputType === "Video" ? Video : model.inputType === "Document" ? FileText : model.category === "Industry-specific AI" ? Sparkles : BrainCircuit;
  return (
    <article className="glass-panel rounded-2xl p-5 flex flex-col min-h-[330px] hover:border-[#14B8A6]/45 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="w-11 h-11 rounded-xl bg-[#14B8A6]/12 border border-[#14B8A6]/25 flex items-center justify-center">
          <Icon className="w-5 h-5 text-[#14B8A6]" />
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          <span className={`text-[9px] font-bold px-2 py-1 rounded-full ${model.providerType === "via_codos" ? "bg-[#14B8A6] text-[#0F172A]" : "bg-[#1E293B] border border-[#F1F5F9]/12"}`}>
            {model.providerType === "via_codos" ? "Via Codos Official" : "Verified Developer"}
          </span>
          <span className="text-[9px] font-mono px-2 py-1 rounded-full border border-[#F1F5F9]/12 text-[#CBD5E1]">v{model.version}</span>
        </div>
      </div>
      <div className="mt-4">
        <h3 className="text-base font-bold">{model.name}</h3>
        <p className="mt-1 text-xs text-[#CBD5E1] leading-relaxed line-clamp-2">{model.tagline}</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="text-[10px] px-2 py-1 rounded-md bg-[#F1F5F9]/6 text-[#CBD5E1]">{model.category}</span>
        <span className="text-[10px] px-2 py-1 rounded-md border border-[#F1F5F9]/10">{model.hostingMethod === "codos_hosted" ? "CODOS-hosted" : "Developer-hosted"}</span>
      </div>
      <div className="mt-auto pt-5 space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm font-bold text-[#14B8A6]">{model.priceDisplay}</p>
            <p className="text-[10px] text-[#CBD5E1]">{model.unitLabel}</p>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-[#CBD5E1]"><Clock3 className="w-3 h-3" />{model.avgLatencyMs} ms</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => onTry(model)} className="h-9 rounded-lg bg-[#14B8A6] text-[#0F172A] text-xs font-bold hover:bg-[#0D9488] transition-colors">Try in Playground</button>
          <Link href={`/models/${model.slug}`} className="h-9 rounded-lg border border-[#F1F5F9]/12 text-xs font-semibold flex items-center justify-center gap-1 hover:border-[#14B8A6]/50">
            View Details <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </article>
  );
}
