"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  createSeededAdminState,
  loadAdminState,
  saveAdminState,
} from "@/lib/adminApi";
import {
  readMarketplaceStore,
  sharedProductsToAdmin,
  syncMarketplaceDevelopersFromBackend,
  subscribeMarketplaceStore,
  syncMarketplaceProductsFromBackend,
  updateDeveloperReview,
  updateProductChecks,
  updateProductFeatured,
  updateProductReview,
} from "@/lib/marketplaceStore";
import type {
  AdminState,
  AutomatedCheckKey,
  AutomatedCheckResult,
  GovernanceAuditEvent,
} from "./types";

interface AdminContextValue extends AdminState {
  approveDeveloper: (id: string) => void;
  rejectDeveloper: (id: string, reason: string) => void;
  suspendDeveloper: (id: string, reason: string) => void;
  runAutomatedChecks: (id: string) => void;
  approveAndPublishSubmission: (id: string) => void;
  requestSubmissionChanges: (id: string, note: string) => void;
  rejectSubmission: (id: string, reason: string) => void;
  suspendLiveProduct: (id: string, reason: string) => void;
  republishProduct: (id: string) => void;
  toggleFeaturedProduct: (id: string) => void;
  approvePayout: (id: string) => void;
  markPayoutPaid: (id: string) => void;
  setCommissionRate: (rate: number) => void;
}

const AdminContext = createContext<AdminContextValue | null>(null);

function makeEvent(
  category: GovernanceAuditEvent["category"],
  target: string,
  action: string,
  notes: string,
  statusTransition?: string,
): GovernanceAuditEvent {
  return {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    actor: "admin@codos.console",
    category,
    target,
    action,
    statusTransition,
    notes,
  };
}

function payloadName(item: AdminState["submissions"][number]): string {
  return item.productType === "api"
    ? item.payload.formA.productName
    : item.payload.formA.modelName;
}

