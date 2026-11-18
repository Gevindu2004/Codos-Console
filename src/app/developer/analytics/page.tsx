"use client";

import React, { useState } from "react";
import { KpiCard } from "@/components/developer/ui";
import {
  Activity,
  Zap,
  AlertTriangle,
  Users,
  Filter,
  RefreshCw,
  Download,
} from "lucide-react";

// ---- Mock per-product metrics ----
const mockProductMetrics = [
  {
    id: "api-1",
    name: "Acme Weather API",
    type: "API",
    totalRequests: 284300,
    p95LatencyMs: 142,
    errorRatePct: 0.04,
    activeSubscribers: 87,
    status: "Published",
  },
  {
    id: "model-1",
    name: "Acme Llama 3-FineTune",
    type: "AI Model",
    totalRequests: 93400,
    p95LatencyMs: 320,
    errorRatePct: 0.12,
    activeSubscribers: 34,
    status: "Published",
  },
];

// ---- Mock transaction ledger ----
const mockTransactions = [
  {
    id: "tx-001",
    date: "2026-11-17 14:23",
    customer: "cust_8f2a1b",
    product: "Acme Weather API",
    units: 500,
    unitLabel: "requests",
    amount: 0.5,
    status: "Settled",
  },
  {
    id: "tx-002",
    date: "2026-11-17 13:01",
    customer: "cust_3d9c77",
    product: "Acme Llama 3-FineTune",
    units: 42000,
    unitLabel: "tokens",
    amount: 0.84,
    status: "Settled",
  },
  {
    id: "tx-003",
    date: "2026-11-17 11:45",
    customer: "cust_1aa023",
    product: "Acme Weather API",
    units: 1000,
    unitLabel: "requests",
    amount: 1.0,
    status: "Settled",
  },
  {
    id: "tx-004",
    date: "2026-11-17 09:12",
    customer: "cust_8f2a1b",
    product: "Acme Weather API",
    units: 250,
    unitLabel: "requests",
    amount: 0.25,
    status: "Refunded",
  },
  {
    id: "tx-005",
    date: "2026-11-16 22:50",
    customer: "cust_9b4e12",
    product: "Acme Llama 3-FineTune",
    units: 85000,
    unitLabel: "tokens",
    amount: 1.7,
    status: "Settled",
  },
  {
    id: "tx-006",
    date: "2026-11-16 18:33",
    customer: "cust_3d9c77",
    product: "Acme Weather API",
    units: 750,
    unitLabel: "requests",
    amount: 0.75,
    status: "Settled",
  },
];

const txStatusStyles: Record<string, string> = {
  Settled: "bg-[#34D399]/10 text-[#34D399]",
  Refunded: "bg-[#F87171]/10 text-[#F87171]",
  Pending: "bg-[#FBBF24]/10 text-[#FBBF24]",
};

