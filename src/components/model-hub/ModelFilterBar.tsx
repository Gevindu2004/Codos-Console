"use client";

import { Search } from "lucide-react";
import type { InputType, ModelCategory, ProviderType } from "./types";

export type PricingFilter = "All" | "Free Tier" | "Pay-as-you-go" | "Subscription";
export type SortOption = "Featured" | "Lowest Latency" | "Newest";

export const MODEL_CATEGORIES: ModelCategory[] = [
  "Text generation & LLMs",
  "Image generation & editing",
  "Video generation & editing",
  "Speech recognition",
  "Text-to-speech",
  "Document processing",
  "Image recognition",
  "Data analysis",
  "Industry-specific AI",
];

interface Props {
  search: string;
  onSearch: (value: string) => void;
  provider: "All" | ProviderType;
  onProvider: (value: "All" | ProviderType) => void;
  category: "All" | ModelCategory;
  onCategory: (value: "All" | ModelCategory) => void;
  inputType: "All" | InputType;
  onInputType: (value: "All" | InputType) => void;
  pricing: PricingFilter;
  onPricing: (value: PricingFilter) => void;
  sort: SortOption;
  onSort: (value: SortOption) => void;
}

const pill = "px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-colors";

export default function ModelFilterBar(props: Props) {
  const providers: Array<["All", "All"] | ["Via Codos", "via_codos"] | ["Third-Party", "third_party"]> = [
    ["All", "All"],
    ["Via Codos", "via_codos"],
    ["Third-Party", "third_party"],
  ];
  const inputTypes: Array<"All" | InputType> = ["All", "Text", "Image", "Audio", "Video", "Document"];

  return (
    <div className="glass-panel rounded-2xl p-3 sm:p-4 space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#CBD5E1]" />
        <input
          value={props.search}
          onChange={(event) => props.onSearch(event.target.value)}
          placeholder="Search models, providers, or use cases..."
          className="w-full h-10 pl-10 pr-3 rounded-xl bg-[#0F172A]/40 border border-[#F1F5F9]/12 text-sm outline-none focus:border-[#14B8A6]"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {providers.map(([label, value]) => (
          <button key={value} onClick={() => props.onProvider(value)} className={`${pill} ${props.provider === value ? "bg-[#14B8A6] text-[#0F172A] border-[#14B8A6]" : "border-[#F1F5F9]/12 text-[#CBD5E1] hover:border-[#14B8A6]/50"}`}>
            {label}
          </button>
        ))}
        <span className="w-px h-6 bg-[#F1F5F9]/10 self-center" />
        {inputTypes.map((value) => (
          <button key={value} onClick={() => props.onInputType(value)} className={`${pill} ${props.inputType === value ? "bg-[#14B8A6]/20 border-[#14B8A6]/50 text-[#14B8A6]" : "border-[#F1F5F9]/12 text-[#CBD5E1]"}`}>
            {value}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <select value={props.category} onChange={(event) => props.onCategory(event.target.value as "All" | ModelCategory)} className="h-9 rounded-lg bg-[#0F172A]/40 border border-[#F1F5F9]/12 px-3 text-xs">
          <option value="All">All Categories</option>
          {MODEL_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
        <select value={props.pricing} onChange={(event) => props.onPricing(event.target.value as PricingFilter)} className="h-9 rounded-lg bg-[#0F172A]/40 border border-[#F1F5F9]/12 px-3 text-xs">
          <option>All</option>
          <option>Free Tier</option>
          <option>Pay-as-you-go</option>
          <option>Subscription</option>
        </select>
        <select value={props.sort} onChange={(event) => props.onSort(event.target.value as SortOption)} className="h-9 rounded-lg bg-[#0F172A]/40 border border-[#F1F5F9]/12 px-3 text-xs">
          <option>Featured</option>
          <option>Lowest Latency</option>
          <option>Newest</option>
        </select>
      </div>
    </div>
  );
}
