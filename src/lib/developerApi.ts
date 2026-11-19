// src/lib/developerApi.ts
// Typed API client for the Developer Portal.
// Uses native fetch; falls back to mock data when the backend is not live.

import type {
  ApiSubmissionPayload,
  ModelSubmissionPayload,
  DeveloperProfile,
  SubmissionStatus,
} from "../components/developer/types";
import type { CommercialSignoffInput, CommercialPricingTier } from "./commercialPricing";

const baseURL = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1/developer";
export const apiV1BaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
const gatewayBaseUrl =
  process.env.NEXT_PUBLIC_MARKETPLACE_GATEWAY_BASE_URL ?? "http://localhost:8000/api/v1/gateway";
const MARKETPLACE_ADMIN_TOKEN_KEY = "marketplace-admin-token";

export interface IntegrationSnippets {
  curl: string;
  python: string;
  typescript: string;
}

export interface MarketplaceIntegrationMetadata {
  gateway_url: string;
  public_page_url: string;
  integration_snippets: IntegrationSnippets;
}

export function isIntegrationSnippets(value: unknown): value is IntegrationSnippets {
  if (typeof value !== "object" || value === null) return false;
  const snippets = value as Record<string, unknown>;
  return ["curl", "python", "typescript"].every((key) => typeof snippets[key] === "string");
}

function getMarketplaceAdminToken(promptForToken: boolean): string | null {
  if (typeof window === "undefined") return null;
  const saved = window.sessionStorage.getItem(MARKETPLACE_ADMIN_TOKEN_KEY);
  if (saved) return saved;
  if (!promptForToken) return null;
  const token = window.prompt("Enter the Marketplace Admin Token to sync this action with the backend.");
  if (!token?.trim()) return null;
  window.sessionStorage.setItem(MARKETPLACE_ADMIN_TOKEN_KEY, token.trim());
  return token.trim();
}

export interface MarketplaceProductRecord {
  id: string;
  slug: string;
  developer_id: string;
  provider_type: "third_party" | "via_codos";
  product_type: "api" | "model";
  name: string;
  version: string;
  category: string;
  short_description: string;
  detailed_description: string;
  logo_url: string | null;
  base_url: string;
  health_check_url: string | null;
  gateway_url?: string;
  public_page_url?: string;
  integration_snippets?: IntegrationSnippets;
  auth_method: string;
  upstream_auth_header: string | null;
  openapi_spec: Record<string, unknown> | null;
  io_schema: Record<string, unknown> | null;
  pricing_model: string;
  pricing_plans: Array<Record<string, unknown>> | null;
  base_price?: number;
  pricing_tier?: CommercialPricingTier | null;
  profit_margin_percent?: number;
  final_retail_price: number;
  agreement_signed?: boolean;
  agreement_signed_by?: string | null;
  agreement_signed_at?: string | null;
  agreement_version?: string;
  rate_limit_rpm: number;
  avg_latency_ms: number | null;
  status: SubmissionStatus;
  review_notes: string;
  audit_logs: Array<{ timestamp: string; actor: string; action: string; details?: Record<string, unknown> }> | null;
  created_at: string;
  updated_at: string;
}

