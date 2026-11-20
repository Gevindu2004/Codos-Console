"use client";

import React, { useState } from "react";
import { KpiCard } from "@/components/developer/ui";
import { useDeveloper } from "@/components/developer/DeveloperContext";
import { CommercialPricingDetails } from "@/components/developer/CommercialPricingDetails";
import {
  DollarSign,
  TrendingUp,
  Clock,
  Wallet,
  Download,
  Filter,
} from "lucide-react";

const payoutCsvHeaders = [
  "Payout ID",
  "Date",
  "Period",
  "Method",
  "Gross Amount",
  "Platform Commission",
  "Net Payout",
  "Status",
  "Reference",
];

const mockPayouts = [
  {
    id: "p1",
    date: "2026-10-31",
    period: "October 2026",
    method: "Bank Transfer",
    reference: "TRF-2026-10-001",
    product: "Acme Weather API",
    grossRevenue: 850.0,
    commission: 127.5,
    net: 722.5,
    status: "Paid",
  },
  {
    id: "p2",
    date: "2026-10-31",
    period: "October 2026",
    method: "Bank Transfer",
    reference: "TRF-2026-10-002",
    product: "Acme Llama 3-FineTune",
    grossRevenue: 430.0,
    commission: 64.5,
    net: 365.5,
    status: "Paid",
  },
  {
    id: "p3",
    date: "2026-11-15",
    period: "November 2026",
    method: "Bank Transfer",
    reference: "TRF-2026-11-001",
    product: "Acme Weather API",
    grossRevenue: 1120.0,
    commission: 168.0,
    net: 952.0,
    status: "Pending Clearance",
  },
  {
    id: "p4",
    date: "2026-11-15",
    period: "November 2026",
    method: "Bank Transfer",
    reference: "TRF-2026-11-002",
    product: "Acme Llama 3-FineTune",
    grossRevenue: 275.0,
    commission: 41.25,
    net: 233.75,
    status: "Pending Clearance",
  },
];

const statusStyles: Record<string, string> = {
  Paid: "bg-[#34D399]/10 text-[#34D399]",
  "Pending Clearance": "bg-[#FBBF24]/10 text-[#FBBF24]",
  Failed: "bg-[#F87171]/10 text-[#F87171]",
};

