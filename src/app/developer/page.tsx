// src/app/developer/page.tsx
"use client";

import React from "react";
import { useDeveloper } from "@/components/developer/DeveloperContext";
import { KpiCard, SubmissionStatusBadge, RequirementsBanner, AuditHistoryModal } from "@/components/developer/ui";
import { Package, Code2, BarChart3, CreditCard } from "lucide-react";
import type { ApiSubmissionPayload, ModelSubmissionPayload } from "@/components/developer/types";

type AnySubmission = ApiSubmissionPayload | ModelSubmissionPayload;

function getSubmissionName(sub: AnySubmission): string {
  if ("productName" in sub.formA) return (sub.formA as ApiSubmissionPayload["formA"]).productName;
  return (sub.formA as ModelSubmissionPayload["formA"]).modelName;
}

export default function DeveloperDashboard() {
  const {
    profile,
    apiSubmissions,
    modelSubmissions,
    notifications,
  } = useDeveloper();

  // Simple derived metrics
  const totalPublished = [
    ...apiSubmissions.filter((p) => p.status === "Published"),
    ...modelSubmissions.filter((p) => p.status === "Published"),
  ].length;
  const totalRequests = apiSubmissions.reduce((sum, p) => sum + (p.formE?.monthlyLimit ?? 0), 0);
  const totalInferences = modelSubmissions.reduce((sum, p) => sum + (p.formE?.rate ?? 0), 0);

  const pendingReviews: AnySubmission[] = [
    ...apiSubmissions.filter((p) => p.status === "Under Review" || p.status === "Changes Requested"),
    ...modelSubmissions.filter((p) => p.status === "Under Review" || p.status === "Changes Requested"),
  ];

  const [auditOpen, setAuditOpen] = React.useState(false);
  const [auditEntries, setAuditEntries] = React.useState<{ timestamp: string; actor: string; action: string }[]>([]);

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div>
        <h1 className="text-2xl font-bold text-[#F1F5F9] mb-1">Developer Dashboard</h1>
        <p className="text-sm text-[#CBD5E1]">
          Welcome back, <span className="text-[#14B8A6] font-semibold">{profile?.developerName ?? "Developer"}</span>
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Published Products" value={totalPublished} icon={<Package />} />
        <KpiCard title="API Requests (mo)" value={totalRequests.toLocaleString()} icon={<Code2 />} />
        <KpiCard title="Model Inferences (mo)" value={totalInferences.toLocaleString()} icon={<BarChart3 />} />
        <KpiCard title="Net Earnings" value="$1,088.00" icon={<CreditCard />} />
      </div>

      {/* Submission Pipeline */}
      <section>
        <h2 className="text-lg font-semibold text-[#F1F5F9] mb-3">Active Submissions</h2>
        {pendingReviews.length === 0 ? (
          <div className="text-sm text-[#CBD5E1] p-4 bg-[#1E293B] rounded-xl border border-[#F1F5F9]/10">
            No submissions currently under review.{" "}
            <a href="/developer/publish" className="text-[#14B8A6] hover:underline">
              Publish a new product →
            </a>
          </div>
        ) : (
          <ul className="space-y-2">
            {pendingReviews.map((sub, idx) => (
              <li
                key={idx}
                className="flex items-center justify-between bg-[#1E293B] p-3 rounded-xl border border-[#F1F5F9]/10"
              >
                <span className="text-sm text-[#CBD5E1]">{getSubmissionName(sub)}</span>
                <SubmissionStatusBadge status={sub.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Requirements Callout */}
      <RequirementsBanner
        items={[
          { label: "Verify Email", done: !!profile?.emailVerified },
          { label: "Provide Payout Details", done: !!profile?.payoutMethod && profile.payoutMethod !== "none" },
          { label: "Complete Registration", done: profile?.status === "approved" },
        ]}
      />

      {/* Recent Notifications */}
      <section>
        <h2 className="text-lg font-semibold text-[#F1F5F9] mb-3">Notifications</h2>
        {notifications.length === 0 ? (
          <p className="text-sm text-[#CBD5E1]">No new notifications.</p>
        ) : (
          <ul className="space-y-2">
            {notifications.slice(0, 5).map((n) => (
              <li
                key={n.id}
                className={`flex items-start gap-2 text-sm p-3 rounded-xl border ${
                  n.read
                    ? "bg-[#1E293B] border-[#F1F5F9]/10 text-[#CBD5E1]"
                    : "bg-[#14B8A6]/10 border-[#14B8A6]/30 text-[#F1F5F9]"
                }`}
              >
                {!n.read && (
                  <span className="w-2 h-2 rounded-full bg-[#14B8A6] shrink-0 mt-1.5" />
                )}
                <span>{n.message}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Audit Modal (triggered from other pages, kept here for context provider root) */}
      <AuditHistoryModal
        open={auditOpen}
        onClose={() => setAuditOpen(false)}
        entries={auditEntries}
      />
    </div>
  );
}

