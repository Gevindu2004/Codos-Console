"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Search } from "lucide-react";
import { SubmissionReviewDrawer } from "@/components/admin/SubmissionReviewDrawer";
import { CommercialSignOffModal } from "@/components/developer/CommercialSignOffModal";
import { useAdmin } from "@/components/admin/AdminContext";
import type { AdminSubmissionItem } from "@/components/admin/types";

const selectClass = "rounded-lg border border-slate-700/80 bg-[#0B1120] px-3 py-2 text-sm text-slate-100 focus:border-teal-400 focus:outline-none";
const statuses = ["Submitted", "Validating", "Testing", "Under Review", "Changes Requested", "Approved", "Rejected"];

function getName(item: AdminSubmissionItem) {
  return item.productType === "api" ? item.payload.formA.productName : item.payload.formA.modelName;
}

export default function SubmissionQueuePage() {
  const { submissions } = useAdmin();
  const [type, setType] = useState("All");
  const [status, setStatus] = useState("All");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [commercialTarget, setCommercialTarget] = useState<AdminSubmissionItem | null>(null);

  const visible = useMemo(() => submissions.filter((item) =>
    (type === "All" || item.productType === type) &&
    (status === "All" || item.payload.status === status) &&
    `${getName(item)} ${item.developerName}`.toLowerCase().includes(search.toLowerCase()),
  ), [submissions, type, status, search]);
  const selected = submissions.find((item) => item.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <header><p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-300">Product governance</p><h1 className="mt-1 text-3xl font-bold">Submission Review Queue</h1><p className="mt-2 text-sm text-slate-400">Inspect complete Forms A–F, run checks, and record a review decision.</p></header>
      <section className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-700 bg-[#111C2E] p-4">
        <label className="sr-only" htmlFor="submission-search">Search submissions</label><div className="relative min-w-48 flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" /><input id="submission-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search product or developer" className="w-full rounded-lg border border-slate-700/80 bg-[#0B1120] py-2 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-teal-400 focus:outline-none" /></div>
        <label className="sr-only" htmlFor="submission-type">Product type</label><select id="submission-type" value={type} onChange={(event) => setType(event.target.value)} className={selectClass}><option className="bg-[#0B1120] text-slate-100" value="All">All product types</option><option className="bg-[#0B1120] text-slate-100" value="api">API</option><option className="bg-[#0B1120] text-slate-100" value="model">AI Model</option></select>
        <label className="sr-only" htmlFor="submission-status">Review status</label><select id="submission-status" value={status} onChange={(event) => setStatus(event.target.value)} className={selectClass}><option className="bg-[#0B1120] text-slate-100" value="All">All statuses</option>{statuses.map((item) => <option className="bg-[#0B1120] text-slate-100" key={item} value={item}>{item}</option>)}</select>
      </section>
      <div className="overflow-x-auto rounded-2xl border border-slate-700 bg-[#111C2E]">
        <table className="w-full min-w-[850px] text-left text-sm"><thead className="border-b border-slate-700 bg-[#0B1120]/70 text-xs uppercase tracking-wider text-slate-400"><tr>{["Product", "Developer", "Type", "Hosting", "Submitted", "Status", "Review"].map((item) => <th key={item} className="px-4 py-3 font-semibold">{item}</th>)}</tr></thead><tbody className="divide-y divide-slate-800">{visible.map((item) => <tr key={item.id} className="hover:bg-white/[0.02]"><td className="px-4 py-4"><p className="font-semibold">{getName(item)}</p><p className="mt-1 text-[10px] text-slate-500">{item.id}</p></td><td className="px-4 py-4 text-slate-300">{item.developerName}</td><td className="px-4 py-4 uppercase text-xs text-slate-400">{item.productType === "api" ? "API" : "AI Model"}</td><td className="px-4 py-4 text-xs text-slate-400">Developer-Hosted</td><td className="px-4 py-4 text-xs text-slate-400">{new Date(item.submittedAt).toLocaleDateString()}</td><td className="px-4 py-4"><span className="rounded-full border border-slate-600 px-2.5 py-1 text-xs text-slate-300">{item.payload.status}</span></td><td className="px-4 py-4"><div className="flex flex-wrap gap-2"><button onClick={() => setSelectedId(item.id)} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-400/15 px-3 py-2 text-xs font-bold text-teal-200 hover:bg-teal-400/25">Inspect & Review<ExternalLink className="h-3.5 w-3.5" /></button>{item.payload.status === "Approved" && <button onClick={() => setCommercialTarget(item)} className="rounded-lg bg-teal-400 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-teal-300">Sign Agreement &amp; Set Pricing</button>}</div></td></tr>)}</tbody></table>
        {visible.length === 0 && <p className="p-8 text-center text-sm text-slate-400">No submissions match these filters.</p>}
      </div>
      <SubmissionReviewDrawer submission={selected} onClose={() => setSelectedId(null)} />
      {commercialTarget && (
        <CommercialSignOffModal
          product={commercialTarget}
          onClose={() => setCommercialTarget(null)}
        />
      )}
    </div>
  );
}
