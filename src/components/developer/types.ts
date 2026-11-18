// src/components/developer/types.ts
// Type definitions for the Developer Portal

export type SubmissionStatus =
  | "Draft"
  | "Submitted"
  | "Validating"
  | "Testing"
  | "Under Review"
  | "Changes Requested"
  | "Approved"
  | "Published"
  | "Rejected"
  | "Suspended"
  | "Unpublished";

export type ProductType = "api" | "model";
export type HostingMethod = "developer_hosted" | "codos_hosted";

export interface DeveloperProfile {
  id: string;
  developerName: string;
  companyName: string;
  email: string;
  emailVerified: boolean;
  country: string;
  website?: string;
  supportContact?: string;
  payoutMethod: "bank" | "stripe" | "paypal" | "none";
  payoutDetails?: Record<string, any>;
  status: "unregistered" | "pending" | "approved" | "rejected";
}

// ---- API Submission payload (Forms A‑F) ----
export interface ApiSubmissionFormA {
  productName: string;
  shortDescription: string;
  detailedDescription: string;
  category: string;
  logoUrl?: string;
  developerId: string;
}
export interface ApiSubmissionFormB {
  hostingProvider: string;
  baseUrl: string; // must be HTTPS
  apiVersion?: string;
  healthCheckPath?: string;
  region?: string;
  availabilityPct?: number;
  rateLimit?: number;
  timeoutMs?: number;
}
export interface ApiSubmissionFormC {
  openApiSpec: string; // raw JSON/YAML string
}
export interface ApiSubmissionFormD {
  authMethod: "api_key" | "bearer" | "basic" | "oauth2" | "none";
  credentialsMasked?: string; // never store raw secret on client
}
export interface ApiSubmissionFormE {
  pricingModel: string[]; // e.g. ["free", "pay_per_request"]
  pricePerRequest?: number;
  freeTrialAllowance?: number;
  monthlyLimit?: number;
  rpm?: number;
  maxConcurrency?: number;
}
export interface ApiSubmissionFormF {
  ownershipConfirmed: boolean;
  privacyPolicyUrl?: string;
  termsOfServiceUrl?: string;
  dataHandlingNotes?: string;
  commissionAccepted: boolean;
}

export interface ApiSubmissionPayload {
  formA: ApiSubmissionFormA;
  formB: ApiSubmissionFormB;
  formC: ApiSubmissionFormC;
  formD: ApiSubmissionFormD;
  formE: ApiSubmissionFormE;
  formF: ApiSubmissionFormF;
  status: SubmissionStatus;
}

// ---- Model Submission payload (Forms A‑F) ----
export interface ModelSubmissionFormA {
  modelName: string;
  shortDescription: string;
  detailedDescription: string;
  category: string;
  version: string;
  logoUrl?: string;
  developerId: string;
  useCases?: string[];
  supportedLanguages?: string[];
  architecture?: string;
  framework: string; // e.g. "pytorch"
  baseModel?: string;
  fineTuned?: boolean;
}
export interface ModelSubmissionFormB {
  hostingMethod: HostingMethod;
  // Developer‑hosted fields
  inferenceEndpoint?: string; // HTTPS URL when developer_hosted
  hostingProvider?: string;
  healthCheckPath?: string;
  expectedLatencyMs?: number;
  availabilityPct?: number;
  maxRequestSizeMb?: number;
  // CODOS‑hosted fields
  dockerImageTag?: string;
  bundleArchiveUrl?: string;
  requiredRamGb?: number;
  requiredGpu?: string;
  runtimeVersion?: string;
  dependenciesFileUrl?: string;
  startupCommand?: string;
  entrypoint?: string;
}
export interface ModelSubmissionFormC {
  inputType: "text" | "image" | "audio" | "video" | "document" | "json";
  inputFormats?: string[];
  maxInputSizeMb?: number;
  outputType: "text" | "image" | "audio" | "video" | "document" | "json";
  outputFormats?: string[];
  processingMode: "synchronous" | "asynchronous";
  deliveryMethod: "direct" | "download_url";
  schemaJson?: string; // UI playground schema
}
export interface ModelSubmissionFormD {
  sampleInputs?: string[]; // URLs or prompt snippets
  sampleOutputs?: string[];
  benchmarkScore?: number;
  maxProcessingTimeMs?: number;
  knownLimitations?: string;
}
export interface ModelSubmissionFormE {
  billingUnit: "free" | "per_inference" | "per_image" | "per_video_min" | "per_audio_min" | "per_token" | "subscription" | "credit_package";
  rate?: number;
  limits?: string;
}
export interface ModelSubmissionFormF {
  ownershipConfirmed: boolean;
  baseModelLicense?: string;
  trainingDataRights?: string;
  privacyPolicyUrl?: string;
  termsOfServiceUrl?: string;
  prohibitedUseAgreement: boolean;
}

export interface ModelSubmissionPayload {
  formA: ModelSubmissionFormA;
  formB: ModelSubmissionFormB;
  formC: ModelSubmissionFormC;
  formD: ModelSubmissionFormD;
  formE: ModelSubmissionFormE;
  formF: ModelSubmissionFormF;
  status: SubmissionStatus;
}

// Misc auxiliary types
export interface AuditLogEntry {
  timestamp: string; // ISO string
  actor: string; // user or system
  action: string;
  details?: Record<string, any>;
}
export interface DeveloperNotification {
  id: string;
  message: string;
  createdAt: string;
  read: boolean;
}
export interface EarningsRecord {
  productId: string;
  amountUsd: number;
  earnedAt: string;
}
export interface TransactionLog {
  id: string;
  productId: string;
  type: "request" | "inference" | "payout";
  amountUsd: number;
  createdAt: string;
}
