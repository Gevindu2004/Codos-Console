import type {
  AdminDeveloperApplication,
  AdminLiveProduct,
  AdminSubmissionItem,
  AutomatedCheckKey,
  AutomatedCheckResult,
} from "@/components/admin/types";
import type {
  ApiSubmissionPayload,
  DeveloperProfile,
  ModelSubmissionPayload,
  SubmissionStatus,
  UpstreamAuthMethod,
} from "@/components/developer/types";
import {
  getAdminMarketplaceDevelopers,
  getAdminMarketplaceProducts,
  updateMarketplaceDeveloperStatus,
  updateMarketplaceProductStatus,
  type MarketplaceDeveloperRecord,
  type MarketplaceProductRecord,
} from "@/lib/developerApi";

const STORE_KEY = "codos-marketplace-store-v1";
const CURRENT_DEVELOPER_KEY = "currentDeveloperId";
const STORE_EVENT = "codos-marketplace-store-updated";

export type SharedDeveloper = AdminDeveloperApplication & {
  marketplaceDeveloperId?: string;
  auditLogs: Array<{ timestamp: string; actor: string; action: string; details?: Record<string, unknown> }>;
};

export type SharedProduct = AdminSubmissionItem & {
  developerId: string;
  marketplaceProductId?: string;
  slug: string;
  updatedAt: string;
  featured?: boolean;
  auditLogs: Array<{ timestamp: string; actor: string; action: string; details?: Record<string, unknown> }>;
};

export interface MarketplaceStoreState {
  developers: SharedDeveloper[];
  products: SharedProduct[];
}

const emptyState = (): MarketplaceStoreState => ({ developers: [], products: [] });
const emptyChecks = (): Record<AutomatedCheckKey, AutomatedCheckResult> => ({
  httpsEndpoint: { status: "pending", summary: "Not run" },
  schemaValidation: { status: "pending", summary: "Not run" },
  authSecurity: { status: "pending", summary: "Not run" },
  sandboxInference: { status: "pending", summary: "Not run" },
  legalCompliance: { status: "pending", summary: "Not run" },
});

