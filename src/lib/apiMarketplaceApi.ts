import {
  apiV1BaseUrl,
  getPublishedMarketplaceProducts,
  type MarketplaceProductRecord,
} from "./developerApi";
import { readMarketplaceStore } from "./marketplaceStore";
import type { ApiSubmissionFormD } from "@/components/developer/types";
import type {
  ApiAuthMethod,
  ApiCategory,
  ApiEndpointSpec,
  ApiPricingModel,
  ApiPricingPlan,
  MarketplaceApi,
} from "@/components/api-marketplace/types";

const plans = (price: string, rpm: number, limit: number): ApiPricingPlan[] => [
  {
    id: "free",
    name: "Free / Trial",
    pricingModel: "free",
    priceDisplay: "Free",
    monthlyRequestLimit: Math.min(limit, 1000),
    rateLimitRpm: Math.min(rpm, 60),
    overageRate: "Not available",
    description: "Evaluate the API with a small monthly request allowance.",
  },
  {
    id: "pay-per-request",
    name: "Pay-per-Request",
    pricingModel: "pay_per_request",
    priceDisplay: price,
    monthlyRequestLimit: null,
    rateLimitRpm: rpm,
    overageRate: price,
    description: "Scale usage without a monthly commitment.",
  },
  {
    id: "pro-monthly",
    name: "Pro Monthly",
    pricingModel: "monthly_subscription",
    priceDisplay: "$49 / month",
    monthlyRequestLimit: limit,
    rateLimitRpm: rpm * 2,
    overageRate: price,
    description: "Higher quota and priority support for production workloads.",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    pricingModel: "tiered",
    priceDisplay: "Custom",
    monthlyRequestLimit: null,
    rateLimitRpm: rpm * 10,
    overageRate: "Contract rate",
    description: "Custom limits, security review, and a dedicated support path.",
  },
];

function endpoint(
  id: string,
  method: ApiEndpointSpec["method"],
  path: string,
  summary: string,
  requestBodySchema: Record<string, unknown> | undefined,
  exampleRequest: Record<string, unknown> | undefined,
  exampleResponse: Record<string, unknown>,
  parameters: ApiEndpointSpec["parameters"] = [],
): ApiEndpointSpec {
  return {
    id,
    method,
    path,
    summary,
    parameters,
    requestBodySchema,
    responseSchema: { type: "object", properties: Object.fromEntries(Object.keys(exampleResponse).map((key) => [key, { type: typeof exampleResponse[key] }])) },
    exampleRequest,
    exampleResponse,
    errorCodes: [
      { code: 400, description: "Invalid request parameters or payload." },
      { code: 401, description: "Missing or invalid API credentials." },
      { code: 429, description: "Rate limit exceeded; retry after the indicated interval." },
      { code: 500, description: "Unexpected service error." },
    ],
  };
}

