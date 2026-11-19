"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useDeveloper } from "./DeveloperContext";
import { developerApi } from "@/lib/developerApi";
import { upsertMarketplaceProduct, type SharedProduct } from "@/lib/marketplaceStore";
import { IntegrationPanel } from "./IntegrationPanel";
import type {
  ApiSubmissionPayload,
  ModelSubmissionPayload,
  ProductType,
} from "./types";
import type { CachedSubmission, SubmissionMode } from "./submissionActions";

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  readOnly?: boolean;
  hint?: string;
  min?: string;
  max?: string;
  step?: string;
};

const fieldClass =
  "w-full rounded-lg border border-[#F1F5F9]/10 bg-[#0F172A] px-3 py-2 text-sm text-[#F1F5F9] placeholder-[#CBD5E1]/40 focus:border-[#14B8A6] focus:outline-none";
const selectClass =
  "w-full rounded-lg border border-slate-700/80 bg-[#0B1120] px-3 py-2 text-sm text-slate-100 focus:border-teal-400 focus:outline-none";
const optionClass = "bg-[#0B1120] text-slate-100";

function TextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
  readOnly,
  hint,
  min,
  max,
  step,
}: FieldProps) {
  return (
    <label className="block space-y-1.5 text-xs text-[#CBD5E1]">
      <span>
        {label}
        {required && <span className="ml-1 text-[#F87171]">*</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        readOnly={readOnly}
        min={min}
        max={max}
        step={step}
        className={`${fieldClass} ${readOnly ? "opacity-70" : ""}`}
      />
      {hint && <span className="block text-[11px] text-[#CBD5E1]/60">{hint}</span>}
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  required,
  rows = 4,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  hint?: string;
}) {
  return (
    <label className="block space-y-1.5 text-xs text-[#CBD5E1]">
      <span>
        {label}
        {required && <span className="ml-1 text-[#F87171]">*</span>}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        rows={rows}
        className={`${fieldClass} resize-y`}
      />
      {hint && <span className="block text-[11px] text-[#CBD5E1]/60">{hint}</span>}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5 text-xs text-[#CBD5E1]">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={selectClass}
      >
        {children}
      </select>
    </label>
  );
}

function CheckField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2.5 text-xs text-[#CBD5E1]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 accent-[#14B8A6]"
      />
      <span>{label}</span>
    </label>
  );
}

function FormCard({
  id,
  title,
  description,
  highlighted = false,
  children,
}: {
  id: string;
  title: string;
  description: string;
  highlighted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-32 rounded-xl border bg-[#1E293B] p-5 sm:p-6 ${
        highlighted
          ? "border-[#FBBF24]/50 ring-1 ring-[#FBBF24]/20"
          : "border-[#F1F5F9]/10"
      }`}
    >
      <div className="mb-5">
        <h2 className="text-base font-semibold text-[#F1F5F9]">{title}</h2>
        <p className="mt-1 text-xs text-[#CBD5E1]/65">{description}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

const initialApiPayload = (developerId: string): ApiSubmissionPayload => ({
  formA: {
    productName: "",
    shortDescription: "",
    detailedDescription: "",
    category: "",
    logoUrl: "",
    developerId,
  },
  formB: {
    hostingProvider: "",
    baseUrl: "",
    apiVersion: "",
    healthCheckPath: "",
    region: "",
    availabilityPct: undefined,
    rateLimit: undefined,
    timeoutMs: undefined,
  },
  formC: { openApiSpec: "" },
  formD: { authMethod: "", upstreamAuthHeader: "X-API-Key" },
  formE: {
    pricingModel: [],
    pricePerRequest: undefined,
    freeTrialAllowance: undefined,
    monthlyLimit: undefined,
    rpm: undefined,
    maxConcurrency: undefined,
  },
  formF: {
    ownershipConfirmed: false,
    privacyPolicyUrl: "",
    termsOfServiceUrl: "",
    dataHandlingNotes: "",
    commissionAccepted: false,
  },
  status: "Draft",
});

const initialModelPayload = (developerId: string): ModelSubmissionPayload => ({
  formA: {
    modelName: "",
    shortDescription: "",
    detailedDescription: "",
    category: "",
    version: "",
    logoUrl: "",
    developerId,
    useCases: [],
    supportedLanguages: [],
    architecture: "",
    framework: "",
    baseModel: "",
    fineTuned: false,
  },
  formB: {
    authMethod: "none",
    upstreamAuthHeader: "X-API-Key",
    inferenceEndpoint: "",
    hostingProvider: "",
    healthCheckPath: "",
    expectedLatencyMs: undefined,
    availabilityPct: undefined,
    maxRequestSizeMb: undefined,
  },
  formC: {
    inputType: "",
    inputFormats: [],
    maxInputSizeMb: undefined,
    outputType: "",
    outputFormats: [],
    processingMode: "",
    deliveryMethod: "",
    schemaJson: "",
  },
  formD: {
    sampleInputs: [],
    sampleOutputs: [],
    benchmarkScore: undefined,
    maxProcessingTimeMs: undefined,
    knownLimitations: "",
  },
  formE: { billingUnit: "", rate: undefined, limits: "" },
  formF: {
    ownershipConfirmed: false,
    baseModelLicense: "",
    trainingDataRights: "",
    privacyPolicyUrl: "",
    termsOfServiceUrl: "",
    prohibitedUseAgreement: false,
  },
  status: "Draft",
});

type SavedPublishDraft = {
  productType: ProductType | null;
  apiPayload: ApiSubmissionPayload;
  modelPayload: ModelSubmissionPayload;
};

type OriginalSubmission =
  | { type: "api"; payload: ApiSubmissionPayload }
  | { type: "model"; payload: ModelSubmissionPayload };

function numberValue(value: number | undefined) {
  return value === undefined ? "" : String(value);
}

function linesValue(value: string[] | undefined) {
  return value?.join("\n") ?? "";
}

function linesToList(value: string) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function openApiPreview(spec: string) {
  if (!spec.trim()) return "Paste or upload an OpenAPI document to see its parsed preview.";
  try {
    const parsed = JSON.parse(spec) as {
      openapi?: string;
      swagger?: string;
      info?: { title?: string; version?: string };
      paths?: Record<string, unknown>;
    };
    if (!parsed.openapi && !parsed.swagger) {
      return "JSON is valid, but no OpenAPI or Swagger version was found.";
    }
    return `Valid ${parsed.openapi ? `OpenAPI ${parsed.openapi}` : `Swagger ${parsed.swagger}`} document · ${parsed.info?.title ?? "Untitled API"} · ${Object.keys(parsed.paths ?? {}).length} paths`;
  } catch {
    if (/^\s*(openapi|swagger)\s*:/m.test(spec)) {
      const pathCount = Array.from(spec.matchAll(/^\s{0,2}(\/[^:\s]+)\s*:/gm)).length;
      return `YAML document detected · ${pathCount} paths (syntax preview)`;
    }
    return "Could not parse this document as JSON or recognizable OpenAPI YAML.";
  }
}

function schemaPreview(schema: string) {
  if (!schema.trim()) return "Add a JSON schema to preview its input and output definitions.";
  try {
    const parsed = JSON.parse(schema) as Record<string, unknown>;
    return `Valid JSON schema · ${Object.keys(parsed).join(", ") || "no top-level fields"}`;
  } catch {
    return "Schema JSON is invalid. Check commas, quotes, and braces.";
  }
}

export const PublishWizard: React.FC = () => {
  const { profile, saveApiDraft, saveModelDraft } = useDeveloper();
  const { submitMarketplaceApi, submitMarketplaceModel } = developerApi;
  const developerId = profile?.id ?? "";
  const linkedDeveloperId = profile && profile.status !== "unregistered" ? profile.id : "";
  const [productType, setProductType] = useState<ProductType | null>(null);
  const [apiPayload, setApiPayload] = useState<ApiSubmissionPayload>(() =>
    initialApiPayload(linkedDeveloperId)
  );
  const [modelPayload, setModelPayload] = useState<ModelSubmissionPayload>(() =>
    initialModelPayload(linkedDeveloperId)
  );
  const [draftReady, setDraftReady] = useState(false);
  const [notice, setNotice] = useState("");
  const [validationReport, setValidationReport] = useState<string[] | null>(null);
  const [upstreamCredential, setUpstreamCredential] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmationProduct, setConfirmationProduct] = useState<SharedProduct | null>(null);
  const [playgroundInput, setPlaygroundInput] = useState("");
  const [editorMode, setEditorMode] = useState<SubmissionMode | "create">("create");
  const [originalSubmission, setOriginalSubmission] = useState<OriginalSubmission | null>(null);
  const autoSaveErrorShown = useRef(false);

  useEffect(() => {
    if (!developerId) return;
    let cancelled = false;
    const restoreDraft = async () => {
      await Promise.resolve();
      if (cancelled) return;
      try {
        const params = new URLSearchParams(window.location.search);
        const draftId = params.get("draftId") ?? params.get("editId");
        if (draftId) {
          const type = params.get("type");
          const modeParam = params.get("mode");
          const mode: SubmissionMode =
            modeParam === "fix" || modeParam === "edit" || modeParam === "view"
              ? modeParam
              : params.has("editId")
                ? "edit"
                : "resume";
          const cachedValue = sessionStorage.getItem(`codos-submission-${draftId}`);
          if (!cachedValue) {
            setNotice("This submission could not be loaded. Return to the list and try again.");
            setDraftReady(false);
            return;
          }
          const cached = JSON.parse(cachedValue) as CachedSubmission;
          if (cached.type === "api" && type === "api") {
            const payload = cached.payload;
            setApiPayload(payload);
            setProductType("api");
            setOriginalSubmission({ type: "api", payload });
          } else if (cached.type === "model" && type === "model") {
            const payload = cached.payload;
            setModelPayload(payload);
            setProductType("model");
            setOriginalSubmission({ type: "model", payload });
          } else {
            setNotice("This submission link does not match the saved item. Return to the list and try again.");
            setDraftReady(false);
            return;
          }
          setEditorMode(mode);
          setDraftReady(true);
          return;
        }

        setEditorMode("create");
        setOriginalSubmission(null);
        setApiPayload((current) => ({
          ...current,
          formA: { ...current.formA, developerId: linkedDeveloperId },
        }));
        setModelPayload((current) => ({
          ...current,
          formA: { ...current.formA, developerId: linkedDeveloperId },
        }));
        setDraftReady(true);
      } catch {
        setNotice("Could not load the selected saved submission. Return to the list and try again.");
        setDraftReady(false);
      }
    };
    void restoreDraft();
    return () => {
      cancelled = true;
    };
  }, [developerId, linkedDeveloperId]);

  useEffect(() => {
    if (!developerId || !draftReady || !productType || editorMode === "view") return;
    try {
      const draft: SavedPublishDraft = {
        productType,
        apiPayload,
        modelPayload,
      };
      localStorage.setItem(`codos-publish-draft-${developerId}`, JSON.stringify(draft));
      autoSaveErrorShown.current = false;
    } catch {
      if (!autoSaveErrorShown.current) {
        autoSaveErrorShown.current = true;
        window.setTimeout(
          () => setNotice("Auto-save failed. Use Save Draft again or check browser storage settings."),
          0
        );
      }
    }
  }, [apiPayload, developerId, draftReady, editorMode, modelPayload, productType]);

  const updateApiA = (patch: Partial<ApiSubmissionPayload["formA"]>) =>
    setApiPayload((current) => ({ ...current, formA: { ...current.formA, ...patch } }));
  const updateApiB = (patch: Partial<ApiSubmissionPayload["formB"]>) =>
    setApiPayload((current) => ({ ...current, formB: { ...current.formB, ...patch } }));
  const updateApiD = (patch: Partial<ApiSubmissionPayload["formD"]>) =>
    setApiPayload((current) => ({ ...current, formD: { ...current.formD, ...patch } }));
  const updateApiE = (patch: Partial<ApiSubmissionPayload["formE"]>) =>
    setApiPayload((current) => ({ ...current, formE: { ...current.formE, ...patch } }));
  const updateApiF = (patch: Partial<ApiSubmissionPayload["formF"]>) =>
    setApiPayload((current) => ({ ...current, formF: { ...current.formF, ...patch } }));
  const updateModelA = (patch: Partial<ModelSubmissionPayload["formA"]>) =>
    setModelPayload((current) => ({ ...current, formA: { ...current.formA, ...patch } }));
  const updateModelB = (patch: Partial<ModelSubmissionPayload["formB"]>) =>
    setModelPayload((current) => ({ ...current, formB: { ...current.formB, ...patch } }));
  const updateModelC = (patch: Partial<ModelSubmissionPayload["formC"]>) =>
    setModelPayload((current) => ({ ...current, formC: { ...current.formC, ...patch } }));
  const updateModelD = (patch: Partial<ModelSubmissionPayload["formD"]>) =>
    setModelPayload((current) => ({ ...current, formD: { ...current.formD, ...patch } }));
  const updateModelE = (patch: Partial<ModelSubmissionPayload["formE"]>) =>
    setModelPayload((current) => ({ ...current, formE: { ...current.formE, ...patch } }));
  const updateModelF = (patch: Partial<ModelSubmissionPayload["formF"]>) =>
    setModelPayload((current) => ({ ...current, formF: { ...current.formF, ...patch } }));

  const changedCriticalFields = useMemo(() => {
    if (editorMode !== "edit" || !originalSubmission) return [];
    if (originalSubmission.type === "api" && productType === "api") {
      const original = originalSubmission.payload;
      return [
        ...(apiPayload.formB.baseUrl !== original.formB.baseUrl ? ["Base URL"] : []),
        ...(apiPayload.formD.authMethod !== original.formD.authMethod ? ["Authentication"] : []),
        ...(JSON.stringify(apiPayload.formE) !== JSON.stringify(original.formE) ? ["Pricing"] : []),
      ];
    }
    if (originalSubmission.type === "model" && productType === "model") {
      const original = originalSubmission.payload;
      return [
        ...(JSON.stringify(modelPayload.formB) !== JSON.stringify(original.formB) ? ["Model Bundle / Endpoint"] : []),
        ...(JSON.stringify(modelPayload.formC) !== JSON.stringify(original.formC) ? ["Schema"] : []),
        ...(JSON.stringify(modelPayload.formE) !== JSON.stringify(original.formE) ? ["Pricing"] : []),
      ];
    }
    return [];
  }, [apiPayload, editorMode, modelPayload, originalSubmission, productType]);

  const report = useMemo(() => {
    if (productType === "api") {
      const issues: string[] = [];
      if (!apiPayload.formA.productName.trim()) issues.push("Add a product name.");
      if (!apiPayload.formA.shortDescription.trim()) issues.push("Add a short description.");
      if (!apiPayload.formA.detailedDescription.trim()) issues.push("Add a detailed description.");
      if (!apiPayload.formA.category.trim()) issues.push("Choose an API category.");
      if (!apiPayload.formB.hostingProvider.trim()) issues.push("Add the API hosting provider.");
      if (!apiPayload.formB.baseUrl.startsWith("https://")) issues.push("The API base URL must use HTTPS.");
      if (!apiPayload.formB.healthCheckPath?.trim()) issues.push("Add a health check path.");
      if (!apiPayload.formC.openApiSpec.trim()) issues.push("Add an OpenAPI / Swagger document.");
      else if (openApiPreview(apiPayload.formC.openApiSpec).startsWith("Could not")) {
        issues.push("The OpenAPI / Swagger document could not be parsed.");
      }
      if (!apiPayload.formD.authMethod) issues.push("Select an authentication method (choose None if the API is public).");
      if (apiPayload.formD.authMethod !== "none" && !upstreamCredential.trim()) issues.push("Add the upstream authentication credential.");
      if (!apiPayload.formF.ownershipConfirmed) issues.push("Confirm that you own or may distribute this API.");
      if (!apiPayload.formF.commissionAccepted) issues.push("Accept the CODOS commission terms.");
      return issues;
    }
    if (productType === "model") {
      const issues: string[] = [];
      if (!modelPayload.formA.modelName.trim()) issues.push("Add a model name.");
      if (!modelPayload.formA.version.trim()) issues.push("Add a model version.");
      if (!modelPayload.formA.shortDescription.trim()) issues.push("Add a short description.");
      if (!modelPayload.formA.detailedDescription.trim()) issues.push("Add a detailed description.");
      if (!modelPayload.formB.inferenceEndpoint?.startsWith("https://")) issues.push("The developer-hosted inference endpoint must use HTTPS.");
      if (!modelPayload.formB.healthCheckPath?.trim()) issues.push("Add a health check path.");
      if (modelPayload.formB.authMethod !== "none" && !upstreamCredential.trim()) issues.push("Add the upstream authentication credential.");
      if (!modelPayload.formC.inputType) issues.push("Select a model input type.");
      if (!modelPayload.formC.outputType) issues.push("Select a model output type.");
      if (!modelPayload.formC.processingMode) issues.push("Select a processing mode.");
      if (!modelPayload.formC.deliveryMethod) issues.push("Select a result delivery method.");
      if (!modelPayload.formE.billingUnit) issues.push("Select a model billable unit.");
      if (modelPayload.formC.schemaJson?.trim() && schemaPreview(modelPayload.formC.schemaJson).startsWith("Schema JSON is invalid")) {
        issues.push("Fix the input/output schema JSON.");
      }
      if (!modelPayload.formF.ownershipConfirmed) issues.push("Confirm that you own or may distribute this model.");
      if (!modelPayload.formF.prohibitedUseAgreement) issues.push("Accept the prohibited-use policy.");
      return issues;
    }
    return ["Select a product type to begin."];
  }, [apiPayload, modelPayload, productType, upstreamCredential]);

  const handleSaveDraft = () => {
    if (editorMode === "view") return;
    if (!developerId) {
      setNotice("Your developer profile is still loading. Try saving again shortly.");
      return;
    }
    try {
      if (productType === "api") saveApiDraft(apiPayload);
      if (productType === "model") saveModelDraft(modelPayload);
      const draft: SavedPublishDraft = { productType, apiPayload, modelPayload };
      localStorage.setItem(`codos-publish-draft-${developerId}`, JSON.stringify(draft));
      setNotice("Draft saved locally.");
    } catch {
      setNotice("Draft could not be saved. Check browser storage settings and try again.");
    }
  };

  const handleSubmit = async () => {
    if (editorMode === "view" || submitting) return;
    setValidationReport(report);
    if (report.length > 0) {
      setNotice("Complete the items in the Pre-Submission Review Report before submitting.");
      return;
    }
    if (!linkedDeveloperId) {
      setNotice("Register a developer profile before submitting a product.");
      return;
    }
    setSubmitting(true);
    try {
      if (productType === "api") {
        const submitted = { ...apiPayload, status: "Submitted" as const };
        const savedProduct = await submitMarketplaceApi(submitted, upstreamCredential);
        setApiPayload(submitted);
        saveApiDraft(submitted);
        const sharedProduct = upsertMarketplaceProduct(
          submitted,
          profile?.developerName || linkedDeveloperId,
          savedProduct?.id,
          savedProduct,
        );
        setConfirmationProduct(sharedProduct);
        setNotice(savedProduct
          ? "Submission saved to the marketplace for review."
          : "The backend is offline. Your submission is saved locally and can be retried when it is available.");
      } else if (productType === "model") {
        const submitted = { ...modelPayload, status: "Submitted" as const };
        const savedProduct = await submitMarketplaceModel(submitted, upstreamCredential);
        setModelPayload(submitted);
        saveModelDraft(submitted);
        const sharedProduct = upsertMarketplaceProduct(
          submitted,
          profile?.developerName || linkedDeveloperId,
          savedProduct?.id,
          savedProduct,
        );
        setConfirmationProduct(sharedProduct);
        setNotice(savedProduct
          ? "Submission saved to the marketplace for review."
          : "The backend is offline. Your submission is saved locally and can be retried when it is available.");
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Submission could not be saved. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSpecUpload = async (file?: File) => {
    if (!file) return;
    try {
      updateApiC(await file.text());
      setNotice(`${file.name} loaded into the OpenAPI editor.`);
    } catch {
      setNotice(`Could not read ${file.name}. Choose a valid JSON or YAML file.`);
    }
  };

  const updateApiC = (openApiSpec: string) =>
    setApiPayload((current) => ({ ...current, formC: { openApiSpec } }));

  const handleReset = () => {
    setConfirmationProduct(null);
    let cleanupFailed = false;
    const params = new URLSearchParams(window.location.search);
    const submissionId = params.get("draftId") ?? params.get("editId");
    try {
      if (developerId) localStorage.removeItem(`codos-publish-draft-${developerId}`);
    } catch {
      cleanupFailed = true;
    }
    try {
      if (submissionId) sessionStorage.removeItem(`codos-submission-${submissionId}`);
      if (submissionId) {
        window.history.replaceState(window.history.state, "", window.location.pathname);
      }
    } catch {
      cleanupFailed = true;
    }

    setApiPayload(initialApiPayload(linkedDeveloperId));
    setModelPayload(initialModelPayload(linkedDeveloperId));
    setProductType(null);
    setDraftReady(true);
    setEditorMode("create");
    setOriginalSubmission(null);
    setValidationReport(null);
    setUpstreamCredential("");
    setPlaygroundInput("");
    autoSaveErrorShown.current = false;
    setNotice(
      cleanupFailed
        ? "The form was reset, but browser storage could not be fully cleared."
        : "Form reset. You can start a new product submission."
    );
  };

  const isReadOnly = editorMode === "view";

  return (
    <div className="space-y-5 pb-24 text-[#F1F5F9]">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#F1F5F9]">
            {editorMode === "view"
              ? "View Submission"
              : editorMode === "fix"
                ? "Fix & Resubmit"
                : editorMode === "edit"
                  ? "Edit / New Version"
                  : editorMode === "resume"
                    ? "Resume Draft"
                    : "Publish a Product"}
          </h1>
          <p className="mt-1 text-sm text-[#CBD5E1]">
            Submit an API or AI Model to the CODOS Marketplace. Your progress is auto-saved as a draft.
          </p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="rounded-lg border border-[#F87171]/40 px-3 py-2 text-xs font-semibold text-[#F87171] transition-colors hover:bg-[#F87171]/10"
        >
          Clear / Reset Form
        </button>
      </header>
      {editorMode === "fix" && (
        <div className="rounded-lg border border-[#FBBF24]/40 bg-[#FBBF24]/10 p-4 text-xs text-[#FBBF24]">
          <strong>Changes requested.</strong> The submitted item is preloaded for correction and the form is highlighted. Reviewer notes are not attached to this item, so review each section before resubmitting.
        </div>
      )}
      {isReadOnly && (
        <div className="rounded-lg border border-[#14B8A6]/30 bg-[#14B8A6]/10 p-4 text-xs text-[#CBD5E1]">
          <strong className="text-[#14B8A6]">Read-only submission view.</strong> This item is in review; editing and submission actions are unavailable.
        </div>
      )}
      {editorMode === "edit" && changedCriticalFields.length > 0 && (
        <div role="status" className="rounded-lg border border-[#FBBF24]/40 bg-[#FBBF24]/10 p-4 text-xs text-[#FBBF24]">
          <strong>Revalidation required.</strong> Changed critical fields: {changedCriticalFields.join(", ")}. Submitting this version resets its status to Validating.
        </div>
      )}
      <fieldset
        disabled={isReadOnly}
        className={`min-w-0 space-y-5 border-0 p-0 ${
          editorMode === "fix" ? "rounded-xl ring-2 ring-[#FBBF24]/40 p-3" : ""
        }`}
      >
      <section className="rounded-xl border border-[#14B8A6]/25 bg-[#1E293B] p-5">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#CBD5E1]/70">Product type</h2>
        <div className="flex flex-wrap gap-2">
          {(["api", "model"] as const).map((type) => (
            <button
              key={type}
              type="button"
              disabled={editorMode === "edit" || editorMode === "fix"}
              onClick={() => {
                setProductType(type);
                setValidationReport(null);
                setUpstreamCredential("");
              }}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                productType === type
                  ? "bg-[#14B8A6] text-[#0F172A]"
                  : "bg-[#0F172A] text-[#CBD5E1] hover:text-white"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {type === "api" ? "API" : "AI Model"}
            </button>
          ))}
        </div>
        <p className="mt-4 inline-flex rounded-full border border-[#14B8A6]/25 bg-[#14B8A6]/10 px-3 py-2 text-xs text-[#CBD5E1]">
          All third-party APIs and AI Models connect via your HTTPS endpoint through the CODOS API Gateway.
        </p>
      </section>

      <nav
        aria-label="Publish form sections"
        className="sticky top-0 z-20 flex gap-1 overflow-x-auto rounded-lg border border-[#F1F5F9]/10 bg-[#0F172A]/95 p-2 backdrop-blur"
      >
        {[
          ["section-a", "A. Info"],
          ["section-b", "B. Hosting"],
          ["section-c", "C. Docs / I-O"],
          ["section-d", productType === "api" ? "D. Auth / Test" : "D. Samples / Test"],
          ["section-e", "E. Pricing"],
          ["section-f", "F. Legal"],
        ].map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="shrink-0 rounded-md px-3 py-1.5 text-[11px] font-medium text-[#CBD5E1] hover:bg-[#14B8A6]/15 hover:text-[#14B8A6]"
          >
            {label}
          </a>
        ))}
      </nav>

      {!productType ? (
        <div className="rounded-lg border border-dashed border-[#F1F5F9]/15 p-5 text-sm text-[#CBD5E1]">
          Choose API or AI Model to show the full product submission form.
        </div>
      ) : productType === "api" ? (
        <>
          <FormCard id="section-a" title="Form A — Product & Developer Info" description="Describe your API and identify its publisher." highlighted={editorMode === "fix"}>
            <TextField label="Product name" value={apiPayload.formA.productName} onChange={(value) => updateApiA({ productName: value })} placeholder="e.g., Sri Lanka Currency Exchange API" required />
            <TextField label="Category" value={apiPayload.formA.category} onChange={(value) => updateApiA({ category: value })} placeholder="e.g., Finance & Payments" required />
            <TextField label="Short description" value={apiPayload.formA.shortDescription} onChange={(value) => updateApiA({ shortDescription: value })} placeholder="e.g., Real-time currency conversion" required />
            <TextField label="Logo URL" value={apiPayload.formA.logoUrl ?? ""} onChange={(value) => updateApiA({ logoUrl: value })} type="url" placeholder="https://yourdomain.com/logo.png" />
            <TextField label="Developer ID" value={linkedDeveloperId} onChange={() => {}} readOnly placeholder={linkedDeveloperId ? "" : "Unregistered — Complete Developer Registration first"} hint={linkedDeveloperId ? "Linked to your registered developer profile." : "Complete Developer Registration to link this product to your account."} />
            <div className="sm:col-span-2">
              <TextAreaField label="Detailed description" value={apiPayload.formA.detailedDescription} onChange={(value) => updateApiA({ detailedDescription: value })} required rows={4} placeholder="e.g., Real-time LKR exchange rate conversion endpoint with historical rate support." />
            </div>
          </FormCard>

          <FormCard id="section-b" title="Form B — Backend Hosting & Health Check" description="Provide endpoint availability and operational limits." highlighted={editorMode === "fix"}>
            <TextField label="Hosting provider" value={apiPayload.formB.hostingProvider} onChange={(value) => updateApiB({ hostingProvider: value })} placeholder="e.g., Azure, AWS, GCP" required />
            <TextField label="HTTPS base URL" value={apiPayload.formB.baseUrl} onChange={(value) => updateApiB({ baseUrl: value })} type="url" placeholder="https://api.yourdomain.com/v1" required />
            <TextField label="API version" value={apiPayload.formB.apiVersion ?? ""} onChange={(value) => updateApiB({ apiVersion: value })} placeholder="e.g., v1" />
            <TextField label="Health check path" value={apiPayload.formB.healthCheckPath ?? ""} onChange={(value) => updateApiB({ healthCheckPath: value })} placeholder="e.g., /health" />
            <TextField label="Hosting region" value={apiPayload.formB.region ?? ""} onChange={(value) => updateApiB({ region: value })} placeholder="e.g., southeastasia" />
            <TextField label="Availability (%)" value={numberValue(apiPayload.formB.availabilityPct)} onChange={(value) => updateApiB({ availabilityPct: value ? Number(value) : undefined })} type="number" min="0" max="100" step="0.01" placeholder="e.g., 99.9" />
            <TextField label="Rate limit (requests / minute)" value={numberValue(apiPayload.formB.rateLimit)} onChange={(value) => updateApiB({ rateLimit: value ? Number(value) : undefined })} type="number" min="0" placeholder="e.g., 1000" />
            <TextField label="Request timeout (ms)" value={numberValue(apiPayload.formB.timeoutMs)} onChange={(value) => updateApiB({ timeoutMs: value ? Number(value) : undefined })} type="number" min="0" placeholder="e.g., 30000" />
          </FormCard>

          <FormCard id="section-c" title="Form C — OpenAPI / Swagger Documentation" description="Upload or paste an API specification and review its parser preview." highlighted={editorMode === "fix"}>
            <div className="sm:col-span-2 space-y-3">
              <label className="block space-y-1.5 text-xs text-[#CBD5E1]">
                <span>Upload OpenAPI / Swagger file (.json, .yaml, .yml)</span>
                <input type="file" accept=".json,.yaml,.yml,application/json,text/yaml" onChange={(event) => void handleSpecUpload(event.target.files?.[0])} className="block w-full text-xs text-[#CBD5E1] file:mr-3 file:rounded-md file:border-0 file:bg-[#14B8A6]/15 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[#14B8A6]" />
              </label>
              <TextAreaField label="OpenAPI / Swagger document" value={apiPayload.formC.openApiSpec} onChange={updateApiC} required rows={10} placeholder={'e.g., {"openapi":"3.0.0","info":{"title":"Currency API","version":"1.0.0"},"paths":{}}'} />
              <div className="rounded-lg border border-[#14B8A6]/20 bg-[#0F172A] p-3">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#14B8A6]">Live parser preview</div>
                <p className="break-words text-xs text-[#CBD5E1]">{openApiPreview(apiPayload.formC.openApiSpec)}</p>
              </div>
            </div>
          </FormCard>

          <FormCard id="section-d" title="Form D — Authentication & Credentials" description="Configure the API authentication contract. Secrets are never included in the saved draft." highlighted={editorMode === "fix"}>
            <SelectField label="Authentication method" value={apiPayload.formD.authMethod} onChange={(value) => {
              const authMethod = value as ApiSubmissionPayload["formD"]["authMethod"];
              updateApiD({
                authMethod,
                upstreamAuthHeader: authMethod === "none" ? undefined : ["bearer", "basic", "oauth2"].includes(authMethod) ? "Authorization" : "X-API-Key",
              });
              if (authMethod === "none") setUpstreamCredential("");
            }}>
              <option className={optionClass} value="">Select authentication method...</option><option className={optionClass} value="none">None</option><option className={optionClass} value="api_key">API key</option><option className={optionClass} value="bearer">Bearer token</option><option className={optionClass} value="basic">Basic authentication</option><option className={optionClass} value="oauth2">OAuth 2.0</option>
            </SelectField>
            {apiPayload.formD.authMethod !== "" && apiPayload.formD.authMethod !== "none" && <>
              <TextField label="Upstream authentication header" value={apiPayload.formD.upstreamAuthHeader ?? ""} onChange={(value) => updateApiD({ upstreamAuthHeader: value })} placeholder={apiPayload.formD.authMethod === "bearer" ? "Authorization" : "X-API-Key"} required />
              <label className="block space-y-1.5 text-xs text-[#CBD5E1]">
                <span>Upstream credential</span>
                <input type="password" autoComplete="new-password" value={upstreamCredential} onChange={(event) => setUpstreamCredential(event.target.value)} placeholder="Stored encrypted on the server" className={fieldClass} required />
                <span className="block text-[11px] text-[#CBD5E1]/60">Sent directly to the backend once and never included in the saved draft.</span>
              </label>
            </>}
          </FormCard>

          <FormCard id="section-e" title="Form E — Pricing & Rate Limits" description="Select pricing plans and set optional usage caps." highlighted={editorMode === "fix"}>
            <div className="space-y-3">
              <p className="text-xs text-[#CBD5E1]">Pricing models</p>
              {[
                ["free", "Free tier"],
                ["pay_per_request", "Pay per request"],
                ["subscription", "Subscription"],
              ].map(([value, label]) => (
                <CheckField key={value} label={label} checked={apiPayload.formE.pricingModel.includes(value)} onChange={(checked) => updateApiE({ pricingModel: checked ? [...apiPayload.formE.pricingModel, value] : apiPayload.formE.pricingModel.filter((item) => item !== value) })} />
              ))}
            </div>
            <TextField label="Price per request (USD)" value={numberValue(apiPayload.formE.pricePerRequest)} onChange={(value) => updateApiE({ pricePerRequest: value ? Number(value) : undefined })} type="number" min="0" step="0.000001" placeholder="e.g., 0.001" />
            <TextField label="Free trial allowance (requests)" value={numberValue(apiPayload.formE.freeTrialAllowance)} onChange={(value) => updateApiE({ freeTrialAllowance: value ? Number(value) : undefined })} type="number" min="0" placeholder="e.g., 100" />
            <TextField label="Monthly request limit" value={numberValue(apiPayload.formE.monthlyLimit)} onChange={(value) => updateApiE({ monthlyLimit: value ? Number(value) : undefined })} type="number" min="0" placeholder="e.g., 10000" />
            <TextField label="Rate limit (requests / minute)" value={numberValue(apiPayload.formE.rpm)} onChange={(value) => updateApiE({ rpm: value ? Number(value) : undefined })} type="number" min="0" placeholder="e.g., 1000" />
            <TextField label="Maximum concurrency" value={numberValue(apiPayload.formE.maxConcurrency)} onChange={(value) => updateApiE({ maxConcurrency: value ? Number(value) : undefined })} type="number" min="0" placeholder="e.g., 10" />
          </FormCard>

          <FormCard id="section-f" title="Form F — Legal & Compliance" description="Confirm rights, service terms, and data handling." highlighted={editorMode === "fix"}>
            <TextField label="Privacy policy URL" value={apiPayload.formF.privacyPolicyUrl ?? ""} onChange={(value) => updateApiF({ privacyPolicyUrl: value })} type="url" placeholder="https://yourdomain.com/privacy" />
            <TextField label="Terms of service URL" value={apiPayload.formF.termsOfServiceUrl ?? ""} onChange={(value) => updateApiF({ termsOfServiceUrl: value })} type="url" placeholder="https://yourdomain.com/terms" />
            <div className="sm:col-span-2">
              <TextAreaField label="Data handling notes" value={apiPayload.formF.dataHandlingNotes ?? ""} onChange={(value) => updateApiF({ dataHandlingNotes: value })} rows={3} placeholder="Describe storage, retention, and deletion practices." />
            </div>
            <div className="sm:col-span-2 space-y-3">
              <CheckField label="I confirm I own or have the right to distribute this API and its documentation." checked={apiPayload.formF.ownershipConfirmed} onChange={(checked) => updateApiF({ ownershipConfirmed: checked })} />
              <CheckField label="I accept the CODOS marketplace commission terms." checked={apiPayload.formF.commissionAccepted} onChange={(checked) => updateApiF({ commissionAccepted: checked })} />
            </div>
          </FormCard>
        </>
      ) : (
        <>
          <FormCard id="section-a" title="Form A — Model Info & Architecture" description="Describe the model, framework, architecture, and intended applications." highlighted={editorMode === "fix"}>
            <TextField label="Model name" value={modelPayload.formA.modelName} onChange={(value) => updateModelA({ modelName: value })} placeholder="e.g., Sinhala Text Summarization Model" required />
            <TextField label="Version" value={modelPayload.formA.version} onChange={(value) => updateModelA({ version: value })} placeholder="e.g., 1.0.0" required />
            <TextField label="Category" value={modelPayload.formA.category} onChange={(value) => updateModelA({ category: value })} placeholder="e.g., Natural Language Processing" />
            <TextField label="Framework" value={modelPayload.formA.framework} onChange={(value) => updateModelA({ framework: value })} placeholder="e.g. PyTorch, ONNX" />
            <TextField label="Architecture" value={modelPayload.formA.architecture ?? ""} onChange={(value) => updateModelA({ architecture: value })} placeholder="e.g., Transformer encoder-decoder" />
            <TextField label="Base model" value={modelPayload.formA.baseModel ?? ""} onChange={(value) => updateModelA({ baseModel: value })} placeholder="e.g., your-base-model" />
            <TextField label="Logo URL" value={modelPayload.formA.logoUrl ?? ""} onChange={(value) => updateModelA({ logoUrl: value })} type="url" placeholder="https://yourdomain.com/logo.png" />
            <TextField label="Developer ID" value={linkedDeveloperId} onChange={() => {}} readOnly placeholder={linkedDeveloperId ? "" : "Unregistered — Complete Developer Registration first"} hint={linkedDeveloperId ? "Linked to your registered developer profile." : "Complete Developer Registration to link this product to your account."} />
            <TextAreaField label="Short description" value={modelPayload.formA.shortDescription} onChange={(value) => updateModelA({ shortDescription: value })} required rows={2} placeholder="e.g., Summarizes Sinhala-language documents in seconds." />
            <TextAreaField label="Use cases (one per line)" value={linesValue(modelPayload.formA.useCases)} onChange={(value) => updateModelA({ useCases: linesToList(value) })} rows={2} placeholder="e.g., Document summarization" />
            <div className="sm:col-span-2">
              <TextAreaField label="Detailed description" value={modelPayload.formA.detailedDescription} onChange={(value) => updateModelA({ detailedDescription: value })} required rows={4} placeholder="Describe the model's capabilities, intended users, and expected results." />
            </div>
            <TextAreaField label="Supported languages (one per line)" value={linesValue(modelPayload.formA.supportedLanguages)} onChange={(value) => updateModelA({ supportedLanguages: linesToList(value) })} rows={2} placeholder="e.g., Sinhala" />
            <div className="sm:col-span-2">
              <CheckField label="This model is fine-tuned from a base model." checked={Boolean(modelPayload.formA.fineTuned)} onChange={(checked) => updateModelA({ fineTuned: checked })} />
            </div>
          </FormCard>

          <FormCard id="section-b" title="Form B — Developer-Hosted HTTPS Endpoint" description="All third-party models are served from your HTTPS inference endpoint and routed through the CODOS API Gateway." highlighted={editorMode === "fix"}>
            <TextField label="Inference endpoint (HTTPS)" value={modelPayload.formB.inferenceEndpoint ?? ""} onChange={(value) => updateModelB({ inferenceEndpoint: value })} type="url" placeholder="https://yourdomain.com/v1/infer" required />
            <TextField label="Hosting provider" value={modelPayload.formB.hostingProvider ?? ""} onChange={(value) => updateModelB({ hostingProvider: value })} placeholder="e.g., Azure, AWS, GCP" />
            <TextField label="Health check path" value={modelPayload.formB.healthCheckPath ?? ""} onChange={(value) => updateModelB({ healthCheckPath: value })} placeholder="e.g., /health" required />
            <TextField label="Expected latency (ms)" value={numberValue(modelPayload.formB.expectedLatencyMs)} onChange={(value) => updateModelB({ expectedLatencyMs: value ? Number(value) : undefined })} type="number" min="0" placeholder="e.g., 250" />
            <TextField label="Availability (%)" value={numberValue(modelPayload.formB.availabilityPct)} onChange={(value) => updateModelB({ availabilityPct: value ? Number(value) : undefined })} type="number" min="0" max="100" step="0.01" placeholder="e.g., 99.9" />
            <TextField label="Maximum request size (MB)" value={numberValue(modelPayload.formB.maxRequestSizeMb)} onChange={(value) => updateModelB({ maxRequestSizeMb: value ? Number(value) : undefined })} type="number" min="0" placeholder="e.g., 10" />
            <SelectField label="Upstream authentication method" value={modelPayload.formB.authMethod} onChange={(value) => {
              const authMethod = value as ModelSubmissionPayload["formB"]["authMethod"];
              updateModelB({
                authMethod,
                upstreamAuthHeader: authMethod === "none" ? undefined : ["bearer", "basic", "oauth2"].includes(authMethod) ? "Authorization" : "X-API-Key",
              });
              if (authMethod === "none") setUpstreamCredential("");
            }}>
              <option className={optionClass} value="none">None</option><option className={optionClass} value="api_key">API key</option><option className={optionClass} value="bearer">Bearer token</option><option className={optionClass} value="basic">Basic authentication</option><option className={optionClass} value="oauth2">OAuth 2.0</option>
            </SelectField>
            {modelPayload.formB.authMethod !== "none" && <>
              <TextField label="Upstream authentication header" value={modelPayload.formB.upstreamAuthHeader ?? ""} onChange={(value) => updateModelB({ upstreamAuthHeader: value })} placeholder={modelPayload.formB.authMethod === "bearer" ? "Authorization" : "X-API-Key"} required />
              <label className="block space-y-1.5 text-xs text-[#CBD5E1]">
                <span>Upstream credential</span>
                <input type="password" autoComplete="new-password" value={upstreamCredential} onChange={(event) => setUpstreamCredential(event.target.value)} placeholder="Stored encrypted on the server" className={fieldClass} required />
                <span className="block text-[11px] text-[#CBD5E1]/60">Sent directly to the backend once and never included in the saved draft.</span>
              </label>
            </>}
          </FormCard>

          <FormCard id="section-c" title="Form C — Input / Output Schema & Playground" description="Define supported formats and preview JSON schema and sample input." highlighted={editorMode === "fix"}>
            <SelectField label="Input type" value={modelPayload.formC.inputType} onChange={(value) => updateModelC({ inputType: value as ModelSubmissionPayload["formC"]["inputType"] })}>
              <option className={optionClass} value="">Select input type...</option>
              {["text", "image", "audio", "video", "document", "json"].map((item) => <option className={optionClass} key={item} value={item}>{item}</option>)}
            </SelectField>
            <TextAreaField label="Input formats (one per line)" value={linesValue(modelPayload.formC.inputFormats)} onChange={(value) => updateModelC({ inputFormats: linesToList(value) })} rows={2} placeholder="e.g., JSON" />
            <SelectField label="Output type" value={modelPayload.formC.outputType} onChange={(value) => updateModelC({ outputType: value as ModelSubmissionPayload["formC"]["outputType"] })}>
              <option className={optionClass} value="">Select output type...</option>
              {["text", "image", "audio", "video", "document", "json"].map((item) => <option className={optionClass} key={item} value={item}>{item}</option>)}
            </SelectField>
            <TextAreaField label="Output formats (one per line)" value={linesValue(modelPayload.formC.outputFormats)} onChange={(value) => updateModelC({ outputFormats: linesToList(value) })} rows={2} placeholder="e.g., JSON" />
            <TextField label="Maximum input size (MB)" value={numberValue(modelPayload.formC.maxInputSizeMb)} onChange={(value) => updateModelC({ maxInputSizeMb: value ? Number(value) : undefined })} type="number" min="0" placeholder="e.g., 5" />
            <SelectField label="Processing mode" value={modelPayload.formC.processingMode} onChange={(value) => updateModelC({ processingMode: value as ModelSubmissionPayload["formC"]["processingMode"] })}>
              <option className={optionClass} value="">Select processing mode...</option>
              <option className={optionClass} value="synchronous">Synchronous</option><option className={optionClass} value="asynchronous">Asynchronous</option>
            </SelectField>
            <SelectField label="Result delivery" value={modelPayload.formC.deliveryMethod} onChange={(value) => updateModelC({ deliveryMethod: value as ModelSubmissionPayload["formC"]["deliveryMethod"] })}>
              <option className={optionClass} value="">Select result delivery...</option>
              <option className={optionClass} value="direct">Direct response</option><option className={optionClass} value="download_url">Download URL</option>
            </SelectField>
            <div className="sm:col-span-2 space-y-3">
              <TextAreaField label="Input / output schema (JSON)" value={modelPayload.formC.schemaJson ?? ""} onChange={(value) => updateModelC({ schemaJson: value })} rows={7} placeholder={'e.g., {"input":{"type":"string"},"output":{"type":"string"}}'} />
              <div className="rounded-lg border border-[#14B8A6]/20 bg-[#0F172A] p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-[#14B8A6]">Live schema preview</div>
                <p className="mt-1 text-xs text-[#CBD5E1]">{schemaPreview(modelPayload.formC.schemaJson ?? "")}</p>
              </div>
              <TextAreaField label="Playground sample input (JSON)" value={playgroundInput} onChange={setPlaygroundInput} rows={3} placeholder={'e.g., {"input":"Hello"}'} />
              <div className="rounded-lg bg-[#0F172A] p-3 text-xs text-[#CBD5E1]">
                Playground preview:{" "}
                {(() => {
                  try {
                    return `valid JSON input · ${JSON.stringify(JSON.parse(playgroundInput))}`;
                  } catch {
                    return "enter valid JSON to preview a test request";
                  }
                })()}
              </div>
            </div>
          </FormCard>

          <FormCard id="section-d" title="Form D — Samples, Benchmarks & Limitations" description="Provide examples and performance characteristics for review." highlighted={editorMode === "fix"}>
            <TextAreaField label="Sample inputs (one per line)" value={linesValue(modelPayload.formD.sampleInputs)} onChange={(value) => updateModelD({ sampleInputs: linesToList(value) })} rows={4} placeholder="e.g., Summarize this document..." />
            <TextAreaField label="Sample outputs (one per line)" value={linesValue(modelPayload.formD.sampleOutputs)} onChange={(value) => updateModelD({ sampleOutputs: linesToList(value) })} rows={4} placeholder="e.g., A concise summary of the key points." />
            <TextField label="Benchmark score" value={numberValue(modelPayload.formD.benchmarkScore)} onChange={(value) => updateModelD({ benchmarkScore: value ? Number(value) : undefined })} type="number" step="any" placeholder="e.g., 92" />
            <TextField label="Maximum processing time (ms)" value={numberValue(modelPayload.formD.maxProcessingTimeMs)} onChange={(value) => updateModelD({ maxProcessingTimeMs: value ? Number(value) : undefined })} type="number" min="0" placeholder="e.g., 5000" />
            <div className="sm:col-span-2">
              <TextAreaField label="Known limitations" value={modelPayload.formD.knownLimitations ?? ""} onChange={(value) => updateModelD({ knownLimitations: value })} rows={3} placeholder="Describe known failure cases or unsupported scenarios." />
            </div>
          </FormCard>

          <FormCard id="section-e" title="Form E — Model Pricing & Billable Unit" description="Choose the unit used to meter model usage and set rate and limits." highlighted={editorMode === "fix"}>
            <SelectField label="Billable unit" value={modelPayload.formE.billingUnit} onChange={(value) => updateModelE({ billingUnit: value as ModelSubmissionPayload["formE"]["billingUnit"] })}>
              <option className={optionClass} value="">Select a billable unit...</option>
              <option className={optionClass} value="free">Free</option><option className={optionClass} value="per_inference">Per inference</option><option className={optionClass} value="per_image">Per image</option><option className={optionClass} value="per_video_min">Per video minute</option><option className={optionClass} value="per_audio_min">Per audio minute</option><option className={optionClass} value="per_token">Per token</option><option className={optionClass} value="subscription">Subscription</option><option className={optionClass} value="credit_package">Credit package</option>
            </SelectField>
            <TextField label="Rate (USD per billable unit)" value={numberValue(modelPayload.formE.rate)} onChange={(value) => updateModelE({ rate: value ? Number(value) : undefined })} type="number" min="0" step="0.000001" placeholder="e.g., 0.001" />
            <div className="sm:col-span-2">
              <TextAreaField label="Usage limits / plan details" value={modelPayload.formE.limits ?? ""} onChange={(value) => updateModelE({ limits: value })} rows={3} placeholder="e.g., Up to 1 million tokens per month." />
            </div>
          </FormCard>

          <FormCard id="section-f" title="Form F — License, Training Data & Legal" description="Document model rights and confirm required marketplace policies." highlighted={editorMode === "fix"}>
            <TextField label="Base model license" value={modelPayload.formF.baseModelLicense ?? ""} onChange={(value) => updateModelF({ baseModelLicense: value })} placeholder="e.g., Apache-2.0" />
            <TextField label="Training data rights" value={modelPayload.formF.trainingDataRights ?? ""} onChange={(value) => updateModelF({ trainingDataRights: value })} placeholder="e.g., Licensed for commercial use" />
            <TextField label="Privacy policy URL" value={modelPayload.formF.privacyPolicyUrl ?? ""} onChange={(value) => updateModelF({ privacyPolicyUrl: value })} type="url" placeholder="https://yourdomain.com/privacy" />
            <TextField label="Terms of service URL" value={modelPayload.formF.termsOfServiceUrl ?? ""} onChange={(value) => updateModelF({ termsOfServiceUrl: value })} type="url" placeholder="https://yourdomain.com/terms" />
            <div className="sm:col-span-2 space-y-3">
              <CheckField label="I confirm I own or have the right to distribute this model, base model, and training outputs." checked={modelPayload.formF.ownershipConfirmed} onChange={(checked) => updateModelF({ ownershipConfirmed: checked })} />
              <CheckField label="I agree to the CODOS prohibited-use requirements." checked={modelPayload.formF.prohibitedUseAgreement} onChange={(checked) => updateModelF({ prohibitedUseAgreement: checked })} />
            </div>
          </FormCard>
        </>
      )}

      {validationReport && (
        <section
          aria-live="polite"
          className={`rounded-xl border p-4 ${
            validationReport.length === 0
              ? "border-[#34D399]/30 bg-[#34D399]/10"
              : "border-[#FBBF24]/30 bg-[#FBBF24]/10"
          }`}
        >
          <h2 className="text-sm font-semibold text-[#F1F5F9]">Pre-Submission Review Report</h2>
          {validationReport.length === 0 ? (
            <p className="mt-2 text-xs text-[#34D399]">All required checks passed.</p>
          ) : (
            <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-[#FBBF24]">
              {validationReport.map((item) => <li key={item}>{item}</li>)}
            </ul>
          )}
        </section>
      )}
      {notice && <p role="status" className="text-xs text-[#CBD5E1]">{notice}</p>}
      </fieldset>

      <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#F1F5F9]/10 bg-[#0F172A]/95 p-3 shadow-xl backdrop-blur">
        {isReadOnly ? (
          <span className="text-xs text-[#CBD5E1]/70">Read-only mode · Audit history is available from the submission list.</span>
        ) : (
          <>
            <span className="text-[11px] text-[#CBD5E1]/70">Draft auto-saves in this browser.</span>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setValidationReport(report)} className="rounded-lg border border-[#14B8A6]/40 px-3 py-2 text-xs font-semibold text-[#14B8A6] hover:bg-[#14B8A6]/10">
                Test Connection / Validate Schema
              </button>
              <button type="button" onClick={handleSaveDraft} className="rounded-lg border border-[#F1F5F9]/15 px-3 py-2 text-xs font-semibold text-[#CBD5E1] hover:bg-[#F1F5F9]/5">
                Save Draft
              </button>
              <button type="button" onClick={handleSubmit} disabled={!productType || submitting} className="rounded-lg bg-[#14B8A6] px-3 py-2 text-xs font-semibold text-[#0F172A] disabled:cursor-not-allowed disabled:opacity-50">
                {submitting ? "Submitting..." : "Submit for Review"}
              </button>
            </div>
          </>
        )}
      </div>
      {confirmationProduct && (
        <IntegrationPanel
          product={confirmationProduct}
          confirmation
          onClose={() => setConfirmationProduct(null)}
          onSubmitAnother={() => {
            setConfirmationProduct(null);
            handleReset();
          }}
        />
      )}
    </div>
  );
};
