"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type {
  ApiSubmissionPayload,
  DeveloperNotification,
  DeveloperProfile,
  EarningsRecord,
  ModelSubmissionPayload,
} from "./types";
import {
  getCurrentDeveloperId,
  getDeveloperProfile,
  getDeveloperProducts,
  subscribeMarketplaceStore,
  subscribeToCurrentDeveloper,
  type SharedProduct,
} from "@/lib/marketplaceStore";

interface DeveloperContextState {
  profile: DeveloperProfile | null;
  apiSubmissions: ApiSubmissionPayload[];
  modelSubmissions: ModelSubmissionPayload[];
  apiProducts: Array<SharedProduct & { productType: "api"; payload: ApiSubmissionPayload }>;
  modelProducts: Array<SharedProduct & { productType: "model"; payload: ModelSubmissionPayload }>;
  notifications: DeveloperNotification[];
  earnings: EarningsRecord[];
  getApiDraft: (id: string) => ApiSubmissionPayload | null;
  saveApiDraft: (payload: ApiSubmissionPayload) => void;
  getModelDraft: (id: string) => ModelSubmissionPayload | null;
  saveModelDraft: (payload: ModelSubmissionPayload) => void;
}

const DeveloperContext = createContext<DeveloperContextState | undefined>(undefined);

function isApiProduct(
  product: SharedProduct,
): product is SharedProduct & { productType: "api"; payload: ApiSubmissionPayload } {
  return product.productType === "api";
}

function isModelProduct(
  product: SharedProduct,
): product is SharedProduct & { productType: "model"; payload: ModelSubmissionPayload } {
  return product.productType === "model";
}
function readDraft<T>(key: string, id: string): T | null {
  const stored = window.localStorage.getItem(key);
  if (!stored) return null;
  const drafts = JSON.parse(stored) as Record<string, T>;
  return drafts[id] ?? null;
}

function saveDraft<T>(key: string, id: string, payload: T): void {
  const stored = window.localStorage.getItem(key);
  const drafts = stored ? JSON.parse(stored) as Record<string, T> : {};
  drafts[id] = payload;
  window.localStorage.setItem(key, JSON.stringify(drafts));
}

export const DeveloperProvider: React.FC<{ devId: string; children: React.ReactNode }> = ({ devId, children }) => {
  const [profile, setProfile] = useState<DeveloperProfile | null>(null);
  const [apiProducts, setApiProducts] = useState<DeveloperContextState["apiProducts"]>([]);
  const [modelProducts, setModelProducts] = useState<DeveloperContextState["modelProducts"]>([]);

  useEffect(() => {
    const refresh = () => {
      const activeId = getCurrentDeveloperId(devId);
      setProfile(getDeveloperProfile(activeId));
      const products = getDeveloperProducts(activeId);
      setApiProducts(products.filter(isApiProduct));
      setModelProducts(products.filter(isModelProduct));
    };
    refresh();
    const unsubscribeStore = subscribeMarketplaceStore(refresh);
    const unsubscribeDeveloper = subscribeToCurrentDeveloper(refresh);
    return () => {
      unsubscribeStore();
      unsubscribeDeveloper();
    };
  }, [devId]);

  const getApiDraft = (id: string) => readDraft<ApiSubmissionPayload>(`${devId}-api-drafts`, id);
  const saveApiDraft = (payload: ApiSubmissionPayload) =>
    saveDraft(`${devId}-api-drafts`, payload.formA.developerId, payload);
  const getModelDraft = (id: string) => readDraft<ModelSubmissionPayload>(`${devId}-model-drafts`, id);
  const saveModelDraft = (payload: ModelSubmissionPayload) =>
    saveDraft(`${devId}-model-drafts`, payload.formA.developerId, payload);

  const value: DeveloperContextState = {
    profile,
    apiProducts,
    modelProducts,
    apiSubmissions: apiProducts.map((product) => product.payload),
    modelSubmissions: modelProducts.map((product) => product.payload),
    notifications: [],
    earnings: [],
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
