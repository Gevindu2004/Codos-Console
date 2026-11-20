"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BadgeDollarSign,
  ClipboardCheck,
  FileClock,
  LayoutDashboard,
  PackageCheck,
  Users,
} from "lucide-react";
import { AdminProvider, useAdmin } from "@/components/admin/AdminContext";

const links = [
  { href: "/admin", label: "Governance Overview", icon: LayoutDashboard },
  { href: "/admin/developers", label: "Developer Approvals", icon: Users },
  { href: "/admin/submissions", label: "Submission Queue", icon: ClipboardCheck },
  { href: "/admin/catalog", label: "Live Catalog", icon: PackageCheck },
  { href: "/admin/payouts", label: "Commissions & Payouts", icon: BadgeDollarSign },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: FileClock },
];

function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { developers, submissions } = useAdmin();
  const pendingDevelopers = developers.filter((entry) => entry.status === "pending").length;
  const pendingReviews = submissions.filter((entry) =>
    ["Submitted", "Validating", "Testing", "Under Review"].includes(entry.payload.status),
  ).length;

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-700/80 bg-[#0B1120]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/admin" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-400/15 text-teal-300"><Activity className="h-5 w-5" /></span>
            <span><span className="block text-sm font-bold">CODOS Governance</span><span className="block text-[10px] uppercase tracking-[0.18em] text-slate-400">Admin Portal</span></span>
          </Link>
          <nav className="flex flex-wrap gap-2 text-xs font-medium text-slate-300" aria-label="Platform navigation">
            <Link className="rounded-full border border-slate-700 px-3 py-1.5 hover:border-teal-400" href="/console">Console</Link>
            <Link className="rounded-full border border-slate-700 px-3 py-1.5 hover:border-teal-400" href="/models">Model Hub</Link>
            <Link className="rounded-full border border-slate-700 px-3 py-1.5 hover:border-teal-400" href="/apis">API Marketplace</Link>
            <Link className="rounded-full border border-slate-700 px-3 py-1.5 hover:border-teal-400" href="/developer">Developer Portal</Link>
          </nav>
        </div>
      </header>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row">
        <aside className="w-full shrink-0 rounded-2xl border border-slate-700 bg-[#111C2E] p-3 lg:sticky lg:top-24 lg:h-[calc(100vh-7.5rem)] lg:w-64">
          <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Governance</p>
          <nav className="space-y-1">
            {links.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link key={href} href={href} className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition ${active ? "bg-teal-400/15 text-teal-200" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}>
                  <span className="flex items-center gap-3"><Icon className="h-4 w-4" />{label}</span>
                  {href === "/admin/developers" && pendingDevelopers > 0 && <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] text-amber-200">{pendingDevelopers}</span>}
                  {href === "/admin/submissions" && pendingReviews > 0 && <span className="rounded-full bg-teal-400/15 px-2 py-0.5 text-[10px] text-teal-200">{pendingReviews}</span>}
                </Link>
              );
            })}
          </nav>
          <div className="mt-6 rounded-xl border border-teal-400/20 bg-teal-400/5 p-3 text-xs leading-relaxed text-slate-400">
            <p className="mb-1 font-semibold text-teal-200">Admin demo mode</p>
            Actions are persisted in this browser and are not applied to production services.
          </div>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminProvider><AdminShell>{children}</AdminShell></AdminProvider>;
}
