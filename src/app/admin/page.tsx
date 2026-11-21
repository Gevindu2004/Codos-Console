"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowUpRight, BadgeDollarSign, ClipboardList, Package, Users } from "lucide-react";
import { useAdmin } from "@/components/admin/AdminContext";
import type { SubmissionStatus } from "@/components/developer/types";

const lifecycle: SubmissionStatus[] = ["Draft", "Submitted", "Validating", "Testing", "Under Review", "Changes Requested", "Approved", "Published", "Rejected", "Suspended", "Unpublished"];
const cardClass = "rounded-2xl border border-slate-700 bg-[#111C2E] p-5";
const money = (amount: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
export default function AdminOverviewPage() {
  const { developers, submissions, liveProducts, payouts, auditEvents } = useAdmin();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => setNow(Date.now()), 0);
    return () => window.clearTimeout(timer);
  }, []);
  const pendingDevelopers = developers.filter((entry) => entry.status === "pending").length;
  const inReview = submissions.filter((entry) => ["Submitted", "Validating", "Testing", "Under Review"].includes(entry.payload.status)).length;
  const liveCount = liveProducts.filter((entry) => entry.status === "Published").length;
  const commission = payouts.reduce((sum, payout) => sum + payout.platformFee, 0);
  const urgent = now === null ? [] : submissions.filter((entry) =>
    ["Submitted", "Under Review"].includes(entry.payload.status) &&
    new Date(entry.submittedAt).getTime() < now - 24 * 60 * 60 * 1000,
  );
  const maxPipelineCount = Math.max(1, ...lifecycle.map((status) => submissions.filter((entry) => entry.payload.status === status).length));

  const stats = [
    { title: "Pending Developer Applications", value: pendingDevelopers, icon: Users, href: "/admin/developers", tone: "text-amber-300" },
    { title: "Submissions Awaiting Review", value: inReview, icon: ClipboardList, href: "/admin/submissions", tone: "text-teal-300" },
    { title: "Live Marketplace Products", value: liveCount, icon: Package, href: "/admin/catalog", tone: "text-sky-300" },
    { title: "Platform Commission Revenue", value: money(commission), icon: BadgeDollarSign, href: "/admin/payouts", tone: "text-emerald-300" },
  ];

  return (
    <div className="space-y-6">
      <header><p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-300">Platform governance</p><h1 className="mt-1 text-3xl font-bold">Governance Overview</h1><p className="mt-2 text-sm text-slate-400">Review partner onboarding, product quality, marketplace health, and financial operations.</p></header>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ title, value, icon: Icon, href, tone }) => <Link key={title} href={href} className={`${cardClass} group hover:border-teal-400/40`}><div className="flex items-center justify-between"><Icon className={`h-5 w-5 ${tone}`} /><ArrowUpRight className="h-4 w-4 text-slate-600 group-hover:text-teal-300" /></div><p className="mt-5 text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-slate-400">{title}</p></Link>)}
      </section>
      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <section className={cardClass}>
          <div className="mb-5 flex items-center justify-between"><div><h2 className="font-bold">11-State Submission Pipeline</h2><p className="mt-1 text-xs text-slate-400">Current product distribution by lifecycle state</p></div><Link href="/admin/submissions" className="text-xs font-semibold text-teal-300 hover:text-teal-200">Open queue →</Link></div>
          <div className="space-y-3">
            {lifecycle.map((status) => {
              const count = submissions.filter((entry) => entry.payload.status === status).length;
              return <div key={status} className="grid grid-cols-[125px_1fr_24px] items-center gap-3 text-xs"><span className="truncate text-slate-400">{status}</span><div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-300" style={{ width: `${(count / maxPipelineCount) * 100}%` }} /></div><span className="text-right font-mono text-slate-300">{count}</span></div>;
            })}
          </div>
        </section>
        <section className={cardClass}>
          <div className="mb-4 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-300" /><h2 className="font-bold">SLA Review Alerts</h2></div>
          {urgent.length === 0 ? <p className="text-sm text-slate-400">No overdue reviews are currently flagged.</p> : <div className="space-y-3">{urgent.map((item) => <Link key={item.id} href="/admin/submissions" className="block rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 hover:bg-amber-400/10"><p className="text-sm font-semibold">{item.productType === "api" ? item.payload.formA.productName : item.payload.formA.modelName}</p><p className="mt-1 text-xs text-amber-200/80">{item.payload.status} · submitted {new Date(item.submittedAt).toLocaleDateString()}</p></Link>)}</div>}
        </section>
      </div>
      <section className={cardClass}>
        <div className="mb-4 flex items-center justify-between"><div><h2 className="font-bold">Recent Governance Activity</h2><p className="mt-1 text-xs text-slate-400">Latest recorded admin decisions</p></div><Link href="/admin/audit-logs" className="text-xs font-semibold text-teal-300">View audit log →</Link></div>
        <div className="divide-y divide-slate-800">{auditEvents.slice(0, 6).map((event) => <div key={event.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><div><p className="text-sm font-semibold">{event.action}</p><p className="mt-0.5 text-xs text-slate-400">{event.target} · {event.notes}</p></div><time className="text-xs text-slate-500">{new Date(event.timestamp).toLocaleString()}</time></div>)}</div>
      </section>
    </div>
  );
}
