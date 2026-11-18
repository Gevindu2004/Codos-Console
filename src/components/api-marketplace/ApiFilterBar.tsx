"use client";

import { Search } from "lucide-react";
import { API_AUTH_METHODS, API_CATEGORIES } from "@/lib/apiMarketplaceApi";
import type { ApiAuthMethod, ApiCategory, ApiProviderType } from "./types";

export type ApiPricingFilter = "All" | "Free Tier" | "Pay-per-Request" | "Monthly Subscription";
export type ApiSortOption = "Featured" | "Lowest Latency" | "Highest Uptime";

interface Props {
  search: string;
  onSearch: (value: string) => void;
  provider: "All" | ApiProviderType;
  onProvider: (value: "All" | ApiProviderType) => void;
  category: "All" | ApiCategory;
  onCategory: (value: "All" | ApiCategory) => void;
  pricing: ApiPricingFilter;
  onPricing: (value: ApiPricingFilter) => void;
  auth: "All" | ApiAuthMethod;
  onAuth: (value: "All" | ApiAuthMethod) => void;
  sort: ApiSortOption;
  onSort: (value: ApiSortOption) => void;
}

const pill = "px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-colors";
const selectClass = "h-9 rounded-lg bg-[#0B1120] text-slate-100 border border-slate-700/80 px-3 text-xs focus:border-teal-400 focus:outline-none";
const optionClass = "bg-[#0B1120] text-slate-100";

export default function ApiFilterBar(props: Props) {
  const providers: Array<["All", "All"] | ["Via Codos", "via_codos"] | ["Third-Party", "third_party"]> = [
    ["All", "All"],
    ["Via Codos", "via_codos"],
    ["Third-Party", "third_party"],
  ];
  return (
    <div className="glass-panel rounded-2xl p-3 sm:p-4 space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#CBD5E1]" />
        <input value={props.search} onChange={(event) => props.onSearch(event.target.value)} placeholder="Search APIs, providers, and capabilities..." className="w-full h-10 pl-10 pr-3 rounded-xl bg-[#0F172A]/40 border border-[#F1F5F9]/12 text-sm outline-none focus:border-[#14B8A6]" />
      </div>
      <div className="flex flex-wrap gap-2">
        {providers.map(([label, value]) => (
          <button key={value} onClick={() => props.onProvider(value)} className={`${pill} ${props.provider === value ? "bg-[#14B8A6] text-[#0F172A] border-[#14B8A6]" : "border-[#F1F5F9]/12 text-[#CBD5E1]"}`}>{label}</button>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
        <select value={props.category} onChange={(event) => props.onCategory(event.target.value as "All" | ApiCategory)} className={selectClass}>
          <option className={optionClass} value="All">All Categories</option>{API_CATEGORIES.map((item) => <option className={optionClass} key={item}>{item}</option>)}
        </select>
        <select value={props.pricing} onChange={(event) => props.onPricing(event.target.value as ApiPricingFilter)} className={selectClass}>
          <option className={optionClass} value="All">All Pricing</option><option className={optionClass}>Free Tier</option><option className={optionClass}>Pay-per-Request</option><option className={optionClass}>Monthly Subscription</option>
        </select>
        <select value={props.auth} onChange={(event) => props.onAuth(event.target.value as "All" | ApiAuthMethod)} className={selectClass}>
          <option className={optionClass} value="All">All Auth Types</option>{API_AUTH_METHODS.map((item) => <option className={optionClass} key={item}>{item}</option>)}
        </select>
        <select value={props.sort} onChange={(event) => props.onSort(event.target.value as ApiSortOption)} className={selectClass}>
          <option className={optionClass}>Featured</option><option className={optionClass}>Lowest Latency</option><option className={optionClass}>Highest Uptime</option>
        </select>
      </div>
    </div>
  );
}