export default function AnalyticsPage() {
  const [productFilter, setProductFilter] = useState("All");
  const [txSearch, setTxSearch] = useState("");
  const [exported, setExported] = useState(false);

  const totalRequests = mockProductMetrics.reduce((s, m) => s + m.totalRequests, 0);
  const avgLatency = Math.round(
    mockProductMetrics.reduce((s, m) => s + m.p95LatencyMs, 0) / mockProductMetrics.length
  );
  const avgErrorRate = (
    mockProductMetrics.reduce((s, m) => s + m.errorRatePct, 0) / mockProductMetrics.length
  ).toFixed(2);
  const totalSubscribers = mockProductMetrics.reduce((s, m) => s + m.activeSubscribers, 0);

  const filteredTx = mockTransactions.filter((tx) => {
    const matchProduct =
      productFilter === "All" || tx.product === productFilter;
    const matchSearch =
      txSearch === "" ||
      tx.customer.includes(txSearch) ||
      tx.product.toLowerCase().includes(txSearch.toLowerCase()) ||
      tx.id.includes(txSearch);
    return matchProduct && matchSearch;
  });

  const productNames = ["All", ...Array.from(new Set(mockTransactions.map((t) => t.product)))];

  const exportToCsv = () => {
    const headers = ["Transaction ID", "Date", "Customer", "Product", "Units", "Unit", "Amount", "Status"];
    const escapeCsv = (value: string | number) =>
      `"${String(value).replace(/"/g, '""')}"`;
    const rows = filteredTx.map((tx) => [
      tx.id,
      tx.date,
      tx.customer,
      tx.product,
      tx.units,
      tx.unitLabel,
      tx.amount.toFixed(2),
      tx.status,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `codos-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setExported(true);
    window.setTimeout(() => setExported(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#F1F5F9]">Analytics &amp; Transactions</h1>
        <p className="text-sm text-[#CBD5E1] mt-1">
          Per-product performance metrics and itemized customer transaction ledger.
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Requests / Inferences"
          value={totalRequests.toLocaleString()}
          icon={<Activity className="w-5 h-5" />}
        />
        <KpiCard
          title="Avg. p95 Latency"
          value={`${avgLatency} ms`}
          icon={<Zap className="w-5 h-5" />}
        />
        <KpiCard
          title="Avg. Error Rate"
          value={`${avgErrorRate}%`}
          icon={<AlertTriangle className="w-5 h-5" />}
        />
        <KpiCard
          title="Active Subscribers"
          value={totalSubscribers}
          icon={<Users className="w-5 h-5" />}
        />
      </div>

      {/* Per-Product Metrics Table */}
      <div className="bg-[#1E293B] rounded-xl border border-[#F1F5F9]/10">
        <div className="flex items-center justify-between p-4 border-b border-[#F1F5F9]/10">
          <h3 className="text-sm font-semibold text-[#F1F5F9]">Per-Product Performance</h3>
          <button className="flex items-center gap-1.5 text-xs text-[#CBD5E1] hover:text-[#14B8A6] cursor-pointer">
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#F1F5F9]/10">
                <th className="text-left px-4 py-3 text-[#CBD5E1] font-medium">Product</th>
                <th className="text-left px-4 py-3 text-[#CBD5E1] font-medium">Type</th>
                <th className="text-right px-4 py-3 text-[#CBD5E1] font-medium">
                  Total Requests
                </th>
                <th className="text-right px-4 py-3 text-[#CBD5E1] font-medium">
                  p95 Latency (ms)
                </th>
                <th className="text-right px-4 py-3 text-[#CBD5E1] font-medium">
                  Error Rate %
                </th>
                <th className="text-right px-4 py-3 text-[#CBD5E1] font-medium">
                  Active Subs.
                </th>
                <th className="text-center px-4 py-3 text-[#CBD5E1] font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {mockProductMetrics.map((m) => (
                <tr
                  key={m.id}
                  className="border-b border-[#F1F5F9]/5 hover:bg-[#F1F5F9]/5 transition-colors"
                >
                  <td className="px-4 py-3 text-[#F1F5F9] font-medium">{m.name}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded bg-[#14B8A6]/10 text-[#14B8A6] text-[10px] font-semibold">
                      {m.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-[#F1F5F9]">
                    {m.totalRequests.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-[#F1F5F9]">{m.p95LatencyMs}</td>
                  <td
                    className={`px-4 py-3 text-right font-semibold ${
                      m.errorRatePct > 0.1 ? "text-[#F87171]" : "text-[#34D399]"
                    }`}
                  >
                    {m.errorRatePct}%
                  </td>
                  <td className="px-4 py-3 text-right text-[#F1F5F9]">
                    {m.activeSubscribers}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#34D399]/10 text-[#34D399]">
                      {m.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Ledger */}
      <div className="bg-[#1E293B] rounded-xl border border-[#F1F5F9]/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-[#F1F5F9]/10 gap-3">
          <h3 className="text-sm font-semibold text-[#F1F5F9]">Customer Transaction Ledger</h3>
          <div className="flex flex-wrap items-center gap-2">
            {/* Product filter pills */}
            <div className="flex items-center gap-1">
              <Filter className="w-3 h-3 text-[#CBD5E1]" />
              {productNames.map((n) => (
                <button
                  key={n}
                  onClick={() => setProductFilter(n)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-medium cursor-pointer transition-all ${
                    productFilter === n
                      ? "bg-[#14B8A6] text-[#0F172A]"
                      : "bg-[#0F172A] text-[#CBD5E1] hover:text-[#F1F5F9]"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            {/* Search */}
            <input
              type="text"
              value={txSearch}
              onChange={(e) => setTxSearch(e.target.value)}
              placeholder="Search customer / tx ID…"
              className="bg-[#0F172A] border border-[#F1F5F9]/10 rounded-lg px-3 py-1 text-xs text-[#F1F5F9] placeholder-[#CBD5E1]/50 focus:outline-none focus:border-[#14B8A6] w-48"
            />
            <button
              onClick={exportToCsv}
              className="flex items-center gap-1.5 rounded-lg bg-[#0F172A] px-3 py-1.5 text-xs text-[#CBD5E1] hover:text-[#14B8A6]"
            >
              <Download className="w-3 h-3" />
              {exported ? "Exported!" : "Export CSV"}
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#F1F5F9]/10">
                <th className="text-left px-4 py-3 text-[#CBD5E1] font-medium">Tx ID</th>
                <th className="text-left px-4 py-3 text-[#CBD5E1] font-medium">Date</th>
                <th className="text-left px-4 py-3 text-[#CBD5E1] font-medium">Customer</th>
                <th className="text-left px-4 py-3 text-[#CBD5E1] font-medium">Product</th>
                <th className="text-right px-4 py-3 text-[#CBD5E1] font-medium">Units</th>
                <th className="text-right px-4 py-3 text-[#CBD5E1] font-medium">Amount</th>
                <th className="text-center px-4 py-3 text-[#CBD5E1] font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredTx.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[#CBD5E1]">
                    No transactions match your filter.
                  </td>
                </tr>
              ) : (
                filteredTx.map((tx) => (
                  <tr
                    key={tx.id}
                    className="border-b border-[#F1F5F9]/5 hover:bg-[#F1F5F9]/5 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-[#14B8A6]">{tx.id}</td>
                    <td className="px-4 py-3 text-[#CBD5E1]">{tx.date}</td>
                    <td className="px-4 py-3 font-mono text-[#F1F5F9]">{tx.customer}</td>
                    <td className="px-4 py-3 text-[#F1F5F9]">{tx.product}</td>
                    <td className="px-4 py-3 text-right text-[#F1F5F9]">
                      {tx.units.toLocaleString()} {tx.unitLabel}
                    </td>
                    <td className="px-4 py-3 text-right text-[#F1F5F9] font-semibold">
                      ${tx.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          txStatusStyles[tx.status] ?? ""
                        }`}
                      >
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="p-3 text-[10px] text-[#CBD5E1]/60 border-t border-[#F1F5F9]/10">
          Showing {filteredTx.length} of {mockTransactions.length} transactions.
        </div>
      </div>
    </div>
  );
}
