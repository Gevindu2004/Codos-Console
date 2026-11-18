// src/lib/developerApi.ts
// Typed API client for the Developer Portal.
// Uses native fetch; falls back to mock data when the backend is not live.

import type {
  ApiSubmissionPayload,
  ModelSubmissionPayload,
  DeveloperProfile,
  SubmissionStatus,
} from "../components/developer/types";

const baseURL = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1/developer";

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
};