const firstPartyApis: MarketplaceApi[] = [
  {
    id: "via-thumbs-up",
    slug: "thumbs-up-api",
    name: "Thumbs Up API",
    tagline: "Secure API gateway, keys, and request policies",
    description: "Via Codos API gateway services for scoped key management, signed webhooks, and tenant-level rate limits.",
    providerType: "via_codos",
    developerName: "Via Codos",
    developerVerified: true,
    supportContact: "support@viacodos.com",
    category: "Developer Tools",
    version: "v1.5",
    baseUrl: "https://api.viacodos.com/v1",
    authMethod: "API Key",
    uptimeSla: 99.99,
    avgLatencyMs: 18,
    rateLimitRpm: 3000,
    endpoints: [
      endpoint("keys-list", "GET", "/gateway/keys", "List active scoped API keys.", undefined, undefined, { keys: [{ id: "key_01", prefix: "sk_live", active: true }] }),
      endpoint("keys-rotate", "POST", "/gateway/keys/rotate", "Rotate an API key with a configurable grace period.", { type: "object", required: ["key_id"], properties: { key_id: { type: "string" }, grace_period_seconds: { type: "integer" }, scopes: { type: "array", items: { type: "string" } } } }, { key_id: "key_live_01", grace_period_seconds: 3600, scopes: ["api:read"] }, { status: "rotated", key_id: "key_live_02", expires_in: 3600 }),
      endpoint("ratelimit-create", "POST", "/gateway/policies/ratelimit", "Create a token-bucket rate limit policy.", { type: "object", required: ["service", "requests_per_second"], properties: { service: { type: "string" }, requests_per_second: { type: "integer" }, burst_capacity: { type: "integer" } } }, { service: "orders", requests_per_second: 500, burst_capacity: 800 }, { policy_id: "pol_01", active: true }),
    ],
    pricingPlans: plans("$0.001 / request", 3000, 100000),
    status: "Published",
  },
  {
    id: "via-call-colleague",
    slug: "call-colleague-api",
    name: "Call Colleague Telephony & Agent API",
    tagline: "Dispatch autonomous voice colleagues with live context",
    description: "Create and manage AI voice sessions, dispatch calls, and retrieve transcripts through Via Codos telephony APIs.",
    providerType: "via_codos",
    developerName: "Via Codos",
    developerVerified: true,
    supportContact: "voice-support@viacodos.com",
    category: "Voice & Communications",
    version: "v1.4",
    baseUrl: "https://api.viacodos.com/v1/voice",
    authMethod: "Bearer Token",
    uptimeSla: 99.95,
    avgLatencyMs: 72,
    rateLimitRpm: 600,
    endpoints: [
      endpoint("voice-dispatch", "POST", "/colleague/dispatch", "Start an inbound or outbound AI voice call.", { type: "object", required: ["recipient_phone", "persona"], properties: { recipient_phone: { type: "string" }, persona: { type: "string" }, context: { type: "object" }, record_call: { type: "boolean" } } }, { recipient_phone: "+15550198273", persona: "support_agent", context: { account_id: "acct_01" }, record_call: true }, { status: "connected", session_id: "call_01", edge_latency_ms: 72 }),
      endpoint("voice-session", "GET", "/calls/{session_id}", "Get call state and session metadata.", undefined, undefined, { session_id: "call_01", state: "connected", duration_seconds: 18 }, [{ name: "session_id", location: "path", required: true, description: "Call session identifier.", type: "string" }]),
      endpoint("voice-transcript", "GET", "/calls/{session_id}/transcript", "Retrieve speaker-diarized transcript and action items.", undefined, undefined, { session_id: "call_01", transcript: [], sentiment: "positive" }, [{ name: "session_id", location: "path", required: true, description: "Call session identifier.", type: "string" }]),
    ],
    pricingPlans: plans("$0.08 / minute", 600, 25000),
    status: "Published",
  },
  {
    id: "via-skybeak-rag",
    slug: "skybeak-rag-inference-api",
    name: "SkyBeak RAG & Inference API",
    tagline: "Grounded enterprise inference with retrieval context",
    description: "Invoke configured SkyBeak models with optional indexed documents and database context using Via Codos inference endpoints.",
    providerType: "via_codos",
    developerName: "Via Codos",
    developerVerified: true,
    supportContact: "skybeak@viacodos.com",
    category: "AI & NLP",
    version: "v1.2",
    baseUrl: "https://api.viacodos.com/v1/skybeak",
    authMethod: "Bearer Token",
    uptimeSla: 99.9,
    avgLatencyMs: 420,
    rateLimitRpm: 1200,
    endpoints: [
      endpoint("skybeak-chat", "POST", "/models/{model_id}/chat", "Run a model completion with optional RAG context.", { type: "object", required: ["message"], properties: { message: { type: "string" }, use_rag: { type: "boolean" }, temperature: { type: "number" } } }, { message: "Summarize the current refund policy.", use_rag: true, temperature: 0.4 }, { reply: "The refund policy allows...", sources_used: ["refund-policy.pdf"], latency_ms: 420, tokens: 86 }, [{ name: "model_id", location: "path", required: true, description: "Configured SkyBeak model ID.", type: "string" }]),
      endpoint("skybeak-models", "GET", "/models", "List configured models available to the authenticated user.", undefined, undefined, { models: [{ id: "model_01", name: "Operations Assistant", status: "READY" }] }),
      endpoint("skybeak-history", "GET", "/models/{model_id}/chat/history", "Read recent chat history for a configured model.", undefined, undefined, { messages: [] }, [{ name: "model_id", location: "path", required: true, description: "Configured SkyBeak model ID.", type: "string" }]),
    ],
    pricingPlans: plans("$0.002 / 1K tokens", 1200, 500000),
    status: "Published",
  },
];

