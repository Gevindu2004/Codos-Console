// src/components/developer/ui.tsx
"use client";

import React from "react";
import type { SubmissionStatus } from "./types";

// ----- Status Badge -----
export const SubmissionStatusBadge: React.FC<{ status: SubmissionStatus }>
 = ({ status }) => {
  const colorMap: Record<SubmissionStatus, string> = {
    Draft: "bg-[#14B8A6]/10 text-[#14B8A6]",
    Submitted: "bg-[#14B8A6]/10 text-[#14B8A6]",
    Validating: "bg-[#14B8A6]/10 text-[#14B8A6]",
    Testing: "bg-[#14B8A6]/10 text-[#14B8A6]",
    "Under Review": "bg-[#14B8A6]/10 text-[#14B8A6]",
    "Changes Requested": "bg-[#FBBF24]/10 text-[#FBBF24]",
    Approved: "bg-[#34D399]/10 text-[#34D399]",
    Published: "bg-[#34D399]/10 text-[#34D399]",
    Rejected: "bg-[#F87171]/10 text-[#F87171]",
    Suspended: "bg-[#F87171]/10 text-[#F87171]",
    Unpublished: "bg-[#FBBF24]/10 text-[#FBBF24]",
  };
  const classes = `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorMap[status]}`;
  return <span className={classes}>{status}</span>;
};

// ----- KPI Card -----
export const KpiCard: React.FC<{
  title: string;
  value: string | number;
  icon?: React.ReactNode;
}> = ({ title, value, icon }) => {
  return (
    <div className="flex items-center gap-3 p-4 bg-[#1E293B] rounded-xl shadow-lg">
      {icon && <div className="text-[#14B8A6] text-2xl">{icon}</div>}
      <div>
        <div className="text-xs text-[#CBD5E1]">{title}</div>
        <div className="text-lg font-semibold text-[#F1F5F9]">{value}</div>
      </div>
    </div>
  );
};

// ----- Requirement Checklist Banner -----
export const RequirementsBanner: React.FC<{ items: { label: string; done: boolean }[] }> = ({ items }) => {
  return (
    <div className="border border-[#14B8A6]/30 rounded-lg p-4 bg-[#0F172A]">
      <h3 className="text-sm font-medium text-[#F1F5F9] mb-2">Onboarding Requirements</h3>
      <ul className="space-y-1 text-sm">
        {items.map((it, idx) => (
          <li key={idx} className="flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full ${it.done ? "bg-[#34D399]" : "bg-[#F87171]"}`}
            />
            <span className="text-[#F1F5F9]">{it.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

// ----- Audit History Modal -----
export const AuditHistoryModal: React.FC<{
  open: boolean;
  onClose: () => void;
  entries: { timestamp: string; actor: string; action: string; details?: any }[];
}> = ({ open, onClose, entries }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-2xl bg-[#1E293B] rounded-xl p-6 overflow-auto max-h-[80vh]">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-[#F1F5F9]">Audit History</h2>
          <button onClick={onClose} className="text-[#F1F5F9] hover:text-[#14B8A6]">
            ✕
          </button>
        </div>
        <ul className="space-y-3">
          {entries.map((e, i) => (
            <li key={i} className="text-sm text-[#CBD5E1]">
              <div>
                <span className="font-medium text-[#F1F5F9]">{e.timestamp}</span> – {e.actor} {" "}
                {e.action}
              </div>
              {e.details && (
                <pre className="bg-[#0F172A] p-2 rounded mt-1 overflow-x-auto">
                  {JSON.stringify(e.details, null, 2)}
                </pre>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
