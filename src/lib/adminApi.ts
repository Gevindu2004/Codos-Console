import { getMockApis, getMockModels } from "@/components/developer/mockDeveloperData";
import type {
  AdminLiveProduct,
  AdminState,
  AdminSubmissionItem,
  AutomatedCheckKey,
  AutomatedCheckResult,
  GovernanceAuditEvent,
} from "@/components/admin/types";
import type { SubmissionStatus } from "@/components/developer/types";

const STORAGE_KEY = "codos-admin-portal-v1";
const API_BASE = "/api/v1/admin";
const SEED_TIMESTAMP = "2025-03-12T12:00:00.000Z";

const emptyChecks = (): Record<AutomatedCheckKey, AutomatedCheckResult> => ({
  httpsEndpoint: { status: "pending", summary: "Not run" },
  schemaValidation: { status: "pending", summary: "Not run" },
  authSecurity: { status: "pending", summary: "Not run" },
  sandboxInference: { status: "pending", summary: "Not run" },
  legalCompliance: { status: "pending", summary: "Not run" },
});

function makeAuditEvent(
  id: string,
  category: GovernanceAuditEvent["category"],
  target: string,
  action: string,
  notes: string,
  statusTransition?: string,
): GovernanceAuditEvent {
  return {
    id,
    timestamp: SEED_TIMESTAMP,
    actor: "admin@codos.console",
    category,
    target,
    action,
    statusTransition,
    notes,
  };
}

function makeLiveProduct(
  id: string,
  slug: string,
  name: string,
  productType: AdminLiveProduct["productType"],
  providerType: AdminLiveProduct["providerType"],
  developerName: string,
  status: AdminLiveProduct["status"],
  featured: boolean,
  submissionId?: string,
): AdminLiveProduct {
  return {
    id,
    slug,
    name,
    productType,
    providerType,
    developerName,
    status,
    featured,
    updatedAt: SEED_TIMESTAMP,
    submissionId,
  };
}

