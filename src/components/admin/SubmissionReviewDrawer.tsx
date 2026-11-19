"use client";

import { useState } from "react";
import { CheckCircle2, CircleAlert, X, XCircle } from "lucide-react";
import { useAdmin } from "./AdminContext";
import type { AdminSubmissionItem, AutomatedCheckKey } from "./types";
import { CommercialSignOffModal } from "@/components/developer/CommercialSignOffModal";

const checkLabels: Record<AutomatedCheckKey, string> = {
  httpsEndpoint: "HTTPS & SSL Check",
  schemaValidation: "OpenAPI / I-O Schema Lint",
  authSecurity: "Authentication Security",
  sandboxInference: "Health Check / Sandbox Latency",
  legalCompliance: "License & Legal URL Verification",
};

const sections = [
  ["A. Product information", "formA"],
  ["B. Hosting / endpoint or bundle", "formB"],
  ["C. OpenAPI or input/output schema", "formC"],
  ["D. Authentication or samples", "formD"],
  ["E. Pricing", "formE"],
  ["F. Legal & compliance", "formF"],
] as const;

function statusColor(status: string) {
  if (status === "pass") return "text-emerald-300 border-emerald-400/30 bg-emerald-400/10";
  if (status === "warn") return "text-amber-300 border-amber-400/30 bg-amber-400/10";
  if (status === "fail") return "text-rose-300 border-rose-400/30 bg-rose-400/10";
  return "text-slate-400 border-slate-700 bg-slate-800/60";
}

export function SubmissionReviewDrawer({
  submission,
  onClose,
}: {
  submission: AdminSubmissionItem | null;
  onClose: () => void;
}) {
  const {
    runAutomatedChecks,
    approveAndPublishSubmission,
    requestSubmissionChanges,
    rejectSubmission,
  } = useAdmin();
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [commercialSignoffOpen, setCommercialSignoffOpen] = useState(false);

  if (!submission) return null;

  const productName = submission.productType === "api"
    ? submission.payload.formA.productName
    : submission.payload.formA.modelName;
  const hasRunChecks = Object.values(submission.automatedChecks).some((item) => item.status !== "pending");
  const canPublish = submission.payload.status === "Under Review" &&
    Object.values(submission.automatedChecks).every((item) => item.status === "pass" || item.status === "warn");

  const execute = (action: () => void) => {
    try {
      action();
      setError("");
      setFeedback("");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "The action could not be completed.");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex justify-end bg-black/70 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Submission review">
      <button className="absolute inset-0 cursor-default" aria-label="Close review" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-3xl flex-col border-l border-slate-700 bg-[#0F172A] shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-700 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-300">Submission review · {submission.productType.toUpperCase()}</p>
            <h2 className="mt-1 text-xl font-bold text-slate-100">{productName}</h2>
            <p className="mt-1 text-sm text-slate-400">{submission.developerName} · {submission.payload.status}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close"><X className="h-5 w-5" /></button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <section className="rounded-2xl border border-slate-700 bg-[#111C2E] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-100">Automated validation & sandbox checks</h3>
                <p className="mt-1 text-xs text-slate-400">Simulated review checks; production verification requires the admin API.</p>
              </div>
              <button onClick={() => execute(() => runAutomatedChecks(submission.id))} className="rounded-lg bg-teal-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-teal-300">
                {hasRunChecks ? "Run Checks Again" : "Run Automated Validation & Sandbox Checks"}
              </button>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {(Object.entries(submission.automatedChecks) as [AutomatedCheckKey, (typeof submission.automatedChecks)[AutomatedCheckKey]][]).map(([key, result]) => (
                <div key={key} className={`flex items-start gap-2 rounded-xl border px-3 py-2 ${statusColor(result.status)}`}>
                  {result.status === "pass" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : result.status === "fail" ? <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />}
                  <div><p className="text-xs font-semibold">{checkLabels[key]}</p><p className="mt-0.5 text-[11px] opacity-80">{result.summary}</p></div>
                </div>
              ))}
            </div>
          </section>

          {sections.map(([label, key]) => (
            <section key={key} className="rounded-2xl border border-slate-700 bg-[#111C2E] p-4">
              <h3 className="mb-3 text-sm font-bold text-slate-200">{label}</h3>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-[#0B1120] p-3 font-mono text-xs leading-relaxed text-slate-300">
                {JSON.stringify(submission.payload[key], null, 2)}
              </pre>
            </section>
          ))}

          <section className="rounded-2xl border border-slate-700 bg-[#111C2E] p-4">
            <label htmlFor="review-feedback" className="mb-2 block text-sm font-semibold text-slate-200">Reviewer feedback note</label>
            <textarea id="review-feedback" value={feedback} onChange={(event) => setFeedback(event.target.value)} rows={3} placeholder="Required for requesting changes or rejecting. Include actionable findings." className="w-full rounded-xl border border-slate-700 bg-[#0B1120] p-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-teal-400 focus:outline-none" />
            {error && <p className="mt-2 text-sm text-rose-300">{error}</p>}
          </section>
        </div>

        <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-700 bg-[#0B1120] px-6 py-4">
          <button onClick={() => execute(() => requestSubmissionChanges(submission.id, feedback))} className="rounded-lg border border-amber-400/50 px-3.5 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-400/10">Request Changes</button>
          <button onClick={() => execute(() => rejectSubmission(submission.id, feedback))} className="rounded-lg border border-rose-400/50 px-3.5 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-400/10">Reject</button>
          {submission.payload.status === "Approved" && (
            <button onClick={() => setCommercialSignoffOpen(true)} className="rounded-lg bg-teal-400 px-3.5 py-2 text-sm font-bold text-slate-950 hover:bg-teal-300">
              Sign Agreement &amp; Set Pricing
            </button>
          )}
          {canPublish && (
            <button onClick={() => execute(() => approveAndPublishSubmission(submission.id))} className="rounded-lg bg-teal-400 px-3.5 py-2 text-sm font-bold text-slate-950 hover:bg-teal-300">
              Approve for Agreement &amp; Pricing
            </button>
          )}
        </footer>
        {commercialSignoffOpen && (
          <CommercialSignOffModal
            product={submission}
            onClose={() => setCommercialSignoffOpen(false)}
          />
        )}
      </aside>
    </div>
  );
}
