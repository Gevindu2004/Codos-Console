// src/components/developer/mockDeveloperData.ts
// Simple in‑memory mock data used when the real backend is unavailable.
// The data mirrors the shape of the real API payloads defined in types.ts.

import type {
  DeveloperProfile,
  ApiSubmissionPayload,
  ModelSubmissionPayload,
  SubmissionStatus,
} from "./types";

// ------------------- Helper -------------------
const now = () => new Date().toISOString();

// ------------------- Mock Profile -------------------
export const getMockProfile = (devId: string): DeveloperProfile => ({
  id: devId,
  developerName: "",
  companyName: "",
  email: "",
  emailVerified: false,
  country: "",
  website: "",
  supportContact: "",
  payoutMethod: "none",
  status: "unregistered",
});

// ------------------- Mock APIs -------------------
const sampleApi: ApiSubmissionPayload = {
  formA: {
    productName: "Acme Weather API",
    shortDescription: "Global weather data streams",
    detailedDescription: "Provides real‑time weather, forecasts, and historical data for any location.",
    category: "weather",
    logoUrl: "https://acme.com/logo.png",
    developerId: "dev-123",
  },
  formB: {
    hostingProvider: "AWS",
    baseUrl: "https://api.acme.com/weather",
    apiVersion: "v1",
    healthCheckPath: "/health",
    region: "us-east-1",
    availabilityPct: 99.9,
    rateLimit: 5000,
    timeoutMs: 2000,
  },
  formC: {
    openApiSpec: "{ \"openapi\": \"3.0.0\", \"info\": { \"title\": \"Acme Weather\", \"version\": \"v1\" } }",
  },
  formD: {
    authMethod: "api_key",
    upstreamAuthHeader: "X-API-Key",
  },
  formE: {
    pricingModel: ["pay_per_request"],
    pricePerRequest: 0.001,
    monthlyLimit: 100000,
    rpm: 100,
    maxConcurrency: 5,
  },
  formF: {
    ownershipConfirmed: true,
    privacyPolicyUrl: "https://acme.com/privacy",
    termsOfServiceUrl: "https://acme.com/terms",
    dataHandlingNotes: "Data is not stored beyond 30 days.",
    commissionAccepted: true,
  },
  status: "Published",
};

export const getMockApis = (devId: string): ApiSubmissionPayload[] => [
  { ...sampleApi, formA: { ...sampleApi.formA, developerId: devId } },
];

export const getMockApiById = (apiId: string): ApiSubmissionPayload => {
  // For demo purposes we ignore apiId and return the sample.
  return { ...sampleApi };
};

// ------------------- Mock Models -------------------
const sampleModel: ModelSubmissionPayload = {
  formA: {
    modelName: "Acme Llama 3‑FineTune",
    shortDescription: "Fine‑tuned Llama 3 for e‑commerce",
    detailedDescription: "Optimized for product recommendation and sentiment analysis.",
    category: "text",
    version: "1.0.0",
    logoUrl: "https://acme.com/llama.png",
    developerId: "dev-123",
    useCases: ["recommendation", "sentiment"],
    supportedLanguages: ["en"],
    architecture: "decoder‑only",
    framework: "pytorch",
    baseModel: "llama3",
    fineTuned: true,
  },
  formB: {
    authMethod: "api_key",
    upstreamAuthHeader: "X-API-Key",
    inferenceEndpoint: "https://model.acme.com/v1/predict",
    hostingProvider: "GCP",
    healthCheckPath: "/health",
    expectedLatencyMs: 120,
    availabilityPct: 99.5,
    maxRequestSizeMb: 10,
  },
  formC: {
    inputType: "text",
    inputFormats: ["plain", "json"],
    maxInputSizeMb: 2,
    outputType: "text",
    outputFormats: ["plain"],
    processingMode: "synchronous",
    deliveryMethod: "direct",
    schemaJson: JSON.stringify({
      input: { type: "string", description: "User prompt" },
      output: { type: "string", description: "Model response" },
    }),
  },
  formD: {
    sampleInputs: ["What is the price of product X?"],
    sampleOutputs: ["$19.99"],
    benchmarkScore: 92,
    maxProcessingTimeMs: 500,
    knownLimitations: "May hallucinate on obscure products",
  },
  formE: {
    billingUnit: "per_token",
    rate: 0.00002,
    limits: "max 1M tokens/month",
  },
  formF: {
    ownershipConfirmed: true,
    baseModelLicense: "Apache-2.0",
    trainingDataRights: "Owned by Acme",
    privacyPolicyUrl: "https://acme.com/model-privacy",
    termsOfServiceUrl: "https://acme.com/model-terms",
    prohibitedUseAgreement: true,
  },
  status: "Under Review",
};

export const getMockModels = (devId: string): ModelSubmissionPayload[] => [
  { ...sampleModel, formA: { ...sampleModel.formA, developerId: devId } },
];

export const getMockModelById = (modelId: string): ModelSubmissionPayload => {
  return { ...sampleModel };
};