export function createSeededAdminState(): AdminState {
  const api = getMockApis("dev-123")[0];
  const model = getMockModels("dev-123")[0];
  if (!api || !model) {
    throw new Error("Developer sample submissions are required to seed the admin portal.");
  }

  const apiSubmission = (
    id: string,
    status: SubmissionStatus,
    productName: string,
    submittedAt: string,
  ): AdminSubmissionItem => ({
    id,
    productType: "api",
    developerName: "Acme Developer",
    providerType: "third_party",
    payload: {
      ...api,
      formA: { ...api.formA, productName },
      status,
    },
    automatedChecks: emptyChecks(),
    reviewNotes: "",
    submittedAt,
  });
  const modelSubmission = (
    id: string,
    status: SubmissionStatus,
    modelName: string,
    submittedAt: string,
  ): AdminSubmissionItem => ({
    id,
    productType: "model",
    developerName: "Acme Developer",
    providerType: "third_party",
    payload: {
      ...model,
      formA: { ...model.formA, modelName },
      status,
    },
    automatedChecks: emptyChecks(),
    reviewNotes: "",
    submittedAt,
  });

  return {
    developers: [
      {
        id: "app-dev-acme",
        developerName: "Acme Developer",
        companyName: "Acme Analytics",
        email: "partners@acme.example",
        emailVerified: true,
        country: "United States",
        website: "https://acme.example",
        supportContact: "support@acme.example",
        submittedAt: "2025-03-10T09:30:00.000Z",
        status: "pending",
        reviewNotes: "",
      },
      {
        id: "app-dev-northstar",
        developerName: "Northstar AI",
        companyName: "Northstar Labs",
        email: "hello@northstar.example",
        emailVerified: false,
        country: "United Kingdom",
        website: "https://northstar.example",
        supportContact: "hello@northstar.example",
        submittedAt: "2025-03-11T13:15:00.000Z",
        status: "pending",
        reviewNotes: "",
      },
      {
        id: "app-dev-lanka",
        developerName: "Lanka Data Works",
        companyName: "Lanka Data Works",
        email: "team@lankadata.example",
        emailVerified: true,
        country: "Sri Lanka",
        website: "https://lankadata.example",
        supportContact: "team@lankadata.example",
        submittedAt: "2025-03-08T07:45:00.000Z",
        status: "approved",
        reviewNotes: "Identity and payout details verified.",
      },
    ],
    submissions: [
      apiSubmission("sub-api-weather", "Submitted", "Acme Weather API", "2025-03-12T08:00:00.000Z"),
      apiSubmission("sub-api-payments", "Validating", "Acme Payments API", "2025-03-12T09:20:00.000Z"),
      modelSubmission("sub-model-llama", "Testing", "Acme Llama 3 FineTune", "2025-03-11T16:10:00.000Z"),
      modelSubmission("sub-model-recommendations", "Under Review", "Acme Product Recommender", "2025-03-10T11:25:00.000Z"),
      apiSubmission("sub-api-changes", "Changes Requested", "Acme Archive API", "2025-03-07T10:00:00.000Z"),
      modelSubmission("sub-model-approved", "Approved", "Acme Sentiment Model", "2025-03-06T15:40:00.000Z"),
      apiSubmission("sub-api-published", "Published", "Acme Weather API v1", "2025-03-05T12:30:00.000Z"),
    ],
    liveProducts: [
      makeLiveProduct("official-api-thumbs", "thumbs-up-api", "Thumbs Up API", "api", "via_codos", "Via Codos", "Published", true),
      makeLiveProduct("official-api-colleague", "call-colleague", "Call Colleague API", "api", "via_codos", "Via Codos", "Published", true),
      makeLiveProduct("official-api-skybeak", "skybeak-rag", "SkyBeak RAG & Inference API", "api", "via_codos", "Via Codos", "Published", true),
      makeLiveProduct("official-model-llama", "meta-llama-3-8b", "Meta-Llama-3-8B-Instruct", "model", "via_codos", "Via Codos", "Published", true),
      makeLiveProduct("official-model-qwen", "qwen-2-5-7b", "Qwen2.5-7B-Instruct", "model", "via_codos", "Via Codos", "Published", false),
      makeLiveProduct("third-party-weather", "acme-weather-api", "Acme Weather API", "api", "third_party", "Acme Developer", "Published", false, "sub-api-published"),
      makeLiveProduct("third-party-model", "acme-recommender", "Acme Product Recommender", "model", "third_party", "Acme Developer", "Suspended", false, "sub-model-approved"),
      makeLiveProduct("third-party-unpublished", "northstar-docs", "Northstar Document AI", "model", "third_party", "Northstar AI", "Unpublished", false),
    ],
    payouts: [
      {
        id: "pay-2025-03-acme",
        developerId: "dev-123",
        developerName: "Acme Developer",
        period: "February 2025",
        grossRevenue: 12840,
        commissionRate: 0.15,
        platformFee: 1926,
        netPayout: 10914,
        method: "Bank transfer",
        status: "Pending Approval",
        reference: "CODOS-ACME-2502",
      },
      {
        id: "pay-2025-02-lanka",
        developerId: "dev-456",
        developerName: "Lanka Data Works",
        period: "January 2025",
        grossRevenue: 6840,
        commissionRate: 0.15,
        platformFee: 1026,
        netPayout: 5814,
        method: "Stripe",
        status: "Processing",
        reference: "CODOS-LDW-2501",
      },
      {
        id: "pay-2025-01-acme",
        developerId: "dev-123",
        developerName: "Acme Developer",
        period: "December 2024",
        grossRevenue: 9120,
        commissionRate: 0.15,
        platformFee: 1368,
        netPayout: 7752,
        method: "Bank transfer",
        status: "Paid",
        reference: "CODOS-ACME-2412",
      },
    ],
    auditEvents: [
      makeAuditEvent("audit-seed-1", "Submission", "sub-model-recommendations", "Submission received", "AI Model submission entered the review queue.", "Draft → Submitted"),
      makeAuditEvent("audit-seed-2", "Developer", "app-dev-lanka", "Developer approved", "Developer onboarding completed.", "pending → approved"),
      makeAuditEvent("audit-seed-3", "Payout", "pay-2025-02-lanka", "Payout approved", "Payout is processing.", "Pending Approval → Processing"),
    ],
    commissionRate: 0.15,
  };
}

export function loadAdminState(): AdminState | null {
  const serialized = window.localStorage.getItem(STORAGE_KEY);
  if (!serialized) return null;
  return JSON.parse(serialized) as AdminState;
}

export function saveAdminState(state: AdminState): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export async function adminRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`Admin API request failed (${response.status} ${response.statusText}).`);
  }
  return (await response.json()) as T;
}

export { emptyChecks };