function newId(prefix: string): string {
  const suffix = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${suffix}`;
}

function isApiPayload(payload: ApiSubmissionPayload | ModelSubmissionPayload): payload is ApiSubmissionPayload {
  return "productName" in payload.formA;
}

export function readMarketplaceStore(): MarketplaceStoreState {
  if (typeof window === "undefined") return emptyState();
  const saved = window.localStorage.getItem(STORE_KEY);
  if (!saved) return emptyState();
  const parsed = JSON.parse(saved) as Partial<MarketplaceStoreState>;
  return {
    developers: Array.isArray(parsed.developers) ? parsed.developers : [],
    products: Array.isArray(parsed.products) ? parsed.products : [],
  };
}

function notifyStore(state: MarketplaceStoreState): void {
  window.localStorage.setItem(STORE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(STORE_EVENT, { detail: state }));
}

export function subscribeMarketplaceStore(listener: (state: MarketplaceStoreState) => void): () => void {
  const update = () => listener(readMarketplaceStore());
  const storageUpdate = (event: StorageEvent) => {
    if (event.key === STORE_KEY) update();
  };
  window.addEventListener(STORE_EVENT, update);
  window.addEventListener("storage", storageUpdate);
  return () => {
    window.removeEventListener(STORE_EVENT, update);
    window.removeEventListener("storage", storageUpdate);
  };
}

export function subscribeToCurrentDeveloper(listener: (id: string) => void): () => void {
  const update = () => listener(getCurrentDeveloperId());
  const storageUpdate = (event: StorageEvent) => {
    if (event.key === CURRENT_DEVELOPER_KEY) update();
  };
  window.addEventListener(STORE_EVENT, update);
  window.addEventListener("storage", storageUpdate);
  return () => {
    window.removeEventListener(STORE_EVENT, update);
    window.removeEventListener("storage", storageUpdate);
  };
}

export function getCurrentDeveloperId(fallback = ""): string {
  if (typeof window === "undefined") return fallback;
  return window.localStorage.getItem(CURRENT_DEVELOPER_KEY) || fallback;
}

export function getDeveloperProfile(id: string): DeveloperProfile | null {
  const developer = readMarketplaceStore().developers.find((entry) => entry.id === id);
  if (!developer) return null;
  return {
    id: developer.id,
    developerName: developer.developerName,
    companyName: developer.companyName,
    email: developer.email,
    emailVerified: developer.emailVerified,
    country: developer.country,
    website: developer.website,
    supportContact: developer.supportContact,
    payoutMethod: "none",
    status: developer.status,
    reviewNotes: developer.reviewNotes,
    submittedAt: developer.submittedAt,
  };
}

export function registerDeveloper(input: Omit<AdminDeveloperApplication, "id" | "submittedAt" | "status" | "reviewNotes">): DeveloperProfile {
  const state = readMarketplaceStore();
  const email = input.email.trim().toLowerCase();
  const current = state.developers.find((entry) => entry.email.trim().toLowerCase() === email);
  const now = new Date().toISOString();
  const id = current?.id ?? newId("dev");
  const developer: SharedDeveloper = {
    ...current,
    ...input,
    id,
    email: input.email.trim(),
    submittedAt: current?.submittedAt ?? now,
    status: "pending",
    reviewNotes: "",
    auditLogs: [
      ...(current?.auditLogs ?? []),
      { timestamp: now, actor: "developer", action: "Registration submitted" },
    ],
  };
  window.localStorage.setItem(CURRENT_DEVELOPER_KEY, id);
  notifyStore({
    ...state,
    developers: current
      ? state.developers.map((entry) => entry.id === id ? developer : entry)
      : [developer, ...state.developers],
  });
  return getDeveloperProfile(id)!;
}

export function updateDeveloperReview(
  id: string,
  status: SharedDeveloper["status"],
  reviewNotes: string,
): void {
  const state = readMarketplaceStore();
  const current = state.developers.find((entry) => entry.id === id);
  if (!current) throw new Error(`Developer application ${id} was not found.`);
  const timestamp = new Date().toISOString();
  const next = {
    ...current,
    status,
    reviewNotes,
    auditLogs: [
      ...current.auditLogs,
      {
        timestamp,
        actor: "admin@codos.console",
        action: `Developer ${status}`,
        details: reviewNotes ? { reviewNotes } : undefined,
      },
    ],
  };
  notifyStore({
    ...state,
    developers: state.developers.map((entry) => entry.id === id ? next : entry),
  });
  if (next.marketplaceDeveloperId) {
    void updateMarketplaceDeveloperStatus(
      next.marketplaceDeveloperId,
      status,
      reviewNotes,
      next.auditLogs,
    )
      .catch((error: unknown) => console.error("Could not sync marketplace developer status.", error));
  }
}

function mergeMarketplaceDeveloper(
  state: MarketplaceStoreState,
  record: MarketplaceDeveloperRecord,
): MarketplaceStoreState {
  const email = record.email.trim().toLowerCase();
  const existing = state.developers.find((entry) =>
    entry.id === record.id || entry.email.trim().toLowerCase() === email,
  );
  const oldId = existing?.id;
  const developer: SharedDeveloper = {
    id: record.id,
    marketplaceDeveloperId: record.id,
    developerName: record.developer_name,
    companyName: record.company_name,
    email: record.email,
    emailVerified: record.email_verified,
    country: record.country,
    website: record.website ?? undefined,
    supportContact: record.support_contact,
    status: record.status,
    reviewNotes: record.review_notes,
    submittedAt: record.submitted_at,
    auditLogs: record.audit_logs ?? existing?.auditLogs ?? [],
  };
  const developers = [
    developer,
    ...state.developers.filter((entry) => entry.id !== oldId && entry.id !== record.id),
  ];
  const products = oldId && oldId !== record.id
    ? state.products.map((product) => {
        if (product.developerId !== oldId) return product;
        if (product.productType === "api") {
          return {
            ...product,
            developerId: record.id,
            payload: { ...product.payload, formA: { ...product.payload.formA, developerId: record.id } },
          };
        }
        return {
          ...product,
          developerId: record.id,
          payload: { ...product.payload, formA: { ...product.payload.formA, developerId: record.id } },
        };
      })
    : state.products;
  return { developers, products };
}

export function syncMarketplaceDeveloperRecord(
  record: MarketplaceDeveloperRecord,
  makeCurrent = false,
): DeveloperProfile {
  const previous = readMarketplaceStore();
  const match = previous.developers.find((entry) =>
    entry.id === record.id || entry.email.trim().toLowerCase() === record.email.trim().toLowerCase(),
  );
  const next = mergeMarketplaceDeveloper(previous, record);
  const currentId = getCurrentDeveloperId();
  if (makeCurrent || (match && currentId === match.id)) {
    window.localStorage.setItem(CURRENT_DEVELOPER_KEY, record.id);
  }
  notifyStore(next);
  return getDeveloperProfile(record.id)!;
}

export async function syncMarketplaceDevelopersFromBackend(): Promise<void> {
  try {
    const records = await getAdminMarketplaceDevelopers();
    if (records === null) return;
    let state: MarketplaceStoreState = { ...readMarketplaceStore(), developers: [] };
    for (const record of records) state = mergeMarketplaceDeveloper(state, record);
    notifyStore(state);
  } catch (error) {
    console.error("Could not sync marketplace developers from the backend.", error);
  }
}

export function getDeveloperProducts(developerId: string): SharedProduct[] {
  return readMarketplaceStore().products.filter((product) => product.developerId === developerId);
}

export function upsertMarketplaceProduct(
  payload: ApiSubmissionPayload | ModelSubmissionPayload,
  developerName: string,
  marketplaceProductId?: string,
): SharedProduct {
  const state = readMarketplaceStore();
  const name = isApiPayload(payload) ? payload.formA.productName : payload.formA.modelName;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "product";
  const now = new Date().toISOString();
  const existing = state.products.find((product) =>
    (marketplaceProductId !== undefined && product.marketplaceProductId === marketplaceProductId)
    || (product.developerId === payload.formA.developerId && product.slug === slug),
  );
  const id = existing?.id ?? marketplaceProductId ?? newId("product");
  const sharedFields = {
    id,
    marketplaceProductId: marketplaceProductId ?? existing?.marketplaceProductId,
    slug,
    developerId: payload.formA.developerId,
    developerName,
    providerType: "third_party" as const,
    automatedChecks: existing?.automatedChecks ?? emptyChecks(),
    reviewNotes: existing?.reviewNotes ?? "",
    submittedAt: existing?.submittedAt ?? now,
    updatedAt: now,
    auditLogs: existing?.auditLogs ?? [
      { timestamp: now, actor: "developer", action: "Product submitted for review" },
    ],
  };
  const item: SharedProduct = isApiPayload(payload)
    ? { ...sharedFields, productType: "api", payload: { ...payload } }
    : { ...sharedFields, productType: "model", payload: { ...payload } };
  notifyStore({
    ...state,
    products: existing
      ? state.products.map((product) => product.id === existing.id ? item : product)
      : [item, ...state.products],
  });
  return item;
}

export function updateProductReview(
  id: string,
  status: SubmissionStatus,
  reviewNotes = "",
  actor = "admin@codos.console",
): SharedProduct {
  const state = readMarketplaceStore();
  const product = state.products.find((entry) => entry.id === id);
  if (!product) throw new Error(`Product submission ${id} was not found.`);
  const timestamp = new Date().toISOString();
  const sharedFields = {
    reviewNotes,
    updatedAt: timestamp,
    auditLogs: [
      ...product.auditLogs,
      {
        timestamp,
        actor,
        action: `Status changed to ${status}`,
        details: reviewNotes ? { reviewNotes } : undefined,
      },
    ],
  };
  const next: SharedProduct = product.productType === "api"
    ? { ...product, ...sharedFields, payload: { ...product.payload, status } }
    : { ...product, ...sharedFields, payload: { ...product.payload, status } };
  notifyStore({
    ...state,
    products: state.products.map((entry) => entry.id === id ? next : entry),
  });
  if (next.marketplaceProductId && ["Published", "Changes Requested", "Rejected", "Suspended"].includes(status)) {
    void updateMarketplaceProductStatus(
      next.marketplaceProductId,
      status as "Published" | "Changes Requested" | "Rejected" | "Suspended",
      reviewNotes,
      next.auditLogs,
    )
      .catch((error: unknown) => console.error("Could not sync marketplace product status.", error));
  }
  return next;
}

function payloadFromMarketplaceRecord(record: MarketplaceProductRecord & { product_type: "api" }): ApiSubmissionPayload;
function payloadFromMarketplaceRecord(record: MarketplaceProductRecord & { product_type: "model" }): ModelSubmissionPayload;
function payloadFromMarketplaceRecord(record: MarketplaceProductRecord): ApiSubmissionPayload | ModelSubmissionPayload;
function payloadFromMarketplaceRecord(record: MarketplaceProductRecord): ApiSubmissionPayload | ModelSubmissionPayload {
  const authMethod = record.auth_method as UpstreamAuthMethod;
  const healthCheckPath = record.health_check_url
    ? new URL(record.health_check_url).pathname
    : "";
  if (record.product_type === "api") {
    const firstPlan = record.pricing_plans?.[0];
    return {
      formA: {
        productName: record.name,
        shortDescription: record.short_description,
        detailedDescription: record.detailed_description,
        category: record.category,
        logoUrl: record.logo_url ?? "",
        developerId: record.developer_id,
      },
      formB: {
        hostingProvider: "Developer-Hosted",
        baseUrl: record.base_url,
        apiVersion: record.version,
        healthCheckPath,
        rateLimit: record.rate_limit_rpm,
      },
      formC: { openApiSpec: record.openapi_spec ? JSON.stringify(record.openapi_spec) : "" },
      formD: {
        authMethod,
        upstreamAuthHeader: record.upstream_auth_header ?? undefined,
      },
      formE: {
        pricingModel: record.pricing_plans?.map((plan) => String(plan.pricing_model ?? record.pricing_model)) ?? [record.pricing_model],
        pricePerRequest: typeof firstPlan?.price_per_request === "number" ? firstPlan.price_per_request : undefined,
        monthlyLimit: typeof firstPlan?.monthly_limit === "number" ? firstPlan.monthly_limit : undefined,
        freeTrialAllowance: typeof firstPlan?.free_trial_allowance === "number" ? firstPlan.free_trial_allowance : undefined,
        rpm: record.rate_limit_rpm,
      },
      formF: {
        ownershipConfirmed: true,
        commissionAccepted: true,
      },
      status: record.status,
    };
  }
  const pricingPlan = record.pricing_plans?.[0];
  return {
    formA: {
      modelName: record.name,
      shortDescription: record.short_description,
      detailedDescription: record.detailed_description,
      category: record.category,
      version: record.version,
      logoUrl: record.logo_url ?? "",
      developerId: record.developer_id,
      framework: "Developer-provided",
    },
    formB: {
      authMethod,
      upstreamAuthHeader: record.upstream_auth_header ?? undefined,
      inferenceEndpoint: record.base_url,
      healthCheckPath,
      expectedLatencyMs: record.avg_latency_ms ?? undefined,
    },
    formC: {
      inputType: (record.io_schema?.input_type as ModelSubmissionPayload["formC"]["inputType"]) ?? "text",
      outputType: (record.io_schema?.output_type as ModelSubmissionPayload["formC"]["outputType"]) ?? "json",
      processingMode: "synchronous",
      deliveryMethod: "direct",
      schemaJson: JSON.stringify(record.io_schema ?? {}),
    },
    formD: {},
    formE: {
      billingUnit: record.pricing_model as ModelSubmissionPayload["formE"]["billingUnit"],
      rate: typeof pricingPlan?.rate === "number" ? pricingPlan.rate : undefined,
    },
    formF: {
      ownershipConfirmed: true,
      prohibitedUseAgreement: true,
    },
    status: record.status,
  };
}

export async function syncMarketplaceProductsFromBackend(): Promise<void> {
  try {
    const records = await getAdminMarketplaceProducts();
    if (records === null) return;
    const state = readMarketplaceStore();
    const synced = records.map((record): SharedProduct => {
      const current = state.products.find((product) => product.marketplaceProductId === record.id);
      const developer = state.developers.find((entry) => entry.id === record.developer_id);
      const auditLogs = record.audit_logs ?? current?.auditLogs ?? [];
      const common = {
        id: current?.id ?? record.id,
        marketplaceProductId: record.id,
        slug: record.slug,
        developerId: record.developer_id,
        developerName: current?.developerName ?? developer?.developerName ?? record.developer_id,
        providerType: record.provider_type,
        automatedChecks: current?.automatedChecks ?? emptyChecks(),
        reviewNotes: record.review_notes ?? current?.reviewNotes ?? "",
        submittedAt: record.created_at,
        updatedAt: record.updated_at,
        featured: current?.featured ?? false,
        auditLogs,
      };
      if (record.product_type === "api") {
        let payload: ApiSubmissionPayload;
        if (current && current.productType === "api") {
          payload = { ...current.payload, status: record.status };
        } else {
          const converted = payloadFromMarketplaceRecord(record);
          if (!isApiPayload(converted)) {
            throw new Error(`Marketplace product ${record.id} was not an API product.`);
          }
          payload = converted;
        }
        return { ...common, productType: "api", payload };
      }
      let payload: ModelSubmissionPayload;
      if (current && current.productType === "model") {
        payload = { ...current.payload, status: record.status };
      } else {
        const converted = payloadFromMarketplaceRecord(record);
        if (isApiPayload(converted)) {
          throw new Error(`Marketplace product ${record.id} was not a model product.`);
        }
        payload = converted;
      }
      return { ...common, productType: "model", payload };
    });
    notifyStore({
      ...state,
      products: synced,
    });
  } catch (error) {
    console.error("Could not sync marketplace products from the backend.", error);
  }
}

export function updateProductChecks(
  id: string,
  checks: Record<AutomatedCheckKey, AutomatedCheckResult>,
  status: SubmissionStatus,
  summary: string,
): SharedProduct {
  const state = readMarketplaceStore();
  const product = state.products.find((entry) => entry.id === id);
  if (!product) throw new Error(`Product submission ${id} was not found.`);
  const timestamp = new Date().toISOString();
  const sharedFields = {
    automatedChecks: checks,
    reviewNotes: summary,
    updatedAt: timestamp,
    auditLogs: [
      ...product.auditLogs,
      { timestamp, actor: "admin@codos.console", action: "Automated checks completed", details: { summary } },
    ],
  };
  const next: SharedProduct = product.productType === "api"
    ? { ...product, ...sharedFields, payload: { ...product.payload, status } }
    : { ...product, ...sharedFields, payload: { ...product.payload, status } };
  notifyStore({
    ...state,
    products: state.products.map((entry) => entry.id === id ? next : entry),
  });
  if (next.marketplaceProductId && ["Published", "Changes Requested", "Rejected", "Suspended"].includes(status)) {
    void updateMarketplaceProductStatus(
      next.marketplaceProductId,
      status as "Published" | "Changes Requested" | "Rejected" | "Suspended",
      summary,
      next.auditLogs,
    )
      .catch((error: unknown) => console.error("Could not sync marketplace product checks.", error));
  }
  return next;
}

export function updateProductFeatured(id: string, featured: boolean): void {
  const state = readMarketplaceStore();
  const product = state.products.find((entry) => entry.id === id);
  if (!product) return;
  const timestamp = new Date().toISOString();
  const next: SharedProduct = {
    ...product,
    updatedAt: timestamp,
    auditLogs: [
      ...product.auditLogs,
      { timestamp, actor: "admin@codos.console", action: featured ? "Product featured" : "Product unfeatured" },
    ],
    featured,
  };
  notifyStore({
    ...state,
    products: state.products.map((entry) => entry.id === id ? next : entry),
  });
}

export function sharedProductsToAdmin(
  products: SharedProduct[],
  firstParty: AdminLiveProduct[],
): { submissions: AdminSubmissionItem[]; liveProducts: AdminLiveProduct[] } {
  const submissions = products.map(({ developerId: _developerId, marketplaceProductId: _dbId, slug: _slug, updatedAt: _updatedAt, featured: _featured, auditLogs: _auditLogs, ...submission }) => submission);
  const liveProducts = products
    .filter((product) => ["Published", "Suspended", "Unpublished"].includes(product.payload.status))
    .map((product) => ({
      id: product.id,
      slug: product.slug,
      name: product.productType === "api" ? product.payload.formA.productName : product.payload.formA.modelName,
      productType: product.productType,
      providerType: product.providerType,
      developerName: product.developerName,
      status: product.payload.status as AdminLiveProduct["status"],
        featured: Boolean(product.featured),
      updatedAt: product.updatedAt,
      complianceReason: product.reviewNotes || undefined,
      submissionId: product.id,
    }));
  return { submissions, liveProducts: [...firstParty, ...liveProducts] };
}

export function productAuditEntries(product: SharedProduct | undefined): Array<{ timestamp: string; actor: string; action: string; details?: Record<string, unknown> }> {
  if (!product) return [];
  return product.auditLogs;
}

export type SharedProductPayload = ApiSubmissionPayload | ModelSubmissionPayload;
