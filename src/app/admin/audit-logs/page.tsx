"use client";

import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { useAdmin } from "@/components/admin/AdminContext";

const csvCell = (value: string) => `"${value.replace(/"/g, '""')}"`;
const selectClass = "rounded-lg border border-slate-700/80 bg-[#0B1120] px-3 py-2 text-sm text-slate-100 focus:border-teal-400 focus:outline-none";

export default function AuditLogsPage() {
  const { auditEvents } = useAdmin();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [message, setMessage] = useState("");
  const categories = ["Developer", "Submission", "Catalog", "Payout", "Configuration"];
  const visible = useMemo(() => auditEvents.filter((event) =>
    (category === "All" || event.category === category) &&
    `${event.actor} ${event.target} ${event.action} ${event.notes}`.toLowerCase().includes(query.toLowerCase()),
  ), [auditEvents, category, query]);

  const exportCsv = () => {
    const header = ["Timestamp", "Admin Actor", "Category", "Target", "Action", "Status Transition", "Notes"];
    const rows = visible.map((event) => [event.timestamp, event.actor, event.category, event.target, event.action, event.statusTransition ?? "", event.notes]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `codos-governance-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage(`Exported ${visible.length} audit events.`);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-300">Security & compliance</p><h1 className="mt-1 text-3xl font-bold">Governance Audit Log</h1><p className="mt-2 text-sm text-slate-400">Searchable record of platform governance decisions and status changes.</p></div><button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-teal-400"><Download className="h-4 w-4" />Export CSV</button></header>
      <section className="flex flex-wrap gap-2 rounded-2xl border border-slate-700 bg-[#111C2E] p-4"><div className="relative min-w-56 flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search audit log" placeholder="Search actor, target, action, or notes" className="w-full rounded-lg border border-slate-700/80 bg-[#0B1120] py-2 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-teal-400 focus:outline-none" /></div><label className="sr-only" htmlFor="audit-category">Audit category</label><select id="audit-category" value={category} onChange={(event) => setCategory(event.target.value)} className={selectClass}><option className="bg-[#0B1120] text-slate-100" value="All">All categories</option>{categories.map((item) => <option className="bg-[#0B1120] text-slate-100" key={item} value={item}>{item}</option>)}</select>{message && <p role="status" className="self-center text-xs text-emerald-300">{message}</p>}</section>
      <div className="overflow-x-auto rounded-2xl border border-slate-700 bg-[#111C2E]"><table className="w-full min-w-[1000px] text-left text-sm"><thead className="border-b border-slate-700 bg-[#0B1120]/70 text-xs uppercase tracking-wider text-slate-400"><tr>{["Timestamp", "Admin Actor", "Category", "Target", "Action", "Status Transition", "Notes"].map((item) => <th key={item} className="px-4 py-3 font-semibold">{item}</th>)}</tr></thead><tbody className="divide-y divide-slate-800">{visible.map((event) => <tr key={event.id} className="align-top hover:bg-white/[0.02]"><td className="whitespace-nowrap px-4 py-4 text-xs text-slate-400">{new Date(event.timestamp).toLocaleString()}</td><td className="px-4 py-4 text-xs text-slate-300">{event.actor}</td><td className="px-4 py-4"><span className="rounded-full border border-slate-700 px-2 py-1 text-xs">{event.category}</span></td><td className="max-w-40 truncate px-4 py-4 font-mono text-xs text-slate-400" title={event.target}>{event.target}</td><td className="px-4 py-4 font-semibold">{event.action}</td><td className="px-4 py-4 text-xs text-teal-200">{event.statusTransition ?? "—"}</td><td className="max-w-sm px-4 py-4 text-xs leading-relaxed text-slate-400">{event.notes}</td></tr>)}</tbody></table>{visible.length === 0 && <p className="p-8 text-center text-sm text-slate-400">No audit entries match your search.</p>}</div>
    </div>
  );
}