export default function EarningsPage() {
  const { apiProducts, modelProducts } = useDeveloper();
  const [filter, setFilter] = useState("All");
  const [exported, setExported] = useState(false);
  const commercialProducts = [...apiProducts, ...modelProducts];

  const totalGross = mockPayouts.reduce((s, p) => s + p.grossRevenue, 0);
  const totalCommission = mockPayouts.reduce((s, p) => s + p.commission, 0);
  const totalNet = mockPayouts.reduce((s, p) => s + p.net, 0);
  const pendingBalance = mockPayouts
    .filter((p) => p.status === "Pending Clearance")
    .reduce((s, p) => s + p.net, 0);
  const availableBalance = mockPayouts
    .filter((p) => p.status === "Paid")
    .reduce((s, p) => s + p.net, 0);

  const filters = ["All", "Paid", "Pending Clearance"];
  const filtered =
    filter === "All" ? mockPayouts : mockPayouts.filter((p) => p.status === filter);

  const exportToCsv = () => {
    const escapeCsv = (value: string | number) =>
      `"${String(value).replace(/"/g, '""')}"`;
    const rows = filtered.map((payout) => [
      payout.id,
      payout.date,
      payout.period,
      payout.method,
      payout.grossRevenue.toFixed(2),
      payout.commission.toFixed(2),
      payout.net.toFixed(2),
      payout.status,
      payout.reference,
    ]);
    const csv = [payoutCsvHeaders, ...rows]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `codos-payout-history-${new Date().toISOString().slice(0, 10)}.csv`;
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
        <h1 className="text-2xl font-bold text-[#F1F5F9]">
          Earnings &amp; Commissions
        </h1>
        <p className="text-sm text-[#CBD5E1] mt-1">
          Revenue breakdown, platform commission deductions, and payout history.
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Gross Revenue (All Time)"
          value={`$${totalGross.toFixed(2)}`}
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <KpiCard
          title="CODOS Commission (15%)"
          value={`-$${totalCommission.toFixed(2)}`}
          icon={<DollarSign className="w-5 h-5" />}
        />
        <KpiCard
          title="Net Developer Earnings"
          value={`$${totalNet.toFixed(2)}`}
          icon={<Wallet className="w-5 h-5" />}
        />
        <KpiCard
          title="Pending Clearance"
          value={`$${pendingBalance.toFixed(2)}`}
          icon={<Clock className="w-5 h-5" />}
        />
      </div>

      {/* Payout Balance Banner */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 p-5 rounded-xl bg-[#14B8A6]/10 border border-[#14B8A6]/30">
          <div className="text-xs font-medium text-[#14B8A6] uppercase tracking-wider mb-1">
            Available for Payout
          </div>
          <div className="text-3xl font-bold text-[#F1F5F9]">
            ${availableBalance.toFixed(2)}
          </div>
          <div className="text-xs text-[#CBD5E1] mt-1">
            Transferred to your registered payout account on the 1st of each month.
          </div>
        </div>
        <div className="flex-1 p-5 rounded-xl bg-[#FBBF24]/10 border border-[#FBBF24]/30">
          <div className="text-xs font-medium text-[#FBBF24] uppercase tracking-wider mb-1">
            Pending Clearance
          </div>
          <div className="text-3xl font-bold text-[#F1F5F9]">
            ${pendingBalance.toFixed(2)}
          </div>
          <div className="text-xs text-[#CBD5E1] mt-1">
            Revenue from the current billing cycle. Clears within 7 business days.
          </div>
        </div>
      </div>

      {/* Commission Breakdown Info */}
      <div className="p-4 bg-[#1E293B] rounded-xl border border-[#F1F5F9]/10">
        <h3 className="text-sm font-semibold text-[#F1F5F9] mb-3">
          CODOS Commission Structure
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-[#CBD5E1]">
          <div className="p-3 bg-[#0F172A] rounded-lg">
            <div className="font-semibold text-[#F1F5F9] mb-1">Tier 1 — Starter</div>
            <div>Revenue: $0 – $5,000/mo</div>
            <div className="text-[#14B8A6] font-semibold mt-1">15% commission</div>
          </div>
          <div className="p-3 bg-[#0F172A] rounded-lg">
            <div className="font-semibold text-[#F1F5F9] mb-1">Tier 2 — Growth</div>
            <div>Revenue: $5,001 – $50,000/mo</div>
            <div className="text-[#14B8A6] font-semibold mt-1">12% commission</div>
          </div>
          <div className="p-3 bg-[#0F172A] rounded-lg">
            <div className="font-semibold text-[#F1F5F9] mb-1">Tier 3 — Enterprise</div>
            <div>Revenue: $50,001+/mo</div>
            <div className="text-[#14B8A6] font-semibold mt-1">8% commission</div>
          </div>
        </div>
      </div>

      <section className="overflow-x-auto rounded-xl border border-[#F1F5F9]/10 bg-[#1E293B]">
        <div className="border-b border-[#F1F5F9]/10 p-4">
          <h3 className="text-sm font-semibold text-[#F1F5F9]">Product Pricing &amp; Agreement</h3>
          <p className="mt-1 text-xs text-[#CBD5E1]">Your current base prices, CODOS tiers, retail prices, and sign-off records.</p>
        </div>
        <table className="w-full min-w-[700px] text-xs">
          <thead>
            <tr className="border-b border-[#F1F5F9]/10">
              {["Product", "Status", "Commercial terms"].map((label) => <th key={label} className="px-4 py-3 text-left font-medium text-[#CBD5E1]">{label}</th>)}
            </tr>
          </thead>
          <tbody>
            {commercialProducts.map((product) => (
              <tr key={product.id} className="border-b border-[#F1F5F9]/5">
                <td className="px-4 py-3 font-medium text-[#F1F5F9]">
                  {product.productType === "api" ? product.payload.formA.productName : product.payload.formA.modelName}
                </td>
                <td className="px-4 py-3 text-[#CBD5E1]">{product.payload.status}</td>
                <td className="px-4 py-3">
                  <CommercialPricingDetails
                    basePrice={product.basePrice}
                    pricingTier={product.pricingTier}
                    profitMarginPercent={product.profitMarginPercent}
                    finalRetailPrice={product.finalRetailPrice}
                    agreementSigned={product.agreementSigned}
                    agreementSignedBy={product.agreementSignedBy}
                    agreementSignedAt={product.agreementSignedAt}
                  />
                </td>
              </tr>
            ))}
            {commercialProducts.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-[#CBD5E1]">No product pricing records yet.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Payout History Table */}
      <div className="bg-[#1E293B] rounded-xl border border-[#F1F5F9]/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-[#F1F5F9]/10 gap-3">
          <h3 className="text-sm font-semibold text-[#F1F5F9]">Payout History</h3>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#CBD5E1]" />
            <div className="flex gap-1">
              {filters.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                    filter === f
                      ? "bg-[#14B8A6] text-[#0F172A]"
                      : "bg-[#0F172A] text-[#CBD5E1] hover:text-[#F1F5F9]"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <button onClick={exportToCsv} className="flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-[#0F172A] text-[#CBD5E1] hover:text-[#F1F5F9] cursor-pointer ml-2">
              <Download className="w-3 h-3" />
              {exported ? "Exported!" : "Export CSV"}
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#F1F5F9]/10">
                <th className="text-left px-4 py-3 text-[#CBD5E1] font-medium">Date</th>
                <th className="text-left px-4 py-3 text-[#CBD5E1] font-medium">Product</th>
                <th className="text-right px-4 py-3 text-[#CBD5E1] font-medium">Gross Revenue</th>
                <th className="text-right px-4 py-3 text-[#CBD5E1] font-medium">Commission</th>
                <th className="text-right px-4 py-3 text-[#CBD5E1] font-medium">Net Earnings</th>
                <th className="text-center px-4 py-3 text-[#CBD5E1] font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-[#F1F5F9]/5 hover:bg-[#F1F5F9]/5 transition-colors"
                >
                  <td className="px-4 py-3 text-[#CBD5E1]">{row.date}</td>
                  <td className="px-4 py-3 text-[#F1F5F9] font-medium">{row.product}</td>
                  <td className="px-4 py-3 text-right text-[#F1F5F9]">
                    ${row.grossRevenue.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-[#F87171]">
                    -${row.commission.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-[#34D399] font-semibold">
                    ${row.net.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        statusStyles[row.status] ?? ""
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-[#F1F5F9]/10 bg-[#0F172A]/50">
                <td colSpan={2} className="px-4 py-3 text-[#F1F5F9] font-semibold text-xs">
                  Totals (shown)
                </td>
                <td className="px-4 py-3 text-right text-[#F1F5F9] font-semibold">
                  ${filtered.reduce((s, r) => s + r.grossRevenue, 0).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right text-[#F87171] font-semibold">
                  -${filtered.reduce((s, r) => s + r.commission, 0).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right text-[#34D399] font-semibold">
                  ${filtered.reduce((s, r) => s + r.net, 0).toFixed(2)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
