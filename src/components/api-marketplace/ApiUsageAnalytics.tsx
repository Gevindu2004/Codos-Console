"use client";

import { useMemo, useState } from "react";
import { Activity, CheckCircle2, Clock3, Gauge } from "lucide-react";
import type { ApiUsageRecord, MarketplaceApi } from "./types";

type UsageFilter = "All" | "Success" | "Errors";

function makeUsage(api: MarketplaceApi): ApiUsageRecord[] {
  const methods = api.endpoints.length ? api.endpoints : [];
  return Array.from({ length: 14 }, (_, index) => {
    const endpoint = methods[index % Math.max(1, methods.length)];
    const day = new Date(Date.now() - index * 45 * 60 * 1000);
    return {
      id: `${api.slug}-usage-${index}`,
      timestamp: day.toISOString(),
      endpoint: endpoint?.path || "/",
      method: endpoint?.method || "GET",
      statusCode: index % 9 === 0 ? 429 : index % 13 === 0 ? 500 : 200,
      latencyMs: Math.max(10, api.avgLatencyMs + ((index * 37) % 120) - 60),
      tokensOrUnits: 1 + (index * 13) % 240,
    };
  });
}

export default function ApiUsageAnalytics({ api }: { api: MarketplaceApi }) {
  const [filter, setFilter] = useState<UsageFilter>("All");
  const records = useMemo(() => makeUsage(api), [api]);
  const filtered = records.filter((row) => filter === "All" || (filter === "Success" ? row.statusCode < 400 : row.statusCode >= 400));
  const successes = records.filter((row) => row.statusCode < 400).length;
  const avgLatency = Math.round(records.reduce((sum, row) => sum + row.latencyMs, 0) / Math.max(records.length, 1));
  const totalRequests = 12840 + api.endpoints.length * 382;
  const quota = api.pricingPlans.find((plan) => plan.id === "pro-monthly")?.monthlyRequestLimit ?? 100000;
  const quotaUsed = Math.min(100, Math.round((totalRequests / quota) * 100));
  const bars = Array.from({ length: 14 }, (_, index) => 34 + ((index * 29 + api.avgLatencyMs) % 67));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Kpi icon={Activity} label="Total Requests" value={totalRequests.toLocaleString()} />
        <Kpi icon={CheckCircle2} label="Success Rate" value={`${Math.round(successes / records.length * 100)}%`} />
        <Kpi icon={Clock3} label="Avg Latency" value={`${avgLatency} ms`} />
        <Kpi icon={Gauge} label="Monthly Quota Used" value={`${quotaUsed}%`} />
      </div>
      <section className="glass-panel rounded-2xl p-5">
        <div className="flex justify-between items-center"><h2 className="text-sm font-bold">Daily request volume</h2><span className="text-[10px] text-[#CBD5E1]">Last 14 days · simulated preview</span></div>
        <div className="mt-5 h-36 flex items-end gap-2 border-b border-[#F1F5F9]/10">
          {bars.map((height, index) => <div key={index} className="flex-1 h-full flex items-end group"><div title={`${Math.round(totalRequests / 14 * height / 100)} requests`} className="w-full rounded-t-sm bg-[#14B8A6]/70 hover:bg-[#14B8A6] transition-colors" style={{ height: `${height}%` }} /></div>)}
        </div>
        <div className="mt-2 flex justify-between text-[9px] text-[#CBD5E1]/70"><span>14 days ago</span><span>Today</span></div>
      </section>
      <section className="glass-panel rounded-2xl p-5">
        <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-bold">Recent request log</h2><select value={filter} onChange={(event) => setFilter(event.target.value as UsageFilter)} className="h-8 rounded-lg bg-[#0B1120] text-slate-100 border border-slate-700/80 px-2 text-[10px] focus:border-teal-400 focus:outline-none"><option className="bg-[#0B1120] text-slate-100">All</option><option className="bg-[#0B1120] text-slate-100">Success</option><option className="bg-[#0B1120] text-slate-100">Errors</option></select></div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-[10px]">
            <thead><tr className="text-[#CBD5E1]/70 border-b border-[#F1F5F9]/10"><th className="py-2 pr-3">Timestamp</th><th className="py-2 pr-3">Method + Path</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Latency</th><th className="py-2">Units</th></tr></thead>
            <tbody>{filtered.map((row) => <tr key={row.id} className="border-b border-[#F1F5F9]/5"><td className="py-2.5 pr-3 text-[#CBD5E1]">{new Date(row.timestamp).toLocaleString()}</td><td className="py-2.5 pr-3"><b className="mr-2">{row.method}</b><code>{row.endpoint}</code></td><td className={`py-2.5 pr-3 ${row.statusCode < 400 ? "text-emerald-300" : "text-amber-300"}`}>{row.statusCode}</td><td className="py-2.5 pr-3">{row.latencyMs} ms</td><td className="py-2.5">{row.tokensOrUnits}</td></tr>)}</tbody>
          </table>
          {filtered.length === 0 && <p className="py-6 text-center text-xs text-[#CBD5E1]">No requests match this filter.</p>}
        </div>
      </section>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: string }) {
  return <div className="glass-panel rounded-xl p-4"><div className="flex justify-between"><span className="text-[10px] text-[#CBD5E1]">{label}</span><Icon className="w-4 h-4 text-[#14B8A6]" /></div><p className="mt-3 text-lg font-bold">{value}</p></div>;
}
