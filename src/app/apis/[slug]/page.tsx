"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Check, ChevronRight, Copy, ExternalLink, KeyRound } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { SeoFooter } from "@/components/SeoFooter";
import { getMarketplaceApiBySlug } from "@/lib/apiMarketplaceApi";
import type { ApiPricingPlan, MarketplaceApi } from "@/components/api-marketplace/types";
import ApiDocsViewer from "@/components/api-marketplace/ApiDocsViewer";
import ApiPricingPlans from "@/components/api-marketplace/ApiPricingPlans";
import ApiKeyManager from "@/components/api-marketplace/ApiKeyManager";
import ApiUsageAnalytics from "@/components/api-marketplace/ApiUsageAnalytics";

type Tab = "Documentation" | "Pricing & Plans" | "API Keys" | "Usage & Analytics" | "Overview & SLA";

export default function ApiDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const [slug, setSlug] = useState("");
  const [api, setApi] = useState<MarketplaceApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("Documentation");
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    params.then(({ slug: routeSlug }) => setSlug(routeSlug));
  }, [params]);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    getMarketplaceApiBySlug(slug).then((result) => {
      if (!active) return;
      setApi(result);
      setLoading(false);
      const tab = new URLSearchParams(window.location.search).get("tab");
      if (tab === "pricing") setActiveTab("Pricing & Plans");
      if (tab === "keys") setActiveTab("API Keys");
    }).catch((error: unknown) => {
      console.error("Could not load API detail", error);
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [slug]);

  const copyBaseUrl = async () => {
    if (!api) return;
    try {
      await navigator.clipboard.writeText(api.baseUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch (error) {
      console.error("Could not copy API base URL", error);
      setNotice("Clipboard unavailable; select and copy the base URL.");
    }
  };

  const openKeys = () => {
    setActiveTab("API Keys");
    setNotice("");
  };

  const choosePlan = (plan: ApiPricingPlan) => {
    setNotice(`${plan.name} selected. Create an API key to configure access.`);
  };

  const tabs: Tab[] = ["Documentation", "Pricing & Plans", "API Keys", "Usage & Analytics", "Overview & SLA"];
  if (loading) return <main className="min-h-screen bg-[#0F172A] text-[#F1F5F9]"><Navbar activeView="landing" /><div className="pt-28 px-6 text-sm">Loading API...</div></main>;
  if (!api) return (
    <main className="min-h-screen bg-[#0F172A] text-[#F1F5F9]"><Navbar activeView="landing" /><div className="pt-28 px-6 text-center"><h1 className="text-xl font-bold">API not found</h1><Link href="/apis" className="mt-4 inline-block text-sm text-[#14B8A6]">Return to API Marketplace</Link></div></main>
  );

  return (
    <main className="min-h-screen bg-[#0F172A] text-[#F1F5F9]">
      <Navbar activeView="landing" />
      <div className="mx-auto max-w-7xl px-5 sm:px-8 pt-24 pb-16">
        <nav className="flex items-center gap-1.5 text-[11px] text-[#CBD5E1]">
          <Link href="/apis" className="hover:text-[#14B8A6]">API Marketplace</Link><ChevronRight className="w-3 h-3" /><span>{api.category}</span><ChevronRight className="w-3 h-3" /><span className="text-[#F1F5F9]">{api.name}</span>
        </nav>
        <header className="mt-5 glass-panel rounded-2xl p-5 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${api.providerType === "via_codos" ? "bg-[#14B8A6] text-[#0F172A]" : "bg-[#1E293B] border border-[#F1F5F9]/12"}`}>{api.providerType === "via_codos" ? "Via Codos Official" : `Verified · ${api.developerName}`}</span>
                {api.developerVerified && <BadgeCheck className="w-4 h-4 text-[#14B8A6]" />}
                <span className="text-[10px] px-2 py-1 rounded-full border border-[#F1F5F9]/12">{api.version}</span>
              </div>
              <h1 className="mt-3 text-2xl sm:text-3xl font-bold">{api.name}</h1>
              <p className="mt-2 text-sm text-[#CBD5E1]">{api.tagline}</p>
              <button onClick={copyBaseUrl} className="mt-3 max-w-full inline-flex items-center gap-2 rounded-lg border border-[#F1F5F9]/12 px-2.5 py-1.5 text-[10px] font-mono hover:border-[#14B8A6]/50">
                <span className="truncate">{api.baseUrl}</span>{copied ? <Check className="w-3 h-3 text-[#14B8A6]" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="glass-panel-subtle rounded-xl px-4 py-3"><p className="text-[9px] text-[#CBD5E1]">Uptime SLA</p><p className="mt-1 text-sm font-bold text-[#14B8A6]">{api.uptimeSla}%</p></div>
              <div className="glass-panel-subtle rounded-xl px-4 py-3"><p className="text-[9px] text-[#CBD5E1]">Avg. latency</p><p className="mt-1 text-sm font-bold">{api.avgLatencyMs} ms</p></div>
              <button onClick={openKeys} className="h-11 px-4 rounded-xl bg-[#14B8A6] text-[#0F172A] text-xs font-bold inline-flex items-center justify-center gap-2"><KeyRound className="w-4 h-4" />Get API Key / Subscribe</button>
            </div>
          </div>
        </header>
        {notice && <p role="status" className="mt-3 text-xs text-[#14B8A6]">{notice}</p>}
        <div className="mt-5 flex gap-1 overflow-x-auto rounded-xl border border-[#F1F5F9]/10 bg-[#090D16]/40 p-1">
          {tabs.map((tab) => <button key={tab} onClick={() => setActiveTab(tab)} className={`whitespace-nowrap px-3 py-2 rounded-lg text-xs font-semibold ${activeTab === tab ? "bg-[#14B8A6] text-[#0F172A]" : "text-[#CBD5E1] hover:bg-[#F1F5F9]/6"}`}>{tab}</button>)}
        </div>
        <div className="mt-5">
          {activeTab === "Documentation" && <ApiDocsViewer api={api} />}
          {activeTab === "Pricing & Plans" && <ApiPricingPlans api={api} onSubscribe={choosePlan} />}
          {activeTab === "API Keys" && <ApiKeyManager apiSlug={api.slug} defaultRateLimitRpm={api.rateLimitRpm} />}
          {activeTab === "Usage & Analytics" && <ApiUsageAnalytics api={api} />}
          {activeTab === "Overview & SLA" && (
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-4">
              <section className="glass-panel rounded-2xl p-5 space-y-5">
                <div><h2 className="text-sm font-bold">Overview</h2><p className="mt-2 text-sm text-[#CBD5E1] leading-relaxed">{api.description}</p></div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Info title="Authentication" value={api.authMethod} />
                  <Info title="Rate limit" value={`${api.rateLimitRpm.toLocaleString()} requests / minute`} />
                  <Info title="Availability SLA" value={`${api.uptimeSla}% uptime`} />
                  <Info title="Average latency" value={`${api.avgLatencyMs} ms`} />
                </div>
                <div><h2 className="text-sm font-bold">Authentication guide</h2><p className="mt-2 text-xs text-[#CBD5E1]">Create a key in the API Keys tab and send it in the Authorization header using the authentication method listed for this API. Keep live credentials in a server-side secret store; never expose them in browser code.</p></div>
                <a href={`mailto:${api.supportContact}`} className="inline-flex items-center gap-1 text-xs text-[#14B8A6]">Contact {api.developerName} support <ExternalLink className="w-3 h-3" /></a>
                <p className="text-[10px] text-[#CBD5E1]/70">Terms and data handling are provided by the API publisher and the CODOS platform agreement.</p>
              </section>
              <aside className="glass-panel rounded-2xl p-5 h-fit"><p className="text-[10px] uppercase tracking-wider text-[#CBD5E1]/70">Provider</p><p className="mt-2 text-sm font-bold">{api.developerName}</p><p className="mt-1 text-xs text-[#CBD5E1]">{api.providerType === "via_codos" ? "Via Codos Official" : "Verified developer"}</p><div className="mt-4 border-t border-[#F1F5F9]/10 pt-4"><p className="text-[10px] text-[#CBD5E1]">Support</p><a className="mt-1 block text-xs text-[#14B8A6] break-all" href={`mailto:${api.supportContact}`}>{api.supportContact}</a></div></aside>
            </div>
          )}
        </div>
      </div>
      <SeoFooter />
    </main>
  );
}

function Info({ title, value }: { title: string; value: string }) {
  return <div className="rounded-xl border border-[#F1F5F9]/10 p-4"><p className="text-[10px] text-[#CBD5E1]">{title}</p><p className="mt-1 text-sm font-bold">{value}</p></div>;
}
