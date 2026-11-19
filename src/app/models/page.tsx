"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Boxes, ShieldCheck, Users } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { SeoFooter } from "@/components/SeoFooter";
import { getMarketplaceModels } from "@/lib/modelHubApi";
import type { MarketplaceModel } from "@/components/model-hub/types";
import ModelCard from "@/components/model-hub/ModelCard";
import ModelFilterBar, { type PricingFilter, type SortOption } from "@/components/model-hub/ModelFilterBar";
import type { InputType, ModelCategory, ProviderType } from "@/components/model-hub/types";

export default function ModelHubPage() {
  const router = useRouter();
  const [models, setModels] = useState<MarketplaceModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [provider, setProvider] = useState<"All" | ProviderType>("All");
  const [category, setCategory] = useState<"All" | ModelCategory>("All");
  const [inputType, setInputType] = useState<"All" | InputType>("All");
  const [pricing, setPricing] = useState<PricingFilter>("All");
  const [sort, setSort] = useState<SortOption>("Featured");

  useEffect(() => {
    getMarketplaceModels().then((items) => {
      setModels(items);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const result = models.filter((model) => {
      if (provider !== "All" && model.providerType !== provider) return false;
      if (category !== "All" && model.category !== category) return false;
      if (inputType !== "All" && model.inputType !== inputType) return false;
      if (pricing === "Pay-as-you-go" && !["per_token", "per_inference", "per_image", "per_video_minute", "per_audio_minute", "credit_package"].includes(model.pricingModel)) return false;
      if (pricing === "Subscription" && model.pricingModel !== "subscription") return false;
      if (normalizedSearch) {
        const haystack = [model.name, model.tagline, model.description, model.developerName, model.category, ...model.useCases].join(" ").toLowerCase();
        if (!haystack.includes(normalizedSearch)) return false;
      }
      return true;
    });
    if (sort === "Lowest Latency") return [...result].sort((a, b) => a.avgLatencyMs - b.avgLatencyMs);
    if (sort === "Newest") return [...result].sort((a, b) => b.version.localeCompare(a.version));
    return [...result].sort((a, b) => Number(b.providerType === "via_codos") - Number(a.providerType === "via_codos"));
  }, [models, search, provider, category, inputType, pricing, sort]);

  const viaCount = models.filter((model) => model.providerType === "via_codos").length;
  const thirdPartyCount = models.length - viaCount;
  const resetFilters = () => {
    setSearch("");
    setProvider("All");
    setCategory("All");
    setInputType("All");
    setPricing("All");
    setSort("Featured");
  };
  const tryModel = (model: MarketplaceModel) => {
    router.push(`/models/${model.slug}?tab=playground`);
  };

  return (
    <main className="min-h-screen bg-[#0F172A] text-[#F1F5F9]">
      <Navbar activeView="landing" />
      <div className="mx-auto max-w-7xl px-5 sm:px-8 pt-28 pb-16">
        <header className="rounded-3xl border border-[#14B8A6]/20 bg-gradient-to-br from-[#14B8A6]/10 via-[#1E293B]/70 to-[#090D16] p-6 sm:p-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#14B8A6]">Unified AI Marketplace</p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-bold">CODOS Model Hub</h1>
          <p className="mt-3 max-w-2xl text-sm text-[#CBD5E1]">Discover, test, and subscribe to official Via Codos intelligence and verified third-party developer models in one place.</p>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Stat icon={Boxes} label="Total Models" value={loading ? "..." : String(models.length)} />
            <Stat icon={ShieldCheck} label="Via Codos" value={loading ? "..." : String(viaCount)} />
            <Stat icon={Users} label="Third-Party" value={loading ? "..." : String(thirdPartyCount)} />
          </div>
        </header>

        <div className="mt-6">
          <ModelFilterBar search={search} onSearch={setSearch} provider={provider} onProvider={setProvider} category={category} onCategory={setCategory} inputType={inputType} onInputType={setInputType} pricing={pricing} onPricing={setPricing} sort={sort} onSort={setSort} />
        </div>
        {loading ? (
          <div className="mt-6 text-sm text-[#CBD5E1]">Loading the unified catalog...</div>
        ) : filtered.length ? (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((model) => <ModelCard key={model.id} model={model} onTry={tryModel} />)}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl glass-panel p-10 text-center">
            <h2 className="text-base font-bold">No matching models</h2>
            <p className="mt-2 text-xs text-[#CBD5E1]">Clear the filters to browse the full catalog.</p>
            <button onClick={resetFilters} className="mt-4 h-9 px-4 rounded-lg bg-[#14B8A6] text-[#0F172A] text-xs font-bold">Reset filters</button>
          </div>
        )}
        <Link href="/console" className="mt-8 inline-flex text-xs font-semibold text-[#14B8A6]">Open CODOS Console →</Link>
      </div>
      <SeoFooter />
    </main>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Boxes; label: string; value: string }) {
  return (
    <div className="glass-panel rounded-xl p-4 flex items-center gap-3">
      <Icon className="w-5 h-5 text-[#14B8A6]" />
      <div><p className="text-lg font-bold">{value}</p><p className="text-[10px] text-[#CBD5E1]">{label}</p></div>
    </div>
  );
}
