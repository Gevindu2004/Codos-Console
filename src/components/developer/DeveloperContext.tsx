// src/components/developer/DeveloperContext.tsx
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { developerApi } from "../../lib/developerApi";
import type {
  DeveloperProfile,
  ApiSubmissionPayload,
  ModelSubmissionPayload,
  DeveloperNotification,
  EarningsRecord,
  SubmissionStatus,
} from "./types";

interface DeveloperContextState {
  profile: DeveloperProfile | null;
  apiSubmissions: ApiSubmissionPayload[];
  modelSubmissions: ModelSubmissionPayload[];
  notifications: DeveloperNotification[];
  earnings: EarningsRecord[];
  // Draft persistence helpers
  getApiDraft: (id: string) => ApiSubmissionPayload | null;
  saveApiDraft: (payload: ApiSubmissionPayload) => void;
  getModelDraft: (id: string) => ModelSubmissionPayload | null;
  saveModelDraft: (payload: ModelSubmissionPayload) => void;
}

const DeveloperContext = createContext<DeveloperContextState | undefined>(undefined);

export const DeveloperProvider: React.FC<{ devId: string; children: React.ReactNode }> = ({ devId, children }) => {
  const [profile, setProfile] = useState<DeveloperProfile | null>(null);
  const [apiSubmissions, setApiSubmissions] = useState<ApiSubmissionPayload[]>([]);
  const [modelSubmissions, setModelSubmissions] = useState<ModelSubmissionPayload[]>([]);
  const [notifications, setNotifications] = useState<DeveloperNotification[]>([]);
  const [earnings, setEarnings] = useState<EarningsRecord[]>([]);

  // Load profile & submissions on mount
  useEffect(() => {
    developerApi.getProfile(devId).then(setProfile).catch(console.error);
    developerApi.listApis(devId).then(setApiSubmissions).catch(console.error);
    developerApi.listModels(devId).then(setModelSubmissions).catch(console.error);
    // Mock notifications & earnings – in real app they'd be fetched from API
    setNotifications([
      { id: "n1", message: "Your API 'Acme Weather' passed validation.", createdAt: now(), read: false },
    ]);
    setEarnings([
      { productId: "api-1", amountUsd: 125.0, earnedAt: now() },
    ]);
  }, [devId]);

  const now = () => new Date().toISOString();

  // Draft persistence – stored under localStorage key `${devId}-api-drafts` / `${devId}-model-drafts`
  const getApiDraft = (id: string): ApiSubmissionPayload | null => {
    const stored = localStorage.getItem(`${devId}-api-drafts`);
    if (!stored) return null;
    const drafts: Record<string, ApiSubmissionPayload> = JSON.parse(stored);
    return drafts[id] ?? null;
  };
  const saveApiDraft = (payload: ApiSubmissionPayload) => {
    const stored = localStorage.getItem(`${devId}-api-drafts`);
    const drafts: Record<string, ApiSubmissionPayload> = stored ? JSON.parse(stored) : {};
    drafts[payload.formA.developerId] = payload; // using developerId as key (could be draftId in real impl)
    localStorage.setItem(`${devId}-api-drafts`, JSON.stringify(drafts));
    // Update in‑memory list for UI refresh
    setApiSubmissions((prev) => {
      const idx = prev.findIndex((p) => p.formA.developerId === payload.formA.developerId);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = payload;
        return copy;
      }
      return [...prev, payload];
    });
  };

  const getModelDraft = (id: string): ModelSubmissionPayload | null => {
    const stored = localStorage.getItem(`${devId}-model-drafts`);
    if (!stored) return null;
    const drafts: Record<string, ModelSubmissionPayload> = JSON.parse(stored);
    return drafts[id] ?? null;
  };
  const saveModelDraft = (payload: ModelSubmissionPayload) => {
    const stored = localStorage.getItem(`${devId}-model-drafts`);
    const drafts: Record<string, ModelSubmissionPayload> = stored ? JSON.parse(stored) : {};
    drafts[payload.formA.developerId] = payload;
    localStorage.setItem(`${devId}-model-drafts`, JSON.stringify(drafts));
    setModelSubmissions((prev) => {
      const idx = prev.findIndex((p) => p.formA.developerId === payload.formA.developerId);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = payload;
        return copy;
      }
      return [...prev, payload];
    });
  };

  const value: DeveloperContextState = {
    profile,
    apiSubmissions,
    modelSubmissions,
    notifications,
    earnings,
    getApiDraft,
    saveApiDraft,
    getModelDraft,
    saveModelDraft,
  };

  return <DeveloperContext.Provider value={value}>{children}</DeveloperContext.Provider>;
};

export const useDeveloper = () => {
  const ctx = useContext(DeveloperContext);
  if (!ctx) throw new Error("useDeveloper must be used within DeveloperProvider");
  return ctx;
};
