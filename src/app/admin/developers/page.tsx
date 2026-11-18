"use client";

import { useMemo, useState } from "react";
import { Check, Globe2, MailCheck, X } from "lucide-react";
import { useAdmin } from "@/components/admin/AdminContext";

type DeveloperStatus = "All" | "pending" | "approved" | "rejected" | "suspended";
const selectClass = "rounded-lg border border-slate-700/80 bg-[#0B1120] px-3 py-2 text-sm text-slate-100 focus:border-teal-400 focus:outline-none";

export default function DeveloperApprovalsPage() {
  const { developers, approveDeveloper, rejectDeveloper, suspendDeveloper } = useAdmin();
  const [filter, setFilter] = useState<DeveloperStatus>("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [action, setAction] = useState<"reject" | "suspend">("reject");
  const [error, setError] = useState("");
  const visible = useMemo(() => filter === "All" ? developers : developers.filter((entry) => entry.status === filter), [developers, filter]);
  const selected = developers.find((entry) => entry.id === selectedId);

  const openReason = (id: string, nextAction: "reject" | "suspend") => {
    setSelectedId(id);
    setAction(nextAction);
    setReason("");
    setError("");
  };
  const submitReason = () => {
    if (!selectedId || !reason.trim()) {
      setError("Enter a review note before continuing.");
      return;
    }
    if (action === "reject") rejectDeveloper(selectedId, reason);
    else suspendDeveloper(selectedId, reason);
    setSelectedId(null);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-300">Partner onboarding</p><h1 className="mt-1 text-3xl font-bold">Developer Approvals</h1><p className="mt-2 text-sm text-slate-400">Verify developer identities and approve marketplace access.</p></div><label className="text-xs text-slate-400">Application status<select value={filter} onChange={(event) => setFilter(event.target.value as DeveloperStatus)} className={`${selectClass} ml-2`}><option className="bg-[#0B1120] text-slate-100" value="All">All</option><option className="bg-[#0B1120] text-slate-100" value="pending">Pending</option><option className="bg-[#0B1120] text-slate-100" value="approved">Approved</option><option className="bg-[#0B1120] text-slate-100" value="rejected">Rejected</option><option className="bg-[#0B1120] text-slate-100" value="suspended">Suspended</option></select></label></header>
      <div className="overflow-x-auto rounded-2xl border border-slate-700 bg-[#111C2E]">
        <table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b border-slate-700 bg-[#0B1120]/70 text-xs uppercase tracking-wider text-slate-400"><tr>{["Developer", "Email", "Country", "Portfolio", "Submitted", "Status", "Actions"].map((item) => <th key={item} className="px-4 py-3 font-semibold">{item}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-800">{visible.map((developer) => <tr key={developer.id} className="hover:bg-white/[0.02]">
            <td className="px-4 py-4"><p className="font-semibold">{developer.developerName}</p><p className="mt-1 text-xs text-slate-500">{developer.companyName}</p></td>
            <td className="px-4 py-4"><span className="flex items-center gap-1.5 text-xs">{developer.emailVerified ? <MailCheck className="h-4 w-4 text-emerald-300" /> : <MailCheck className="h-4 w-4 text-amber-300" />}{developer.email}</span><p className="mt-1 text-[10px] text-slate-500">{developer.emailVerified ? "Email verified" : "Email not verified"}</p></td>
            <td className="px-4 py-4 text-slate-300">{developer.country}</td>
            <td className="px-4 py-4">{developer.website ? <a href={developer.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-teal-300 hover:underline"><Globe2 className="h-3.5 w-3.5" />Portfolio</a> : <span className="text-xs text-slate-500">Not provided</span>}</td>
            <td className="px-4 py-4 text-xs text-slate-400">{new Date(developer.submittedAt).toLocaleDateString()}</td>
            <td className="px-4 py-4"><span className="rounded-full border border-slate-600 px-2.5 py-1 text-xs capitalize text-slate-300">{developer.status}</span>{developer.reviewNotes && <p className="mt-1 max-w-48 truncate text-[10px] text-slate-500" title={developer.reviewNotes}>{developer.reviewNotes}</p>}</td>
            <td className="px-4 py-4"><div className="flex flex-wrap gap-1.5">{developer.status === "pending" && <><button onClick={() => approveDeveloper(developer.id)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-400/15 px-2.5 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-400/25"><Check className="h-3.5 w-3.5" />Approve</button><button onClick={() => openReason(developer.id, "reject")} className="rounded-lg border border-amber-400/30 px-2.5 py-1.5 text-xs text-amber-200 hover:bg-amber-400/10">Request Info / Reject</button></>}{developer.status === "approved" && <button onClick={() => openReason(developer.id, "suspend")} className="rounded-lg border border-rose-400/30 px-2.5 py-1.5 text-xs text-rose-200 hover:bg-rose-400/10">Suspend</button>}</div></td>
          </tr>)}</tbody>
        </table>
        {visible.length === 0 && <p className="p-8 text-center text-sm text-slate-400">No applications match this filter.</p>}
      </div>
      {selected && <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"><div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-[#111C2E] p-5 shadow-2xl"><div className="mb-4 flex items-center justify-between"><div><p className="text-xs uppercase tracking-wider text-teal-300">{action === "reject" ? "Request information / reject" : "Suspend developer"}</p><h2 className="mt-1 text-lg font-bold">{selected.developerName}</h2></div><button onClick={() => setSelectedId(null)} aria-label="Close" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800"><X className="h-4 w-4" /></button></div><label htmlFor="developer-review-note" className="mb-2 block text-sm text-slate-300">Required review reason</label><textarea id="developer-review-note" rows={4} value={reason} onChange={(event) => setReason(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-[#0B1120] p-3 text-sm text-slate-100 focus:border-teal-400 focus:outline-none" placeholder="Explain what information is missing or why this action is required." />{error && <p className="mt-2 text-sm text-rose-300">{error}</p>}<div className="mt-4 flex justify-end gap-2"><button onClick={() => setSelectedId(null)} className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300">Cancel</button><button onClick={submitReason} className="rounded-lg bg-rose-400 px-3 py-2 text-sm font-bold text-slate-950">{action === "reject" ? "Submit decision" : "Suspend developer"}</button></div></div></div>}
    </div>
  );
}
