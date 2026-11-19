"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useDeveloper } from "@/components/developer/DeveloperContext";
import { SubmissionStatusBadge, AuditHistoryModal } from "@/components/developer/ui";
import type { ApiSubmissionPayload } from "@/components/developer/types";
import { Code2, Edit, Eye, Upload, AlertTriangle } from "lucide-react";
import { IntegrationPanel } from "@/components/developer/IntegrationPanel";
import type { SharedProduct } from "@/lib/marketplaceStore";
import {
  cacheSubmissionForPublish,
  createSubmissionDraftId,
  getPrimarySubmissionAction,
} from "@/components/developer/submissionActions";

export default function MyApis() {
  const { apiProducts, apiSubmissions } = useDeveloper();
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditTarget, setAuditTarget] = useState<string>("");
  const [actionError, setActionError] = useState("");
  const [integrationTarget, setIntegrationTarget] = useState<SharedProduct | null>(null);

  const openAudit = (name: string) => {
    setAuditTarget(name);
    setAuditOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#F1F5F9]">My APIs</h1>
        <p className="text-sm text-[#CBD5E1] mt-1">
          All submitted API products. Editing endpoints, auth, or pricing triggers revalidation.
        </p>
      </div>

      {/* Revalidation warning */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-[#FBBF24]/10 border border-[#FBBF24]/30 text-xs text-[#FBBF24]">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          Editing a published API&apos;s base URL, authentication method, or pricing will reset its status to <strong>Validating</strong> and trigger the full review pipeline again.
        </span>
      </div>

      {/* Table */}
      <div className="bg-[#1E293B] rounded-xl border border-[#F1F5F9]/10 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#F1F5F9]/10">
              <th className="text-left px-4 py-3 text-[#CBD5E1] font-medium">Name</th>
              <th className="text-left px-4 py-3 text-[#CBD5E1] font-medium">Version</th>
              <th className="text-left px-4 py-3 text-[#CBD5E1] font-medium">Hosting Provider</th>
              <th className="text-left px-4 py-3 text-[#CBD5E1] font-medium">Base URL</th>
              <th className="text-center px-4 py-3 text-[#CBD5E1] font-medium">Status</th>
              <th className="text-left px-4 py-3 text-[#CBD5E1] font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {apiSubmissions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-[#CBD5E1]">
                  No APIs submitted yet.{" "}
                  <a href="/developer/publish" className="text-[#14B8A6] hover:underline">
                    Publish your first API →
                  </a>
                </td>
              </tr>
            ) : (
              apiSubmissions.map((api: ApiSubmissionPayload, idx: number) => {
                const action = getPrimarySubmissionAction(api.status);
                const draftId = createSubmissionDraftId("api", idx);
                const product = apiProducts[idx];
                return (
                <tr
                  key={product?.id ?? idx}
                  className="border-b border-[#F1F5F9]/5 hover:bg-[#F1F5F9]/5 transition-colors"
                >
                  <td className="px-4 py-3 text-[#F1F5F9] font-medium">
                    {api.formA.productName}
                  </td>
                  <td className="px-4 py-3 text-[#CBD5E1]">{api.formB.apiVersion ?? "—"}</td>
                  <td className="px-4 py-3 text-[#CBD5E1]">{api.formB.hostingProvider}</td>
                  <td className="px-4 py-3 font-mono text-[#14B8A6] text-[10px] max-w-[180px] truncate">
                    {api.formB.baseUrl}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <SubmissionStatusBadge status={api.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Link
                        href={`/developer/publish?type=api&draftId=${encodeURIComponent(draftId)}&mode=${action.mode}`}
                        onClick={(event) => {
                          try {
                            cacheSubmissionForPublish(draftId, { type: "api", payload: api });
                            setActionError("");
                          } catch {
                            event.preventDefault();
                            setActionError("Could not open this submission. Check browser storage settings and try again.");
                          }
                        }}
                        className="flex items-center gap-1 text-[#14B8A6] hover:underline"
                      >
                        {action.mode === "view" ? <Eye className="w-3 h-3" /> : <Edit className="w-3 h-3" />}
                        {action.label}
                      </Link>
                      {product && (
                        <button
                          onClick={() => setIntegrationTarget(product)}
                          className="flex items-center gap-1 text-[#14B8A6] hover:underline"
                        >
                          <Code2 className="w-3 h-3" /> Integration / Code
                        </button>
                      )}
                      <button
                        onClick={() => openAudit(product?.id ?? api.formA.productName)}
                        className="flex items-center gap-1 text-[#CBD5E1] hover:text-[#F1F5F9] cursor-pointer"
                      >
                        <Eye className="w-3 h-3" /> Audit
                      </button>
                      {api.status === "Published" && (
                        <button
                          onClick={() => alert(`Unpublish ${api.formA.productName}`)}
                          className="flex items-center gap-1 text-[#F87171] hover:underline cursor-pointer"
                        >
                          <Upload className="w-3 h-3" /> Unpublish
                        </button>
                      )}
                      {api.status === "Unpublished" && (
                        <button
                          onClick={() => alert(`Republish ${api.formA.productName}`)}
                          className="flex items-center gap-1 text-[#14B8A6] hover:underline cursor-pointer"
                        >
                          <Upload className="w-3 h-3" /> Republish
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Audit Modal */}
      {actionError && <p role="alert" className="text-xs text-[#F87171]">{actionError}</p>}
      <AuditHistoryModal
        open={auditOpen}
        onClose={() => setAuditOpen(false)}
        entries={(() => {
          const product = apiProducts.find((entry) => entry.id === auditTarget);
          if (!product) return [];
          const currentReview = {
            timestamp: product.updatedAt,
            actor: "CODOS Admin",
            action: `Current status: ${product.payload.status}`,
            details: { status: product.payload.status, reviewNotes: product.reviewNotes || "No review notes." },
          };
          return [currentReview, ...product.auditLogs]
            .sort((left, right) => right.timestamp.localeCompare(left.timestamp));
        })()}
      />
      {integrationTarget && (
        <IntegrationPanel product={integrationTarget} onClose={() => setIntegrationTarget(null)} />
      )}
    </div>
  );
}
