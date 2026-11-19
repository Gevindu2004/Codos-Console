"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useDeveloper } from "@/components/developer/DeveloperContext";
import { SubmissionStatusBadge, AuditHistoryModal } from "@/components/developer/ui";
import type { ModelSubmissionPayload } from "@/components/developer/types";
import { Code2, Edit, Eye, Upload } from "lucide-react";
import { IntegrationPanel } from "@/components/developer/IntegrationPanel";
import type { SharedProduct } from "@/lib/marketplaceStore";
import {
  cacheSubmissionForPublish,
  createSubmissionDraftId,
  getPrimarySubmissionAction,
} from "@/components/developer/submissionActions";

export default function MyModels() {
  const { modelProducts, modelSubmissions } = useDeveloper();
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
        <h1 className="text-2xl font-bold text-[#F1F5F9]">My AI Models</h1>
        <p className="text-sm text-[#CBD5E1] mt-1">
          All submitted AI model products across your categories.
        </p>
      </div>

      {/* Table */}
      <div className="bg-[#1E293B] rounded-xl border border-[#F1F5F9]/10 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#F1F5F9]/10">
              <th className="text-left px-4 py-3 text-[#CBD5E1] font-medium">Model Name</th>
              <th className="text-left px-4 py-3 text-[#CBD5E1] font-medium">Category</th>
              <th className="text-left px-4 py-3 text-[#CBD5E1] font-medium">Version</th>
              <th className="text-left px-4 py-3 text-[#CBD5E1] font-medium">Hosting Mode</th>
              <th className="text-left px-4 py-3 text-[#CBD5E1] font-medium">Framework</th>
              <th className="text-center px-4 py-3 text-[#CBD5E1] font-medium">Status</th>
              <th className="text-left px-4 py-3 text-[#CBD5E1] font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {modelSubmissions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-[#CBD5E1]">
                  No models submitted yet.{" "}
                  <a href="/developer/publish" className="text-[#14B8A6] hover:underline">
                    Publish your first AI Model →
                  </a>
                </td>
              </tr>
            ) : (
              modelSubmissions.map((model: ModelSubmissionPayload, idx: number) => {
                const action = getPrimarySubmissionAction(model.status);
                const draftId = createSubmissionDraftId("model", idx);
                const product = modelProducts[idx];
                return (
                <tr
                  key={product?.id ?? idx}
                  className="border-b border-[#F1F5F9]/5 hover:bg-[#F1F5F9]/5 transition-colors"
                >
                  <td className="px-4 py-3 text-[#F1F5F9] font-medium">{model.formA.modelName}</td>
                  <td className="px-4 py-3 text-[#CBD5E1]">{model.formA.category}</td>
                  <td className="px-4 py-3 text-[#CBD5E1]">{model.formA.version}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#F1F5F9]/10 text-[#CBD5E1]">
                      Developer-Hosted
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#CBD5E1]">{model.formA.framework}</td>
                  <td className="px-4 py-3 text-center">
                    <SubmissionStatusBadge status={model.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Link
                        href={`/developer/publish?type=model&draftId=${encodeURIComponent(draftId)}&mode=${action.mode}`}
                        onClick={(event) => {
                          try {
                            cacheSubmissionForPublish(draftId, { type: "model", payload: model });
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
                        onClick={() => openAudit(product?.id ?? model.formA.modelName)}
                        className="flex items-center gap-1 text-[#CBD5E1] hover:text-[#F1F5F9] cursor-pointer"
                      >
                        <Eye className="w-3 h-3" /> Audit
                      </button>
                      {model.status === "Published" && (
                        <button
                          onClick={() => alert(`Unpublish ${model.formA.modelName}`)}
                          className="flex items-center gap-1 text-[#F87171] hover:underline cursor-pointer"
                        >
                          <Upload className="w-3 h-3" /> Unpublish
                        </button>
                      )}
                      {model.status === "Unpublished" && (
                        <button
                          onClick={() => alert(`Republish ${model.formA.modelName}`)}
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
          const product = modelProducts.find((entry) => entry.id === auditTarget);
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
