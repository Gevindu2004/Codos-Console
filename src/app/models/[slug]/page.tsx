"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, ChevronRight, Code2, DollarSign, Layers3, Play } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { SeoFooter } from "@/components/SeoFooter";
import { getMarketplaceModelBySlug } from "@/lib/modelHubApi";
import type { MarketplaceModel } from "@/components/model-hub/types";
import ModelPlayground from "@/components/model-hub/ModelPlayground";
import DeveloperAndPricingCard from "@/components/model-hub/DeveloperAndPricingCard";
import SubscriptionModal from "@/components/model-hub/SubscriptionModal";

type Tab = "Playground" | "Overview & Specs" | "API & I/O Schema" | "Pricing & Compliance";

export default function ModelDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const [slug, setSlug] = useState("");
  const [model, setModel] = useState<MarketplaceModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("Playground");
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);

  useEffect(() => {
    params.then(({ slug: routeSlug }) => setSlug(routeSlug));
  }, [params]);

  useEffect(() => {
    if (!slug) return;
    getMarketplaceModelBySlug(slug).then((item) => {
      setModel(item);
      setLoading(false);
    });
  }, [slug]);

  if (loading) return <main className="min-h-screen bg-[#0F172A] text-[#F1F5F9]"><Navbar activeView="landing" /><div className="pt-28 px-6 text-sm">Loading model...</div></main>;
  if (!model) {
    return (
      <main className="min-h-screen bg-[#0F172A] text-[#F1F5F9]">
        <Navbar activeView="landing" />
        <div className="pt-28 px-6 text-center">
          <h1 className="text-xl font-bold">Model not found</h1>
          <Link href="/models" className="mt-4 inline-block text-sm text-[#14B8A6]">Return to Model Hub</Link>
        </div>
      </main>
    );
  }

  const tabs: Tab[] = ["Playground", "Overview & Specs", "API & I/O Schema", "Pricing & Compliance"];
  return (
    <main className="min-h-screen bg-[#0F172A] text-[#F1F5F9]">
      <Navbar activeView="landing" />
      <div className="mx-auto max-w-7xl px-5 sm:px-8 pt-24 pb-16">
        <nav className="flex items-center gap-1.5 text-[11px] text-[#CBD5E1]">
          <Link href="/models" className="hover:text-[#14B8A6]">Model Hub</Link><ChevronRight className="w-3 h-3" /><span>{model.category}</span><ChevronRight className="w-3 h-3" /><span className="text-[#F1F5F9]">{model.name}</span>
        </nav>
        <header className="mt-5 glass-panel rounded-2xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] px-2.5 py-1 rounded-full bg-[#14B8A6]/15 text-[#14B8A6] border border-[#14B8A6]/25">{model.providerType === "via_codos" ? "Via Codos Official" : "Verified Developer"}</span>
              <span className="text-[10px] px-2.5 py-1 rounded-full border border-[#F1F5F9]/12">v{model.version}</span>
              {model.developerVerified && <BadgeCheck className="w-4 h-4 text-[#14B8A6]" />}
            </div>
            <h1 className="mt-3 text-2xl sm:text-3xl font-bold">{model.name}</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#CBD5E1]">{model.tagline}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-[#CBD5E1]">
              <span className="px-2 py-1 rounded-md bg-[#F1F5F9]/6">{model.architecture}</span>
              <span className="px-2 py-1 rounded-md bg-[#F1F5F9]/6">{model.framework}</span>
              <span className="px-2 py-1 rounded-md bg-[#F1F5F9]/6">{model.hostingMethod === "codos_hosted" ? "CODOS-hosted" : "Developer-hosted"}</span>
            </div>
          </div>
          <button onClick={() => setSubscriptionOpen(true)} className="h-11 px-5 rounded-xl bg-[#14B8A6] text-[#0F172A] text-xs font-bold shrink-0">Subscribe / Use Model</button>
        </header>
        <div className="mt-5 flex gap-1 overflow-x-auto rounded-xl border border-[#F1F5F9]/10 bg-[#090D16]/40 p-1">
          {tabs.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`whitespace-nowrap px-3 py-2 rounded-lg text-xs font-semibold ${activeTab === tab ? "bg-[#14B8A6] text-[#0F172A]" : "text-[#CBD5E1] hover:bg-[#F1F5F9]/6"}`}>{tab}</button>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_280px] gap-5">
          <div>
            {activeTab === "Playground" && <ModelPlayground model={model} />}
            {activeTab === "Overview & Specs" && (
              <section className="glass-panel rounded-2xl p-5 space-y-5">
                <div><h2 className="text-sm font-bold">Description</h2><p className="mt-2 text-sm text-[#CBD5E1] leading-relaxed">{model.description}</p></div>
                <div><h2 className="text-sm font-bold">Use cases</h2><div className="mt-2 flex flex-wrap gap-2">{model.useCases.map((item) => <span key={item} className="text-xs px-2.5 py-1.5 rounded-lg bg-[#14B8A6]/10 text-[#14B8A6]">{item}</span>)}</div></div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div><h2 className="text-sm font-bold">Supported languages</h2><p className="mt-2 text-xs text-[#CBD5E1]">{model.supportedLanguages.join(", ")}</p></div>
                  <div><h2 className="text-sm font-bold">Performance</h2><p className="mt-2 text-xs text-[#CBD5E1]">Average latency: {model.avgLatencyMs} ms</p></div>
                </div>
                <div><h2 className="text-sm font-bold">Known limitations</h2><p className="mt-2 text-xs text-[#CBD5E1]">{model.limitations}</p></div>
              </section>
            )}
            {activeTab === "API & I/O Schema" && (
              <section className="glass-panel rounded-2xl p-5 space-y-5">
                <SchemaBlock title="Input JSON Schema" schema={model.inputSchema} />
                <SchemaBlock title="Output JSON Schema" schema={model.outputSchema} />
              </section>
            )}
            {activeTab === "Pricing & Compliance" && (
              <section className="glass-panel rounded-2xl p-5 space-y-5">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Info title="Billable unit" value={`${model.priceDisplay} ${model.unitLabel}`} icon={DollarSign} />
                  <Info title="Free allowance" value={model.freeTierAllowance} icon={Layers3} />
                </div>
                <div><h2 className="text-sm font-bold">License & base model</h2><p className="mt-2 text-xs text-[#CBD5E1]">{model.baseModel} · {model.license}</p></div>
                <div><h2 className="text-sm font-bold">Data retention & usage</h2><p className="mt-2 text-xs text-[#CBD5E1] leading-relaxed">Requests are processed according to the CODOS service policy. Developer-hosted models follow the provider&apos;s declared retention and usage terms. Do not submit regulated or sensitive data without an appropriate subscription agreement.</p></div>
              </section>
            )}
          </div>
          <DeveloperAndPricingCard model={model} />
        </div>
      </div>
      <SubscriptionModal model={model} open={subscriptionOpen} onClose={() => setSubscriptionOpen(false)} />
      <SeoFooter />
    </main>
  );
}

function SchemaBlock({ title, schema }: { title: string; schema: Record<string, unknown> }) {
  return (
    <div>
      <div className="flex items-center justify-between"><h2 className="text-sm font-bold">{title}</h2><Code2 className="w-4 h-4 text-[#14B8A6]" /></div>
      <pre className="mt-3 overflow-x-auto rounded-xl bg-[#090D16] border border-[#F1F5F9]/10 p-4 text-[11px] text-[#CBD5E1]">{JSON.stringify(schema, null, 2)}</pre>
    </div>
  );
}

function Info({ title, value, icon: Icon }: { title: string; value: string; icon: typeof Play }) {
  return <div className="rounded-xl border border-[#F1F5F9]/10 p-4"><Icon className="w-4 h-4 text-[#14B8A6]" /><p className="mt-2 text-[10px] text-[#CBD5E1]">{title}</p><p className="mt-1 text-sm font-bold">{value}</p></div>;
}