function statusOf(item: AdminState["submissions"][number]) {
  return item.payload.status;
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AdminState>(() => {
    const seed = createSeededAdminState();
    return {
      ...seed,
      developers: [],
      submissions: [],
      liveProducts: seed.liveProducts.filter((product) => product.providerType === "via_codos"),
    };
  });
  const stateRef = useRef(state);

  useEffect(() => {
    const applySharedData = () => {
      const current = stateRef.current;
      const shared = readMarketplaceStore();
      const { submissions, liveProducts } = sharedProductsToAdmin(
        shared.products,
        current.liveProducts.filter((product) => product.providerType === "via_codos"),
      );
      const next = { ...current, developers: shared.developers, submissions, liveProducts };
      stateRef.current = next;
      setState(next);
    };
    try {
      const saved = loadAdminState();
      if (saved) {
        const seed = createSeededAdminState();
        const next = {
          ...seed,
          ...saved,
          developers: [],
          submissions: [],
          liveProducts: (saved.liveProducts ?? seed.liveProducts).filter((product) => product.providerType === "via_codos"),
        };
        stateRef.current = next;
        setState(next);
      }
    } catch (error) {
      console.error("Could not load persisted admin portal state.", error);
    }
    applySharedData();
    const unsubscribe = subscribeMarketplaceStore(applySharedData);
    void syncMarketplaceDevelopersFromBackend().then(syncMarketplaceProductsFromBackend);
    return unsubscribe;
  }, []);

  const commit = useCallback((next: AdminState) => {
    const shared = readMarketplaceStore();
    const { submissions, liveProducts } = sharedProductsToAdmin(
      shared.products,
      next.liveProducts.filter((product) => product.providerType === "via_codos"),
    );
    const updated = { ...next, developers: shared.developers, submissions, liveProducts };
    saveAdminState({
      ...updated,
      developers: [],
      submissions: [],
      liveProducts: updated.liveProducts.filter((product) => product.providerType === "via_codos"),
    });
    stateRef.current = updated;
    setState(updated);
  }, []);

  const approveDeveloper = useCallback((id: string) => {
    const current = stateRef.current;
    const application = readMarketplaceStore().developers.find((entry) => entry.id === id);
    if (!application) throw new Error(`Developer application ${id} was not found.`);
    updateDeveloperReview(id, "approved", "Approved by platform administration.");
    const next = {
      ...current,
      auditEvents: [
        makeEvent("Developer", id, "Developer approved", application.developerName, "pending → approved"),
        ...current.auditEvents,
      ],
    };
    commit(next);
  }, [commit]);

  const rejectDeveloper = useCallback((id: string, reason: string) => {
    if (!reason.trim()) throw new Error("A rejection reason is required.");
    const current = stateRef.current;
    const application = readMarketplaceStore().developers.find((entry) => entry.id === id);
    if (!application) throw new Error(`Developer application ${id} was not found.`);
    updateDeveloperReview(id, "rejected", reason.trim());
    commit({
      ...current,
      auditEvents: [
        makeEvent("Developer", id, "Developer rejected", reason.trim(), `${application.status} → rejected`),
        ...current.auditEvents,
      ],
    });
  }, [commit]);

  const suspendDeveloper = useCallback((id: string, reason: string) => {
    if (!reason.trim()) throw new Error("A suspension reason is required.");
    const current = stateRef.current;
    const application = readMarketplaceStore().developers.find((entry) => entry.id === id);
    if (!application) throw new Error(`Developer application ${id} was not found.`);
    updateDeveloperReview(id, "suspended", reason.trim());
    commit({
      ...current,
      auditEvents: [
        makeEvent("Developer", id, "Developer suspended", reason.trim(), `${application.status} → suspended`),
        ...current.auditEvents,
      ],
    });
  }, [commit]);

  const runAutomatedChecks = useCallback((id: string) => {
    const current = stateRef.current;
    const item = current.submissions.find((entry) => entry.id === id);
    if (!item) throw new Error(`Submission ${id} was not found.`);

    const endpoint = item.productType === "api"
      ? item.payload.formB.baseUrl
      : item.payload.formB.inferenceEndpoint ?? "";
    const schema = item.productType === "api"
      ? item.payload.formC.openApiSpec
      : item.payload.formC.schemaJson ?? "";
    const authMethod = item.productType === "api" ? item.payload.formD.authMethod : item.payload.formB.authMethod;
    const legalComplete = item.productType === "api"
      ? item.payload.formF.ownershipConfirmed && item.payload.formF.commissionAccepted
      : item.payload.formF.ownershipConfirmed && item.payload.formF.prohibitedUseAgreement;

    const check = (status: AutomatedCheckResult["status"], summary: string): AutomatedCheckResult => ({
      status,
      summary,
      checkedAt: new Date().toISOString(),
    });
    const checks: Record<AutomatedCheckKey, AutomatedCheckResult> = {
      httpsEndpoint: endpoint.startsWith("https://")
        ? check("pass", "Secure HTTPS endpoint is configured.")
        : check("fail", "A secure HTTPS endpoint is required."),
      schemaValidation: (() => {
        try {
          if (!schema.trim()) return check("fail", "No API or model schema was provided.");
          if (item.productType === "api") JSON.parse(schema);
          else JSON.parse(schema);
          return check("pass", "Schema is present and valid JSON.");
        } catch {
          return item.productType === "api" && /openapi|swagger/i.test(schema)
            ? check("warn", "OpenAPI document found; full parser validation is pending.")
            : check("fail", "Schema could not be parsed as JSON.");
        }
      })(),
      authSecurity: authMethod === "none"
        ? check("warn", "No authentication is configured; verify public access is intended.")
        : check("pass", "Authentication configuration is present."),
      sandboxInference: endpoint
        ? check("pass", "Sandbox endpoint or bundle is configured for test execution.")
        : check("fail", "No endpoint or bundle is configured for sandbox testing."),
      legalCompliance: legalComplete
        ? check("pass", "Ownership and marketplace declarations are confirmed.")
        : check("fail", "Required ownership or marketplace declarations are incomplete."),
    };
    const hasFailures = Object.values(checks).some((result) => result.status === "fail");
    const nextStatus: AdminState["submissions"][number]["payload"]["status"] = hasFailures ? "Changes Requested" : "Under Review";
    const checkSummary = hasFailures
      ? "Automated checks found issues that require review."
      : "Automated checks completed; awaiting admin review.";
    updateProductChecks(id, checks, nextStatus, checkSummary);
    const next = {
      ...current,
      auditEvents: [
        makeEvent(
          "Submission",
          id,
          "Automated checks completed",
          `${Object.values(checks).filter((result) => result.status === "pass").length} passed, ${Object.values(checks).filter((result) => result.status === "warn").length} warnings, ${Object.values(checks).filter((result) => result.status === "fail").length} failed. ${checkSummary}`,
          `${statusOf(item)} → Validating → Testing → ${nextStatus}`,
        ),
        ...current.auditEvents,
      ],
    };
    commit(next);
  }, [commit]);

  const approveAndPublishSubmission = useCallback((id: string) => {
    const current = stateRef.current;
    const item = current.submissions.find((entry) => entry.id === id);
    if (!item) throw new Error(`Submission ${id} was not found.`);
    if (item.payload.status !== "Under Review" && item.payload.status !== "Approved") {
      throw new Error("Only submissions that have completed checks and reached review can be published.");
    }
    if (Object.values(item.automatedChecks).some((result) => result.status === "pending" || result.status === "fail")) {
      throw new Error("Automated checks must be complete with no failures before publication.");
    }
    const name = payloadName(item);
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const liveProduct = {
      id: item.id,
      slug,
      name,
      productType: item.productType,
      providerType: item.providerType,
      developerName: item.developerName,
      status: "Published" as const,
      featured: false,
      updatedAt: new Date().toISOString(),
      submissionId: item.id,
    };
    updateProductReview(id, "Published", "");
    commit({
      ...current,
      liveProducts: [liveProduct, ...current.liveProducts.filter((entry) => entry.id !== item.id)],
      auditEvents: [
        makeEvent("Submission", id, "Submission approved and published", name, `${item.payload.status} → Approved → Published`),
        ...current.auditEvents,
      ],
    });
  }, [commit]);

  const requestSubmissionChanges = useCallback((id: string, note: string) => {
    if (!note.trim()) throw new Error("A structured change request note is required.");
    const current = stateRef.current;
    const item = current.submissions.find((entry) => entry.id === id);
    if (!item) throw new Error(`Submission ${id} was not found.`);
    updateProductReview(id, "Changes Requested", note.trim());
    commit({
      ...current,
      auditEvents: [
        makeEvent("Submission", id, "Changes requested", note.trim(), `${item.payload.status} → Changes Requested`),
        ...current.auditEvents,
      ],
    });
  }, [commit]);

  const rejectSubmission = useCallback((id: string, reason: string) => {
    if (!reason.trim()) throw new Error("A rejection reason is required.");
    const current = stateRef.current;
    const item = current.submissions.find((entry) => entry.id === id);
    if (!item) throw new Error(`Submission ${id} was not found.`);
    updateProductReview(id, "Rejected", reason.trim());
    commit({
      ...current,
      auditEvents: [
        makeEvent("Submission", id, "Submission rejected", reason.trim(), `${item.payload.status} → Rejected`),
        ...current.auditEvents,
      ],
    });
  }, [commit]);

  const suspendLiveProduct = useCallback((id: string, reason: string) => {
    if (!reason.trim()) throw new Error("A compliance reason is required.");
    const current = stateRef.current;
    const product = current.liveProducts.find((entry) => entry.id === id);
    if (!product) throw new Error(`Catalog product ${id} was not found.`);
    if (product.providerType === "third_party") {
      updateProductReview(product.submissionId ?? product.id, "Suspended", reason.trim());
    }
    commit({
      ...current,
      liveProducts: product.providerType === "via_codos"
        ? current.liveProducts.map((entry) =>
            entry.id === id ? { ...entry, status: "Suspended" as const, complianceReason: reason.trim(), updatedAt: new Date().toISOString() } : entry,
          )
        : current.liveProducts,
      auditEvents: [
        makeEvent("Catalog", id, "Live product suspended", reason.trim(), `${product.status} → Suspended`),
        ...current.auditEvents,
      ],
    });
  }, [commit]);

  const republishProduct = useCallback((id: string) => {
    const current = stateRef.current;
    const product = current.liveProducts.find((entry) => entry.id === id);
    if (!product) throw new Error(`Catalog product ${id} was not found.`);
    if (product.status !== "Suspended" && product.status !== "Unpublished") {
      throw new Error("Only suspended or unpublished products can be republished.");
    }
    if (product.providerType === "third_party") {
      updateProductReview(product.submissionId ?? product.id, "Published", "");
    }
    commit({
      ...current,
      liveProducts: product.providerType === "via_codos"
        ? current.liveProducts.map((entry) =>
            entry.id === id ? { ...entry, status: "Published" as const, complianceReason: undefined, updatedAt: new Date().toISOString() } : entry,
          )
        : current.liveProducts,
      auditEvents: [
        makeEvent("Catalog", id, "Product republished", product.name, `${product.status} → Published`),
        ...current.auditEvents,
      ],
    });
  }, [commit]);

  const toggleFeaturedProduct = useCallback((id: string) => {
    const current = stateRef.current;
    const product = current.liveProducts.find((entry) => entry.id === id);
    if (!product) throw new Error(`Catalog product ${id} was not found.`);
    const featured = !product.featured;
    if (product.providerType === "third_party") updateProductFeatured(id, featured);
    commit({
      ...current,
      liveProducts: current.liveProducts.map((entry) =>
        entry.id === id ? { ...entry, featured, updatedAt: new Date().toISOString() } : entry,
      ),
      auditEvents: [
        makeEvent("Catalog", id, featured ? "Product featured" : "Product unfeatured", product.name),
        ...current.auditEvents,
      ],
    });
  }, [commit]);

  const approvePayout = useCallback((id: string) => {
    const current = stateRef.current;
    const payout = current.payouts.find((entry) => entry.id === id);
    if (!payout) throw new Error(`Payout ${id} was not found.`);
    if (payout.status !== "Pending Approval") throw new Error("Only pending payouts can be approved.");
    commit({
      ...current,
      payouts: current.payouts.map((entry) =>
        entry.id === id ? { ...entry, status: "Processing" as const } : entry,
      ),
      auditEvents: [
        makeEvent("Payout", id, "Payout approved", `${payout.developerName}: $${payout.netPayout.toFixed(2)}`, "Pending Approval → Processing"),
        ...current.auditEvents,
      ],
    });
  }, [commit]);

  const markPayoutPaid = useCallback((id: string) => {
    const current = stateRef.current;
    const payout = current.payouts.find((entry) => entry.id === id);
    if (!payout) throw new Error(`Payout ${id} was not found.`);
    if (payout.status !== "Processing") throw new Error("Only processing payouts can be marked paid.");
    commit({
      ...current,
      payouts: current.payouts.map((entry) =>
        entry.id === id ? { ...entry, status: "Paid" as const } : entry,
      ),
      auditEvents: [
        makeEvent("Payout", id, "Payout marked paid", payout.reference, "Processing → Paid"),
        ...current.auditEvents,
      ],
    });
  }, [commit]);

  const setCommissionRate = useCallback((rate: number) => {
    if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
      throw new Error("Commission rate must be between 0% and 100%.");
    }
    const current = stateRef.current;
    commit({
      ...current,
      commissionRate: rate,
      auditEvents: [
        makeEvent("Configuration", "platform-commission", "Commission rate updated", `${(rate * 100).toFixed(1)}%`),
        ...current.auditEvents,
      ],
    });
  }, [commit]);

  const value = useMemo<AdminContextValue>(
    () => ({
      ...state,
      approveDeveloper,
      rejectDeveloper,
      suspendDeveloper,
      runAutomatedChecks,
      approveAndPublishSubmission,
      requestSubmissionChanges,
      rejectSubmission,
      suspendLiveProduct,
      republishProduct,
      toggleFeaturedProduct,
      approvePayout,
      markPayoutPaid,
      setCommissionRate,
    }),
    [
      state,
      approveDeveloper,
      rejectDeveloper,
      suspendDeveloper,
      runAutomatedChecks,
      approveAndPublishSubmission,
      requestSubmissionChanges,
      rejectSubmission,
      suspendLiveProduct,
      republishProduct,
      toggleFeaturedProduct,
      approvePayout,
      markPayoutPaid,
      setCommissionRate,
    ],
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin(): AdminContextValue {
  const context = useContext(AdminContext);
  if (!context) throw new Error("useAdmin must be used within an AdminProvider.");
  return context;
}
