"use client";

import { useMemo, useState } from "react";
import { Download, Save } from "lucide-react";
import { useAdmin } from "@/components/admin/AdminContext";

const money = (amount: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
const csvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

export default function AdminPayoutsPage() {
  const { payouts, commissionRate, approvePayout, markPayoutPaid, setCommissionRate } = useAdmin();
  const [rateInput, setRateInput] = useState(String(commissionRate * 100));
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const totals = useMemo(() => ({
    gross: payouts.reduce((sum, item) => sum + item.grossRevenue, 0),
    fees: payouts.reduce((sum, item) => sum + item.platformFee, 0),
    pending: payouts.filter((item) => item.status !== "Paid").reduce((sum, item) => sum + item.netPayout, 0),
    paid: payouts.filter((item) => item.status === "Paid").reduce((sum, item) => sum + item.netPayout, 0),
  }), [payouts]);

  const saveRate = () => {
    try {
      const percent = Number(rateInput);
      setCommissionRate(percent / 100);
      setError("");
      setMessage("Commission rate saved and audit logged.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save commission rate.");
      setMessage("");
    }
  };
  const exportCsv = () => {
    const headers = ["Payout ID", "Developer", "Period", "Gross Revenue", "Commission Rate", "Platform Fee", "Net Payout", "Method", "Status", "Reference"];
    const rows = payouts.map((item) => [item.id, item.developerName, item.period, item.grossRevenue.toFixed(2), `${(item.commissionRate * 100).toFixed(1)}%`, item.platformFee.toFixed(2), item.netPayout.toFixed(2), item.method, item.status, item.reference]);
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `codos-admin-payouts-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage("Exported!");
  };

  const summary = [
    ["Gross GMV", money(totals.gross)],
    ["Platform Commission Earned", money(totals.fees)],
    ["Pending Developer Payouts", money(totals.pending)],
    ["Disbursed Total", money(totals.paid)],
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-300">Finance governance</p><h1 className="mt-1 text-3xl font-bold">Commissions & Payouts</h1><p className="mt-2 text-sm text-slate-400">Configure the platform fee and review developer disbursements.</p></div><button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-teal-400"><Download className="h-4 w-4" />Export CSV</button></header>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{summary.map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-700 bg-[#111C2E] p-4"><p className="text-xs text-slate-400">{label}</p><p className="mt-2 text-xl font-bold">{value}</p></div>)}</section>
      <section className="flex flex-wrap items-end gap-4 rounded-2xl border border-slate-700 bg-[#111C2E] p-5"><div className="max-w-xs flex-1"><label htmlFor="commission-rate" className="mb-2 block text-sm font-semibold">Platform commission rate</label><div className="flex items-center gap-2"><input id="commission-rate" type="number" min="0" max="100" step="0.5" value={rateInput} onChange={(event) => setRateInput(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-[#0B1120] px-3 py-2 text-sm text-slate-100 focus:border-teal-400 focus:outline-none" /><span className="text-slate-400">%</span></div><p className="mt-1 text-xs text-slate-500">Default platform fee: 15%. Updates are recorded in the governance audit log.</p></div><button onClick={saveRate} className="inline-flex items-center gap-2 rounded-lg bg-teal-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-teal-300"><Save className="h-4 w-4" />Save Rate</button>{error && <p className="w-full text-sm text-rose-300">{error}</p>}{message && <p role="status" className="w-full text-sm text-emerald-300">{message}</p>}</section>
      <div className="overflow-x-auto rounded-2xl border border-slate-700 bg-[#111C2E]"><table className="w-full min-w-[1000px] text-left text-sm"><thead className="border-b border-slate-700 bg-[#0B1120]/70 text-xs uppercase tracking-wider text-slate-400"><tr>{["Developer", "Period", "Gross", "Fee", "Net Payout", "Method", "Status", "Reference", "Actions"].map((item) => <th key={item} className="px-4 py-3 font-semibold">{item}</th>)}</tr></thead><tbody className="divide-y divide-slate-800">{payouts.map((payout) => <tr key={payout.id}><td className="px-4 py-4 font-semibold">{payout.developerName}</td><td className="px-4 py-4 text-slate-300">{payout.period}</td><td className="px-4 py-4">{money(payout.grossRevenue)}</td><td className="px-4 py-4 text-slate-300">{money(payout.platformFee)} <span className="text-[10px] text-slate-500">({(payout.commissionRate * 100).toFixed(0)}%)</span></td><td className="px-4 py-4 font-semibold text-emerald-200">{money(payout.netPayout)}</td><td className="px-4 py-4 text-xs text-slate-400">{payout.method}</td><td className="px-4 py-4"><span className="rounded-full border border-slate-600 px-2.5 py-1 text-xs">{payout.status}</span></td><td className="px-4 py-4 font-mono text-xs text-slate-400">{payout.reference}</td><td className="px-4 py-4">{payout.status === "Pending Approval" ? <button onClick={() => approvePayout(payout.id)} className="rounded-lg bg-teal-400/15 px-3 py-2 text-xs font-bold text-teal-200 hover:bg-teal-400/25">Approve Payout</button> : payout.status === "Processing" ? <button onClick={() => markPayoutPaid(payout.id)} className="rounded-lg bg-emerald-400/15 px-3 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-400/25">Mark as Paid</button> : <span className="text-xs text-slate-500">Complete</span>}</td></tr>)}</tbody></table></div>
    </div>
  );
}
