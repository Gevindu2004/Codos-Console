"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Copy, X } from "lucide-react";
import type { SharedProduct } from "@/lib/marketplaceStore";

type IntegrationPanelProps = {
  product: SharedProduct;
  onClose: () => void;
  confirmation?: boolean;
  onSubmitAnother?: () => void;
};

const snippetTabs = [
  { key: "curl", label: "cURL" },
  { key: "python", label: "Python" },
  { key: "typescript", label: "TypeScript" },
] as const;

export function IntegrationPanel({
  product,
  onClose,
  confirmation = false,
  onSubmitAnother,
}: IntegrationPanelProps) {
  const [activeTab, setActiveTab] = useState<(typeof snippetTabs)[number]["key"]>("curl");
  const [copied, setCopied] = useState("");
  const [copyError, setCopyError] = useState("");
  const [publicUrl, setPublicUrl] = useState(`http://localhost:3000${product.publicPageUrl}`);
  const destination = product.productType === "api" ? "/developer/apis" : "/developer/models";
  const destinationLabel = product.productType === "api" ? "View in My APIs" : "View in My Models";

  useEffect(() => {
    setPublicUrl(new URL(product.publicPageUrl, window.location.origin).toString());
  }, [product.publicPageUrl]);

  const copy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setCopyError("");
      window.setTimeout(() => setCopied(""), 1600);
    } catch {
      setCopied("");
      setCopyError("Copy failed. Select and copy the text manually.");
    }
  };

  const copyButton = (value: string, key: string, label: string) => (
    <button
      type="button"
      onClick={() => void copy(value, key)}
      className="inline-flex items-center gap-1.5 rounded-md border border-slate-600 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 hover:border-teal-400 hover:text-teal-300"
    >
      {copied === key ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied === key ? "Copied" : label}
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="integration-panel-title"
    >
      <section className="my-auto w-full max-w-3xl rounded-2xl border border-slate-700 bg-[#111827] p-5 text-slate-100 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="integration-panel-title" className="text-xl font-bold">
              {confirmation ? "Submission Confirmation & Integration" : "Integration / Code"}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              CODOS gateway links and starter code for {product.productType === "api" ? "this API" : "this AI Model"}.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close integration panel" className="rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {confirmation && (
          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
            <span className="rounded-full bg-amber-400/15 px-3 py-1 text-xs font-semibold text-amber-300">
              Submitted — Pending Admin Review
            </span>
            <span className="break-all font-mono text-xs text-slate-300">
              Product ID: {product.marketplaceProductId ?? product.id}
            </span>
            <span className="break-all font-mono text-xs text-slate-300">Slug: {product.slug}</span>
          </div>
        )}

        <div className="mt-5 space-y-3">
          <h3 className="text-sm font-semibold">Saved Platform Links</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "CODOS Gateway Proxy URL", value: product.gatewayUrl },
              { label: "Marketplace Listing URL", value: publicUrl },
            ].map((link) => (
              <div key={link.label} className="min-w-0 rounded-lg border border-slate-700 bg-slate-900 p-3">
                <div className="mb-2 text-[11px] font-medium text-slate-400">{link.label}</div>
                <div className="flex items-center justify-between gap-2">
                  <code className="min-w-0 break-all text-xs text-teal-300">{link.value}</code>
                  {copyButton(link.value, link.label, "Copy")}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Basic Integration Code</h3>
            <div className="flex gap-1 rounded-lg bg-slate-900 p-1" role="tablist" aria-label="Code language">
              {snippetTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                    activeTab === tab.key ? "bg-teal-400 text-slate-950" : "text-slate-300 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-2 overflow-hidden rounded-lg border border-slate-700 bg-[#070B14]">
            <div className="flex justify-end border-b border-slate-700 p-2">
              {copyButton(product.integrationSnippets[activeTab], "snippet", "Copy Code")}
            </div>
            <pre className="max-h-72 overflow-auto p-4 text-xs leading-5 text-slate-200">
              <code>{product.integrationSnippets[activeTab]}</code>
            </pre>
          </div>
        </div>
        {copyError && <p role="alert" className="mt-3 text-xs text-rose-300">{copyError}</p>}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          {confirmation && onSubmitAnother ? (
            <>
              <Link
                href={destination}
                onClick={onClose}
                className="rounded-lg border border-teal-400/50 px-4 py-2 text-xs font-semibold text-teal-300 hover:bg-teal-400/10"
              >
                {destinationLabel}
              </Link>
              <button
                type="button"
                onClick={onSubmitAnother}
                className="rounded-lg bg-teal-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-teal-300"
              >
                Submit Another Product
              </button>
            </>
          ) : (
            <button type="button" onClick={onClose} className="rounded-lg bg-teal-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-teal-300">
              Close
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