const representativeApis: MarketplaceApi[] = [
  {
    id: "third-doc-ocr",
    slug: "document-ocr-api",
    name: "Document OCR & Extraction",
    tagline: "Extract searchable text and structured fields from documents",
    description: "Convert invoices, forms, and scanned documents into normalized JSON with confidence scores.",
    providerType: "third_party",
    developerName: "Nimbus Vision Labs",
    developerVerified: true,
    supportContact: "support@nimbusvision.dev",
    category: "Document & OCR",
    version: "v2.4",
    baseUrl: "https://api.nimbusvision.dev/v2",
    authMethod: "API Key",
    uptimeSla: 99.9,
    avgLatencyMs: 860,
    rateLimitRpm: 300,
    endpoints: [
      endpoint("ocr-extract", "POST", "/documents/extract", "Extract text, tables, and key-value pairs from a document.", { type: "object", required: ["document_url"], properties: { document_url: { type: "string", format: "uri" }, language: { type: "string" }, include_tables: { type: "boolean" } } }, { document_url: "https://files.example.org/invoice.pdf", language: "en", include_tables: true }, { job_id: "doc_01", status: "completed", fields: { invoice_number: "INV-1042", total: 1240 }, confidence: 0.97 }),
      endpoint("ocr-job", "GET", "/documents/{job_id}", "Get extraction result and processing status.", undefined, undefined, { job_id: "doc_01", status: "completed", result_url: "https://api.nimbusvision.dev/results/doc_01" }, [{ name: "job_id", location: "path", required: true, description: "Extraction job ID.", type: "string" }]),
    ],
    pricingPlans: plans("$0.012 / document", 300, 25000),
    status: "Published",
  },
  {
    id: "third-currency",
    slug: "currency-exchange-api",
    name: "Global Currency Exchange API",
    tagline: "Live and historical FX rates for payment flows",
    description: "Retrieve exchange rates and convert values across a broad set of supported currencies.",
    providerType: "third_party",
    developerName: "Northstar Data",
    developerVerified: true,
    supportContact: "api@northstardata.dev",
    category: "Finance & Payments",
    version: "v1.8",
    baseUrl: "https://fx.northstardata.dev/api",
    authMethod: "API Key",
    uptimeSla: 99.95,
    avgLatencyMs: 95,
    rateLimitRpm: 1200,
    endpoints: [
      endpoint("fx-latest", "GET", "/rates/latest", "Get latest rates for a base currency.", undefined, undefined, { base: "USD", date: "2026-11-18", rates: { LKR: 302.4, EUR: 0.92 } }, [{ name: "base", location: "query", required: false, description: "Three-letter ISO currency code.", type: "string" }, { name: "symbols", location: "query", required: false, description: "Comma-separated target currency codes.", type: "string" }]),
      endpoint("fx-convert", "POST", "/convert", "Convert an amount using the latest available rate.", { type: "object", required: ["from", "to", "amount"], properties: { from: { type: "string" }, to: { type: "string" }, amount: { type: "number" } } }, { from: "USD", to: "LKR", amount: 25 }, { from: "USD", to: "LKR", amount: 25, result: 7560, rate: 302.4 }),
    ],
    pricingPlans: plans("$0.001 / request", 1200, 100000),
    status: "Published",
  },
  {
    id: "third-crm",
    slug: "crm-sync-api",
    name: "Customer 360 Sync API",
    tagline: "Unify customer profiles and engagement events",
    description: "Synchronize CRM profiles and activity timelines across business systems using idempotent API operations.",
    providerType: "third_party",
    developerName: "Orbit CRM Connect",
    developerVerified: true,
    supportContact: "support@orbitconnect.dev",
    category: "Enterprise & CRM",
    version: "v3.0",
    baseUrl: "https://api.orbitconnect.dev/v3",
    authMethod: "OAuth 2.0",
    uptimeSla: 99.9,
    avgLatencyMs: 140,
    rateLimitRpm: 900,
    endpoints: [
      endpoint("crm-contact", "GET", "/contacts/{contact_id}", "Fetch a normalized customer profile.", undefined, undefined, { id: "ct_01", email: "customer@example.org", attributes: {} }, [{ name: "contact_id", location: "path", required: true, description: "CRM contact ID.", type: "string" }]),
      endpoint("crm-upsert", "PUT", "/contacts/{contact_id}", "Create or update a customer profile.", { type: "object", properties: { email: { type: "string", format: "email" }, attributes: { type: "object" } } }, { email: "customer@example.org", attributes: { plan: "pro" } }, { id: "ct_01", updated: true }, [{ name: "contact_id", location: "path", required: true, description: "CRM contact ID.", type: "string" }]),
    ],
    pricingPlans: plans("$0.002 / request", 900, 75000),
    status: "Published",
  },
];

function normalizeAuth(method: ApiSubmissionFormD["authMethod"] | undefined): ApiAuthMethod {
  switch (method) {
    case "api_key": return "API Key";
    case "bearer": return "Bearer Token";
    case "oauth2": return "OAuth 2.0";
    case "basic": return "Basic Auth";
    case "none": return "None";
    default: return "None";
  }
}