function firstOpenApiOperation(spec: string | Record<string, unknown> | null | undefined): {
  path: string;
  method: string;
  hasBody: boolean;
} {
  const methods = ["get", "post", "put", "patch", "delete"];
  if (typeof spec === "object" && spec !== null) {
    const paths = spec.paths;
    if (typeof paths === "object" && paths !== null) {
      for (const [path, operations] of Object.entries(paths)) {
        if (!/^\/[A-Za-z0-9._~:/{}-]*$/.test(path) || typeof operations !== "object" || operations === null) continue;
        const definition = operations as Record<string, unknown>;
        const method = methods.find((candidate) =>
          typeof definition[candidate] === "object" && definition[candidate] !== null,
        );
        if (method) {
          const operation = definition[method] as Record<string, unknown>;
          return {
            path,
            method: method.toUpperCase(),
            hasBody: "requestBody" in operation || ["post", "put", "patch"].includes(method),
          };
        }
      }
    }
    return { path: "/", method: "GET", hasBody: false };
  }
  if (typeof spec !== "string" || !spec.trim()) return { path: "/", method: "GET", hasBody: false };

  try {
    return firstOpenApiOperation(JSON.parse(spec) as Record<string, unknown>);
  } catch {
    const lines = spec.split(/\r?\n/);
    const pathsIndex = lines.findIndex((line) => /^\s*paths\s*:\s*(?:#.*)?$/.test(line));
    if (pathsIndex < 0) return { path: "/", method: "GET", hasBody: false };
    const pathsIndent = lines[pathsIndex].search(/\S/);
    for (let index = pathsIndex + 1; index < lines.length; index += 1) {
      const pathMatch = lines[index].match(/^(\s*)(["']?\/[^:'"]+["']?)\s*:\s*(?:#.*)?$/);
      if (!pathMatch) {
        const indent = lines[index].search(/\S/);
        if (indent >= 0 && indent <= pathsIndent) break;
        continue;
      }
      const pathIndent = pathMatch[1].length;
      const path = pathMatch[2].replace(/^["']|["']$/g, "");
      if (!/^\/[A-Za-z0-9._~:/{}-]*$/.test(path)) continue;
      const operations = new Set<string>();
      let hasRequestBody = false;
      for (let child = index + 1; child < lines.length; child += 1) {
        const indent = lines[child].search(/\S/);
        if (indent >= 0 && indent <= pathIndent) break;
        const methodMatch = lines[child].match(/^\s+(get|post|put|patch|delete)\s*:/i);
        if (methodMatch) operations.add(methodMatch[1].toLowerCase());
        if (/^\s+requestBody\s*:/.test(lines[child])) hasRequestBody = true;
      }
      const method = methods.find((candidate) => operations.has(candidate));
      if (method) {
        return {
          path,
          method: method.toUpperCase(),
          hasBody: hasRequestBody || ["post", "put", "patch"].includes(method),
        };
      }
    }
    return { path: "/", method: "GET", hasBody: false };
  }
}

function createIntegrationSnippets(
  gatewayUrl: string,
  endpointPath: string,
  method: string,
  hasBody: boolean,
): IntegrationSnippets {
  const path = endpointPath.replace(/^\/+/, "");
  const endpointUrl = path ? `${gatewayUrl}/${path}` : `${gatewayUrl}/`;
  const curlBody = hasBody ? " \\\n  --data '{\"input\": \"your input\"}'" : "";
  const pythonBody = hasBody ? '    json={"input": "your input"},\n' : "";
  const typescriptBody = hasBody ? '  body: JSON.stringify({ input: "your input" }),\n' : "";
  return {
    curl: `curl --request ${method} '${endpointUrl}' \\\n  --header 'X-CODOS-API-Key: YOUR_CODOS_API_KEY' \\\n  --header 'Content-Type: application/json'${curlBody}`,
    python: `import requests\n\nurl = "${endpointUrl}"\nheaders = {\n    "X-CODOS-API-Key": "YOUR_CODOS_API_KEY",\n    "Content-Type": "application/json",\n}\nresponse = requests.request(\n    "${method}", url, headers=headers,\n${pythonBody})\nresponse.raise_for_status()\nprint(response.json())`,
    typescript: `const response = await fetch("${endpointUrl}", {\n  method: "${method}",\n  headers: {\n    "X-CODOS-API-Key": "YOUR_CODOS_API_KEY",\n    "Content-Type": "application/json",\n  },\n${typescriptBody}});\nif (!response.ok) throw new Error(\`Request failed: \${response.status}\`);\nconst result = await response.json();\nconsole.log(result);`,
  };
}

export function generateMarketplaceIntegrationMetadata(
  productType: "api" | "model",
  slug: string,
  openapiSpec?: string | Record<string, unknown> | null,
  ioSchema?: Record<string, unknown> | null,
): MarketplaceIntegrationMetadata {
  const gateway_url = `${gatewayBaseUrl.replace(/\/+$/, "")}/${slug}`;
  const public_page_url = `/${productType === "api" ? "apis" : "models"}/${slug}`;
  let endpointPath: string;
  let method: string;
  let hasBody: boolean;
  if (productType === "api") {
    ({ path: endpointPath, method, hasBody } = firstOpenApiOperation(openapiSpec));
  } else {
    const inferencePath = ioSchema?.inference_path;
    endpointPath =
      typeof inferencePath === "string" && /^\/[A-Za-z0-9._~:/{}-]*$/.test(inferencePath)
        ? inferencePath
        : "/infer";
    method = "POST";
    hasBody = true;
  }
  return {
    gateway_url,
    public_page_url,
    integration_snippets: createIntegrationSnippets(gateway_url, endpointPath, method, hasBody),
  };
}

export interface MarketplaceDeveloperRecord {
  id: string;
  developer_name: string;
  company_name: string;
  email: string;
  email_verified: boolean;
  country: string;
  website: string | null;
  support_contact: string;
  status: "pending" | "approved" | "rejected" | "suspended";
  review_notes: string;
  audit_logs: Array<{ timestamp: string; actor: string; action: string; details?: Record<string, unknown> }> | null;
  submitted_at: string;
  created_at: string;
  updated_at: string;
}

type MarketplaceProductSubmission = {
  developer_id: string;
  provider_type: "third_party";
  product_type: "api" | "model";
  name: string;
  version: string;
  category: string;
  short_description: string;
  detailed_description: string;
  logo_url: string | null;
  base_url: string;
  health_check_url: string | null;
  auth_method: string;
  upstream_auth_header: string | null;
  upstream_api_key: string | null;
  openapi_spec: string | null;
  io_schema: Record<string, unknown> | null;
  pricing_model: string;
  pricing_plans: Array<Record<string, unknown>>;
  rate_limit_rpm: number;
  avg_latency_ms: number | null;
};

export async function postMarketplaceDeveloper(
  profile: DeveloperProfile,
): Promise<MarketplaceDeveloperRecord | null> {
  let response: Response;
  try {
    response = await fetch(`${apiV1BaseUrl}/marketplace/developers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: profile.id,
        developer_name: profile.developerName,
        company_name: profile.companyName ?? "",
        email: profile.email,
        email_verified: profile.emailVerified,
        country: profile.country,
        website: profile.website || null,
        support_contact: profile.supportContact,
      }),
    });
  } catch {
    return null;
  }
  if (!response.ok) {
    const detail = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(detail?.detail || `Developer registration failed (${response.status}).`);
  }
  return response.json() as Promise<MarketplaceDeveloperRecord>;
}

export async function getAdminMarketplaceDevelopers(): Promise<MarketplaceDeveloperRecord[] | null> {
  const url = `${apiV1BaseUrl}/marketplace/developers/admin`;
  let adminToken = getMarketplaceAdminToken(false);
  let response = await fetch(url, {
    headers: adminToken ? { "X-Admin-Token": adminToken } : {},
    cache: "no-store",
  });
  if (response.status === 403 && !adminToken) {
    adminToken = getMarketplaceAdminToken(true);
    if (!adminToken) return null;
    response = await fetch(url, {
      headers: { "X-Admin-Token": adminToken },
      cache: "no-store",
    });
  }
  if (!response.ok) throw new Error(`Marketplace developer request failed (${response.status}).`);
  return response.json() as Promise<MarketplaceDeveloperRecord[]>;
}

export async function updateMarketplaceDeveloperStatus(
  id: string,
  status: "pending" | "approved" | "rejected" | "suspended",
  reviewNotes: string,
  auditLogs: NonNullable<MarketplaceDeveloperRecord["audit_logs"]>,
): Promise<MarketplaceDeveloperRecord> {
  const adminToken = getMarketplaceAdminToken(true);
  if (!adminToken) throw new Error("Marketplace backend developer status was not updated because no admin token was provided.");
  const response = await fetch(`${apiV1BaseUrl}/marketplace/developers/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-Admin-Token": adminToken },
    body: JSON.stringify({ status, review_notes: reviewNotes, audit_logs: auditLogs }),
  });
  if (!response.ok) throw new Error(`Marketplace developer status update failed (${response.status}).`);
  return response.json() as Promise<MarketplaceDeveloperRecord>;
}

function healthCheckUrl(baseUrl: string, healthPath?: string): string | null {
  if (!healthPath?.trim()) return null;
  return new URL(healthPath.trim(), `${baseUrl.replace(/\/+$/, "")}/`).toString();
}

function apiProductSubmission(
  payload: ApiSubmissionPayload,
  upstreamCredential: string,
): MarketplaceProductSubmission {
  const formE = payload.formE;
  const paidPricingModels = formE.pricingModel.filter((pricingModel) => !/free|trial/i.test(pricingModel));
  const pricingModels = paidPricingModels.length ? paidPricingModels : ["pay_per_request"];
  return {
    developer_id: payload.formA.developerId,
    provider_type: "third_party",
    product_type: "api",
    name: payload.formA.productName,
    version: payload.formB.apiVersion || "1.0",
    category: payload.formA.category,
    short_description: payload.formA.shortDescription,
    detailed_description: payload.formA.detailedDescription,
    logo_url: payload.formA.logoUrl || null,
    base_url: payload.formB.baseUrl,
    health_check_url: healthCheckUrl(payload.formB.baseUrl, payload.formB.healthCheckPath),
    auth_method: payload.formD.authMethod || "none",
    upstream_auth_header: payload.formD.upstreamAuthHeader || null,
    upstream_api_key: payload.formD.authMethod !== "none" ? upstreamCredential || null : null,
    openapi_spec: payload.formC.openApiSpec || null,
    io_schema: null,
    pricing_model: pricingModels[0],
    pricing_plans: pricingModels.map((pricingModel) => ({
      pricing_model: pricingModel,
      price_per_request: formE.pricePerRequest ?? null,
      monthly_limit: formE.monthlyLimit ?? null,
    })),
    rate_limit_rpm: formE.rpm || payload.formB.rateLimit || 60,
    avg_latency_ms: null,
  };
}

function modelProductSubmission(
  payload: ModelSubmissionPayload,
  upstreamCredential: string,
): MarketplaceProductSubmission {
  let ioSchema: Record<string, unknown> | null = null;
  if (payload.formC.schemaJson?.trim()) {
    const parsedSchema = JSON.parse(payload.formC.schemaJson) as unknown;
    if (typeof parsedSchema !== "object" || parsedSchema === null || Array.isArray(parsedSchema)) {
      throw new Error("The model input/output schema must be a JSON object.");
    }
    ioSchema = {
      ...(parsedSchema as Record<string, unknown>),
      input_type: payload.formC.inputType,
      output_type: payload.formC.outputType,
    };
  } else {
    ioSchema = {
      input_type: payload.formC.inputType,
      output_type: payload.formC.outputType,
    };
  }
  return {
    developer_id: payload.formA.developerId,
    provider_type: "third_party",
    product_type: "model",
    name: payload.formA.modelName,
    version: payload.formA.version || "1.0",
    category: payload.formA.category || "Text generation & LLMs",
    short_description: payload.formA.shortDescription,
    detailed_description: payload.formA.detailedDescription,
    logo_url: payload.formA.logoUrl || null,
    base_url: payload.formB.inferenceEndpoint || "",
    health_check_url: healthCheckUrl(payload.formB.inferenceEndpoint || "", payload.formB.healthCheckPath),
    auth_method: payload.formB.authMethod || "none",
    upstream_auth_header: payload.formB.upstreamAuthHeader || null,
    upstream_api_key: payload.formB.authMethod !== "none" ? upstreamCredential || null : null,
    openapi_spec: null,
    io_schema: ioSchema,
    pricing_model: payload.formE.billingUnit || "per_inference",
    pricing_plans: [{
      pricing_model: payload.formE.billingUnit || "per_inference",
      rate: payload.formE.rate ?? null,
      limits: payload.formE.limits ?? null,
    }],
    rate_limit_rpm: 60,
    avg_latency_ms: payload.formB.expectedLatencyMs ?? null,
  };
}

async function postMarketplaceProduct(
  body: MarketplaceProductSubmission,
): Promise<MarketplaceProductRecord | null> {
  let response: Response;
  try {
    response = await fetch(`${apiV1BaseUrl}/marketplace/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return null;
  }
  if (!response.ok) {
    const detail = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(detail?.detail || `Marketplace submission failed (${response.status}).`);
  }
  return response.json() as Promise<MarketplaceProductRecord>;
}

export async function getPublishedMarketplaceProducts(): Promise<MarketplaceProductRecord[]> {
  const response = await fetch(`${apiV1BaseUrl}/marketplace/products`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Marketplace request failed (${response.status}).`);
  return response.json() as Promise<MarketplaceProductRecord[]>;
}

export async function getPublishedMarketplaceProduct(slug: string): Promise<MarketplaceProductRecord | null> {
  const response = await fetch(`${apiV1BaseUrl}/marketplace/products/${encodeURIComponent(slug)}`, { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Marketplace request failed (${response.status}).`);
  return response.json() as Promise<MarketplaceProductRecord>;
}

export async function updateMarketplaceProductStatus(
  id: string,
  status: "Approved" | "Published" | "Changes Requested" | "Rejected" | "Suspended",
  reviewNotes: string,
  auditLogs: Array<{ timestamp: string; actor: string; action: string; details?: Record<string, unknown> }>,
): Promise<MarketplaceProductRecord> {
  const adminToken = getMarketplaceAdminToken(true);
  if (!adminToken) throw new Error("Marketplace backend status was not updated because no admin token was provided.");
  const response = await fetch(`${apiV1BaseUrl}/marketplace/products/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-Admin-Token": adminToken },
    body: JSON.stringify({ status, review_notes: reviewNotes, audit_logs: auditLogs }),
  });
  if (!response.ok) throw new Error(`Marketplace status update failed (${response.status}).`);
  return response.json() as Promise<MarketplaceProductRecord>;
}

export async function postMarketplaceCommercialSignoff(
  id: string,
  payload: CommercialSignoffInput,
): Promise<MarketplaceProductRecord | null> {
  let response: Response;
  try {
    response = await fetch(
      `${apiV1BaseUrl}/marketplace/products/${encodeURIComponent(id)}/commercial-signoff`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
  } catch {
    return null;
  }
  if (!response.ok) {
    const detail = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(detail?.detail || `Commercial sign-off failed (${response.status}).`);
  }
  return response.json() as Promise<MarketplaceProductRecord>;
}

export async function getAdminMarketplaceProducts(): Promise<MarketplaceProductRecord[] | null> {
  const url = `${apiV1BaseUrl}/marketplace/products/admin`;
  let adminToken = getMarketplaceAdminToken(false);
  let response = await fetch(url, {
    headers: adminToken ? { "X-Admin-Token": adminToken } : {},
    cache: "no-store",
  });
  if (response.status === 403 && !adminToken) {
    adminToken = getMarketplaceAdminToken(true);
    if (!adminToken) return null;
    response = await fetch(url, {
      headers: { "X-Admin-Token": adminToken },
      cache: "no-store",
    });
  }
  if (!response.ok) throw new Error(`Marketplace admin request failed (${response.status}).`);
  return response.json() as Promise<MarketplaceProductRecord[]>;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${baseURL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json() as Promise<T>;
}

export const developerApi = {
  // ---------- Developer Profile ----------
  getProfile: async (devId: string): Promise<DeveloperProfile> => {
    try {
      return await apiFetch<DeveloperProfile>(`/profile/${devId}`);
    } catch {
      const { getMockProfile } = await import("../components/developer/mockDeveloperData");
      return getMockProfile(devId);
    }
  },
  updateProfile: async (devId: string, payload: Partial<DeveloperProfile>): Promise<DeveloperProfile> => {
    try {
      return await apiFetch<DeveloperProfile>(`/profile/${devId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.error("Failed to update profile", e);
      throw e;
    }
  },

  // ---------- API Submissions ----------
  listApis: async (devId: string): Promise<ApiSubmissionPayload[]> => {
    try {
      return await apiFetch<ApiSubmissionPayload[]>(`/apis?owner=${devId}`);
    } catch {
      const { getMockApis } = await import("../components/developer/mockDeveloperData");
      return getMockApis(devId);
    }
  },
  getApi: async (apiId: string): Promise<ApiSubmissionPayload> => {
    try {
      return await apiFetch<ApiSubmissionPayload>(`/apis/${apiId}`);
    } catch {
      const { getMockApiById } = await import("../components/developer/mockDeveloperData");
      return getMockApiById(apiId);
    }
  },
  saveApiDraft: async (payload: ApiSubmissionPayload): Promise<void> => {
    await apiFetch(`/apis/draft`, { method: "POST", body: JSON.stringify(payload) });
  },
  submitApi: async (apiId: string): Promise<{ status: SubmissionStatus }> => {
    return apiFetch<{ status: SubmissionStatus }>(`/apis/${apiId}/submit`, { method: "POST" });
  },
  submitMarketplaceApi: async (payload: ApiSubmissionPayload, upstreamCredential: string) =>
    postMarketplaceProduct(apiProductSubmission(payload, upstreamCredential)),

  // ---------- Model Submissions ----------
  listModels: async (devId: string): Promise<ModelSubmissionPayload[]> => {
    try {
      return await apiFetch<ModelSubmissionPayload[]>(`/models?owner=${devId}`);
    } catch {
      const { getMockModels } = await import("../components/developer/mockDeveloperData");
      return getMockModels(devId);
    }
  },
  getModel: async (modelId: string): Promise<ModelSubmissionPayload> => {
    try {
      return await apiFetch<ModelSubmissionPayload>(`/models/${modelId}`);
    } catch {
      const { getMockModelById } = await import("../components/developer/mockDeveloperData");
      return getMockModelById(modelId);
    }
  },
  saveModelDraft: async (payload: ModelSubmissionPayload): Promise<void> => {
    await apiFetch(`/models/draft`, { method: "POST", body: JSON.stringify(payload) });
  },
  submitModel: async (modelId: string): Promise<{ status: SubmissionStatus }> => {
    return apiFetch<{ status: SubmissionStatus }>(`/models/${modelId}/submit`, { method: "POST" });
  },
  submitMarketplaceModel: async (payload: ModelSubmissionPayload, upstreamCredential: string) =>
    postMarketplaceProduct(modelProductSubmission(payload, upstreamCredential)),
};
