"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, Boxes, ShieldCheck, Users } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { SeoFooter } from "@/components/SeoFooter";
import { getMarketplaceApis } from "@/lib/apiMarketplaceApi";
import type { MarketplaceApi } from "@/components/api-marketplace/types";
import type { ApiAuthMethod, ApiCategory, ApiProviderType } from "@/components/api-marketplace/types";
import ApiCard from "@/components/api-marketplace/ApiCard";
import ApiFilterBar, { type ApiPricingFilter, type ApiSortOption } from "@/components/api-marketplace/ApiFilterBar";

export default function ApiMarketplacePage() {
  const [apis, setApis] = useState<MarketplaceApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [provider, setProvider] = useState<"All" | ApiProviderType>("All");
  const [category, setCategory] = useState<"All" | ApiCategory>("All");
  const [pricing, setPricing] = useState<ApiPricingFilter>("All");
  const [auth, setAuth] = useState<"All" | ApiAuthMethod>("All");
  const [sort, setSort] = useState<ApiSortOption>("Featured");

  useEffect(() => {
    let active = true;
    getMarketplaceApis().then((items) => {
      if (!active) return;
      setApis(items);
      setLoading(false);
    }).catch((error: unknown) => {
      console.error("Could not load API Marketplace catalog", error);
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rows = apis.filter((api) => {
      if (provider !== "All" && api.providerType !== provider) return false;
      if (category !== "All" && api.category !== category) return false;
      if (auth !== "All" && api.authMethod !== auth) return false;
      if (pricing === "Free Tier" && !api.pricingPlans.some((plan) => plan.id === "free" && (plan.monthlyRequestLimit ?? 0) > 0)) return false;
      if (pricing === "Pay-per-Request" && !api.pricingPlans.some((plan) => plan.pricingModel === "pay_per_request")) return false;
      if (pricing === "Monthly Subscription" && !api.pricingPlans.some((plan) => plan.pricingModel === "monthly_subscription")) return false;
      if (query && ![api.name, api.tagline, api.description, api.developerName, api.category].join(" ").toLowerCase().includes(query)) return false;
      return true;
    });
    if (sort === "Lowest Latency") return [...rows].sort((a, b) => a.avgLatencyMs - b.avgLatencyMs);
    if (sort === "Highest Uptime") return [...rows].sort((a, b) => b.uptimeSla - a.uptimeSla);
    return [...rows].sort((a, b) => Number(b.providerType === "via_codos") - Number(a.providerType === "via_codos"));
  }, [apis, search, provider, category, pricing, auth, sort]);

  const viaCount = apis.filter((api) => api.providerType === "via_codos").length;
  const reset = () => {
    setSearch("");
    setProvider("All");
    setCategory("All");
    setPricing("All");
    setAuth("All");
    setSort("Featured");
  };

  return (
    <main className="min-h-screen bg-[#0F172A] text-[#F1F5F9]">
      <Navbar activeView="landing" />
      <div className="mx-auto max-w-7xl px-5 sm:px-8 pt-28 pb-16">
        <header className="rounded-3xl border border-[#14B8A6]/20 bg-gradient-to-br from-[#14B8A6]/10 via-[#1E293B]/70 to-[#090D16] p-6 sm:p-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#14B8A6]">Unified API Marketplace</p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-bold">CODOS API Marketplace</h1>
          <p className="mt-3 max-w-2xl text-sm text-[#CBD5E1]">Browse trusted Via Codos platform APIs and verified developer integrations. Explore docs, test endpoints, and manage access from one place.</p>
          <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat icon={Boxes} label="Total APIs" value={loading ? "..." : String(apis.length)} />
            <Stat icon={ShieldCheck} label="Via Codos Official" value={loading ? "..." : String(viaCount)} />
            <Stat icon={Users} label="Third-Party" value={loading ? "..." : String(apis.length - viaCount)} />
            <Stat icon={Activity} label="Gateway Uptime" value="99.9%" />
          </div>
        </header>
        <div className="mt-6">
          <ApiFilterBar search={search} onSearch={setSearch} provider={provider} onProvider={setProvider} category={category} onCategory={setCategory} pricing={pricing} onPricing={setPricing} auth={auth} onAuth={setAuth} sort={sort} onSort={setSort} />
        </div>
        {loading ? (
          <p className="mt-6 text-sm text-[#CBD5E1]">Loading API catalog...</p>
        ) : filtered.length ? (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((api) => <ApiCard key={api.id} api={api} />)}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl glass-panel p-10 text-center">
            <h2 className="text-base font-bold">No matching APIs</h2>
            <p className="mt-2 text-xs text-[#CBD5E1]">Try different filters or reset the marketplace search.</p>
            <button onClick={reset} className="mt-4 h-9 px-4 rounded-lg bg-[#14B8A6] text-[#0F172A] text-xs font-bold">Reset filters</button>
          </div>
        )}
        <Link href="/console" className="mt-8 inline-flex text-xs font-semibold text-[#14B8A6]">Back to Console →</Link>
      </div>
      <SeoFooter />
    </main>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Boxes; label: string; value: string }) {
  return <div className="glass-panel rounded-xl p-4 flex items-center gap-3"><Icon className="w-5 h-5 text-[#14B8A6]" /><div><p className="text-lg font-bold">{value}</p><p className="text-[10px] text-[#CBD5E1]">{label}</p></div></div>;
}