function categoryFromSubmission(category: string): ApiCategory {
  const value = category.toLowerCase();
  if (value.includes("voice") || value.includes("communication")) return "Voice & Communications";
  if (value.includes("finance") || value.includes("payment")) return "Finance & Payments";
  if (value.includes("data") || value.includes("analytics")) return "Data & Analytics";
  if (value.includes("document") || value.includes("ocr")) return "Document & OCR";
  if (value.includes("crm") || value.includes("enterprise")) return "Enterprise & CRM";
  if (value.includes("ai") || value.includes("nlp") || value.includes("model")) return "AI & NLP";
  return "Developer Tools";
}

function parseOpenApiSpec(raw: string): ApiEndpointSpec[] {
  try {
    const spec = JSON.parse(raw) as {
      paths?: Record<string, Record<string, {
        summary?: string;
        description?: string;
        parameters?: Array<{ name: string; in: string; required?: boolean; description?: string; schema?: { type?: string } }>;
        requestBody?: { content?: Record<string, { schema?: Record<string, unknown> }> };
        responses?: Record<string, { description?: string; content?: Record<string, { schema?: Record<string, unknown>; example?: Record<string, unknown> }> }>;
      }>>;
    };
    const result: ApiEndpointSpec[] = [];
    for (const [path, methods] of Object.entries(spec.paths ?? {})) {
      for (const [method, operation] of Object.entries(methods)) {
        if (!["get", "post", "put", "patch", "delete"].includes(method.toLowerCase())) continue;
        const success = operation.responses?.["200"] ?? operation.responses?.["201"];
        result.push({
          id: `${method}-${path}`,
          method: method.toUpperCase() as ApiEndpointSpec["method"],
          path,
          summary: operation.summary || operation.description || `${method.toUpperCase()} ${path}`,
          parameters: (operation.parameters ?? []).flatMap((parameter) => {
            if (!["path", "query", "header"].includes(parameter.in)) return [];
            return [{
              name: parameter.name,
              location: parameter.in as "path" | "query" | "header",
              required: Boolean(parameter.required),
              description: parameter.description || "",
              type: parameter.schema?.type,
            }];
          }),
          requestBodySchema: operation.requestBody?.content?.["application/json"]?.schema,
          responseSchema: success?.content?.["application/json"]?.schema ?? {},
          exampleRequest: {},
          exampleResponse: success?.content?.["application/json"]?.example ?? {},
          errorCodes: [{ code: 400, description: "Invalid request." }, { code: 401, description: "Unauthorized." }, { code: 429, description: "Rate limit exceeded." }],
        });
      }
    }
    if (result.length) return result;
  } catch {
    // Phase 2 accepts YAML as well; show a useful generic operation when it cannot be parsed here.
  }
  return [endpoint("api-request", "POST", "/", "Send a request to this published API.", { type: "object", properties: { input: { type: "object" } } }, { input: {} }, { status: "accepted" })];
}

function marketplacePricingPlans(product: MarketplaceProductRecord): ApiPricingPlan[] {
  const planUnit = product.pricing_model.includes("month") || product.pricing_model === "subscription"
    ? "month"
    : product.pricing_model === "per_token"
      ? "1K tokens"
      : product.pricing_model === "per_image"
        ? "image"
        : "request";
  const retailPrice = `$${product.final_retail_price.toFixed(6)} / ${planUnit}`;
  if (!product.pricing_plans?.length) {
    return plans(retailPrice, product.rate_limit_rpm, 10000);
  }
  const marketplacePlans = product.pricing_plans.map((plan, index) => {
    const rawModel = String(plan.pricing_model ?? product.pricing_model);
    const pricingModel: ApiPricingModel = ["free", "pay_per_request", "monthly_subscription", "tiered"].includes(rawModel)
      ? rawModel as ApiPricingModel
      : "pay_per_request";
    const requestPrice = typeof plan.price_per_request === "number" ? plan.price_per_request : null;
    return {
      id: `${product.slug}-plan-${index + 1}`,
      name: String(plan.name ?? rawModel.replaceAll("_", " ")),
      pricingModel,
      priceDisplay: requestPrice === null ? (pricingModel === "free" ? "Free" : "Custom") : `$${requestPrice} / request`,
      monthlyRequestLimit: typeof plan.monthly_limit === "number" ? plan.monthly_limit : null,
      rateLimitRpm: product.rate_limit_rpm,
      overageRate: requestPrice === null ? "Contract rate" : `$${requestPrice} / request`,
      description: typeof plan.description === "string" ? plan.description : "Developer-defined marketplace plan.",
    };
  });
  return marketplacePlans.map((plan) => ({
    ...plan,
    priceDisplay: plan.pricingModel === "free" ? "Free" : retailPrice,
    overageRate: plan.pricingModel === "free" ? "Not available" : retailPrice,
  }));
}

