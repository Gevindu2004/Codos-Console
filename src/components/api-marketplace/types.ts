export type ApiProviderType = "via_codos" | "third_party";

export type ApiCategory =
  | "AI & NLP"
  | "Voice & Communications"
  | "Finance & Payments"
  | "Data & Analytics"
  | "Developer Tools"
  | "Document & OCR"
  | "Enterprise & CRM";

export type ApiAuthMethod =
  | "API Key"
  | "Bearer Token"
  | "OAuth 2.0"
  | "Basic Auth"
  | "None";

export type ApiPricingModel =
  | "pay_per_request"
  | "monthly_subscription"
  | "tiered";

export interface ApiEndpointSpec {
  id: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  summary: string;
  parameters: Array<{
    name: string;
    location: "path" | "query" | "header";
    required: boolean;
    description: string;
    type?: string;
  }>;
  requestBodySchema?: Record<string, unknown>;
  responseSchema: Record<string, unknown>;
  exampleRequest?: Record<string, unknown>;
  exampleResponse: Record<string, unknown>;
  errorCodes: Array<{ code: number; description: string }>;
}

export interface ApiPricingPlan {
  id: string;
  name: "Pay-per-Request" | "Pro Monthly" | "Enterprise" | string;
  pricingModel: ApiPricingModel;
  priceDisplay: string;
  monthlyRequestLimit: number | null;
  rateLimitRpm: number;
  overageRate: string;
  description: string;
}

export interface MarketplaceApi {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  providerType: ApiProviderType;
  developerName: string;
  developerVerified: boolean;
  supportContact: string;
  category: ApiCategory;
  version: string;
  baseUrl: string;
  authMethod: ApiAuthMethod;
  uptimeSla: number;
  avgLatencyMs: number;
  rateLimitRpm: number;
  endpoints: ApiEndpointSpec[];
  pricingPlans: ApiPricingPlan[];
  status: string;
}

export interface CustomerApiKey {
  id: string;
  apiSlug: string;
  name: string;
  keyPrefix: string;
  maskedKey: string;
  environment: "live" | "trial";
  rateLimitRpm: number;
  createdAt: string;
  lastUsedAt: string | null;
  isActive: boolean;
}

export interface ApiUsageRecord {
  id: string;
  timestamp: string;
  endpoint: string;
  method: ApiEndpointSpec["method"];
  statusCode: number;
  latencyMs: number;
  tokensOrUnits: number;
}
