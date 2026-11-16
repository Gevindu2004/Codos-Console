const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";

const DEFAULT_USER_ID = "demo-enterprise-user";

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    "X-User-Id": DEFAULT_USER_ID,
    ...extra,
  };
}

export interface CatalogModel {
  id: string;
  name: string;
  category: "general" | "industry";
  industry: string | null;
  base_hf_repo: string;
  adapter_name: string | null;
  description: string;
  default_system_prompt: string;
}

export interface ConfiguredModelItem {
  id: string;
  user_id: string;
  name: string;
  base_model_id: string;
  industry: string | null;
  system_prompt: string;
  temperature: number;
  chunk_size: number;
  status: "DRAFT" | "PROCESSING" | "READY" | "FAILED";
  created_at: string;
}

export interface KnowledgeSourceItem {
  id: string;
  source_type: "document" | "database";
  file_name?: string | null;
  file_format?: string | null;
  file_size_bytes?: number | null;
  db_type?: string | null;
  db_label?: string | null;
  selected_tables?: string[] | null;
  token_count: number;
  status: "PENDING" | "INDEXED" | "ERROR";
  error_message?: string | null;
}

export interface ApiKeyItem {
  id: string;
  name: string;
  key_prefix: string;
  is_active: boolean;
  created_at: string;
  last_used_at?: string | null;
}

export interface ProcessingJobItem {
  id: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  current_step: number;
  step_label: string;
  progress_percent: number;
  error_message?: string | null;
}

export const skybeakApi = {
  baseUrl: API_BASE,

  async getCatalog(): Promise<{
    general_models: CatalogModel[];
    industry_models: CatalogModel[];
  }> {
    const res = await fetch(`${API_BASE}/skybeak/catalog`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to load SkyBeak model catalog");
    return res.json();
  },

  async listModels(): Promise<ConfiguredModelItem[]> {
    const res = await fetch(`${API_BASE}/skybeak/models`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to load configured models");
    return res.json();
  },

  async createModel(payload: {
    name: string;
    base_model_id: string;
    system_prompt?: string;
    temperature?: number;
    chunk_size?: number;
  }): Promise<ConfiguredModelItem> {
    const res = await fetch(`${API_BASE}/skybeak/models`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getModelDetails(modelId: string): Promise<{
    model: ConfiguredModelItem;
    knowledge_sources: KnowledgeSourceItem[];
    api_keys: ApiKeyItem[];
    latest_job: ProcessingJobItem | null;
  }> {
    const res = await fetch(`${API_BASE}/skybeak/models/${modelId}`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch model details");
    return res.json();
  },

  async uploadDocuments(modelId: string, files: File[]) {
    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));
    const res = await fetch(`${API_BASE}/skybeak/models/${modelId}/sources/documents`, {
      method: "POST",
      headers: authHeaders(),
      body: formData,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async testDatabase(connectionUri: string): Promise<{ connected: boolean; tables: string[] }> {
    const res = await fetch(`${API_BASE}/skybeak/databases/test`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ connection_uri: connectionUri }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Connection failed" }));
      throw new Error(err.detail || "Database connection failed");
    }
    return res.json();
  },

  async connectDatabase(
    modelId: string,
    payload: {
      db_type: "postgresql" | "mysql" | "mssql";
      db_label: string;
      connection_uri: string;
      selected_tables?: string[];
    }
  ) {
    const res = await fetch(`${API_BASE}/skybeak/models/${modelId}/sources/database`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Failed to attach database" }));
      throw new Error(err.detail || "Failed to attach database");
    }
    return res.json();
  },

  async removeSource(modelId: string, sourceId: string) {
    const res = await fetch(`${API_BASE}/skybeak/models/${modelId}/sources/${sourceId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to remove knowledge source");
  },

  async generateModel(modelId: string): Promise<{
    job_id: string;
    model_id: string;
    status: string;
    initial_api_key: string | null;
  }> {
    const res = await fetch(`${API_BASE}/skybeak/models/${modelId}/generate`, {
      method: "POST",
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to start model generation");
    return res.json();
  },

  async getJobStatus(jobId: string): Promise<ProcessingJobItem> {
    const res = await fetch(`${API_BASE}/skybeak/jobs/${jobId}`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to poll job status");
    return res.json();
  },

  async chat(
    modelId: string,
    payload: { message: string; use_rag: boolean; temperature?: number }
  ): Promise<{
    reply: string;
    sources_used: string[];
    rag_chunks_retrieved: number;
    latency_ms: number;
    tokens: number;
  }> {
    const res = await fetch(`${API_BASE}/skybeak/models/${modelId}/chat`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Chat request failed");
    return res.json();
  },

  async getChatHistory(modelId: string) {
    const res = await fetch(`${API_BASE}/skybeak/models/${modelId}/chat/history`, {
      headers: authHeaders(),
    });
    if (!res.ok) return [];
    return res.json();
  },

  async createApiKey(modelId: string, name: string) {
    const res = await fetch(`${API_BASE}/skybeak/models/${modelId}/keys`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error("Failed to create API key");
    return res.json();
  },

  async revokeApiKey(modelId: string, keyId: string) {
    const res = await fetch(`${API_BASE}/skybeak/models/${modelId}/keys/${keyId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to revoke API key");
  },

  async getAnalytics(): Promise<{
    total_requests: number;
    total_tokens: number;
    avg_latency_ms: number;
    web_chat_requests: number;
    external_api_requests: number;
  }> {
    const res = await fetch(`${API_BASE}/skybeak/analytics`, {
      headers: authHeaders(),
    });
    if (!res.ok) {
      return {
        total_requests: 0,
        total_tokens: 0,
        avg_latency_ms: 0,
        web_chat_requests: 0,
        external_api_requests: 0,
      };
    }
    return res.json();
  },

  async submitCustomRequest(payload: {
    configured_model_id?: string;
    title: string;
    details: string;
  }) {
    const res = await fetch(`${API_BASE}/skybeak/custom-requests`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to submit custom request");
    return res.json();
  },
};