function normalizeLocalMarketplaceApis(): MarketplaceApi[] {
  return readMarketplaceStore().products.flatMap((product) => {
      if (product.productType !== "api" || product.payload.status !== "Published" || !product.agreementSigned) return [];
      const payload = product.payload;
      return [{
        id: product.marketplaceProductId ?? product.id,
        slug: product.slug,
        name: payload.formA.productName,
        tagline: payload.formA.shortDescription,
        description: payload.formA.detailedDescription,
        providerType: "third_party",
        developerName: product.developerName,
        developerVerified: true,
        supportContact: "Developer support via CODOS",
        category: categoryFromSubmission(payload.formA.category),
        version: payload.formB.apiVersion || "1.0",
        baseUrl: `${apiV1BaseUrl}/gateway/${product.slug}`,
        authMethod: normalizeAuth(payload.formD.authMethod),
        uptimeSla: payload.formB.availabilityPct ?? 99.9,
        avgLatencyMs: product.payload.formB.timeoutMs ?? 250,
        rateLimitRpm: payload.formE.rpm ?? 60,
        endpoints: parseOpenApiSpec(payload.formC.openApiSpec),
        pricingPlans: plans(
          `$${product.finalRetailPrice.toFixed(6)} / request`,
          payload.formE.rpm ?? 60,
          payload.formE.monthlyLimit ?? 10000,
        ),
        status: payload.status,
      }];
    });
}

function normalizeMarketplaceProducts(products: MarketplaceProductRecord[]): MarketplaceApi[] {
  return products
    .filter((product) => product.product_type === "api")
    .map((product) => {
      const baseUrl = `${apiV1BaseUrl}/gateway/${product.slug}`;
      const spec = typeof product.openapi_spec === "string"
        ? product.openapi_spec
        : JSON.stringify(product.openapi_spec ?? {});
      return {
        id: product.id,
        slug: product.slug,
        name: product.name,
        tagline: product.short_description,
        description: product.detailed_description,
        providerType: "third_party",
        developerName: product.developer_id,
        developerVerified: true,
        supportContact: "Developer support via CODOS",
        category: categoryFromSubmission(product.category),
        version: product.version,
        baseUrl,
        authMethod: normalizeAuth(product.auth_method as ApiSubmissionFormD["authMethod"]),
        uptimeSla: 99.9,
        avgLatencyMs: product.avg_latency_ms ?? 250,
        rateLimitRpm: product.rate_limit_rpm,
        endpoints: parseOpenApiSpec(spec),
        pricingPlans: marketplacePricingPlans(product),
        status: product.status,
      };
    });
}

export async function getMarketplaceApis(): Promise<MarketplaceApi[]> {
  let databaseApis: MarketplaceApi[] = [];
  let marketplaceBackendAvailable = false;
  try {
    databaseApis = normalizeMarketplaceProducts(await getPublishedMarketplaceProducts());
    marketplaceBackendAvailable = true;
  } catch {
    databaseApis = [];
  }
  const bySlug = new Map<string, MarketplaceApi>();
  for (const api of [...firstPartyApis, ...representativeApis]) bySlug.set(api.slug, api);
  for (const api of databaseApis) bySlug.set(api.slug, api);
  if (!marketplaceBackendAvailable) {
    for (const api of normalizeLocalMarketplaceApis()) bySlug.set(api.slug, api);
  }
  return Array.from(bySlug.values()).map((api) => ({
    ...api,
    baseUrl: `${apiV1BaseUrl}/gateway/${api.slug}`,
  }));
}

export async function getMarketplaceApiBySlug(slug: string): Promise<MarketplaceApi | null> {
  const apis = await getMarketplaceApis();
  return apis.find((api) => api.slug === slug) ?? null;
}

export const API_CATEGORIES: ApiCategory[] = [
  "AI & NLP",
  "Voice & Communications",
  "Finance & Payments",
  "Data & Analytics",
  "Developer Tools",
  "Document & OCR",
  "Enterprise & CRM",
];

export const API_AUTH_METHODS: ApiAuthMethod[] = [
  "API Key",
  "Bearer Token",
  "OAuth 2.0",
  "Basic Auth",
  "None",
];

export const API_PRICING_MODELS: ApiPricingModel[] = [
  "free",
  "pay_per_request",
  "monthly_subscription",
  "tiered",
];
