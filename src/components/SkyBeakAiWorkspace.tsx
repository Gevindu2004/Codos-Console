"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import {
  BrainCircuit,
  MessageSquare,
  UploadCloud,
  Building2,
  Sparkles,
  Check,
  Copy,
  Send,
  FileText,
  Trash2,
  Zap,
  Cpu,
  Database,
  Code2,
  Stethoscope,
  ShoppingBag,
  Briefcase,
  Bot,
  User,
  KeyRound,
  BarChart3,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Layers,
  PlusCircle,
} from "lucide-react";
import {
  skybeakApi,
  CatalogModel,
  ConfiguredModelItem,
  KnowledgeSourceItem,
  ApiKeyItem,
  ProcessingJobItem,
} from "@/lib/skybeakApi";

export type SkyBeakSubView =
  | "models"
  | "industry"
  | "training"
  | "chatbot"
  | "dashboard";

interface SkyBeakAiWorkspaceProps {
  initialSubView?: SkyBeakSubView;
  isLightTheme?: boolean;
  onOpenApiCatalog?: () => void;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  latencyMs?: number;
  tokens?: number;
}

const INDUSTRY_ICONS: Record<string, React.ElementType> = {
  "SME & Daily Business": Briefcase,
  "Retail, E-commerce & Manufacturing": ShoppingBag,
  Healthcare: Stethoscope,
};

export const SkyBeakAiWorkspace: React.FC<SkyBeakAiWorkspaceProps> = ({
  initialSubView = "models",
  isLightTheme = false,
}) => {
  const [subView, setSubView] = useState<SkyBeakSubView>(initialSubView);
  const [backendOnline, setBackendOnline] = useState<boolean>(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Catalog & User Models
  const [generalModels, setGeneralModels] = useState<CatalogModel[]>([]);
  const [industryModels, setIndustryModels] = useState<CatalogModel[]>([]);
  const [selectedIndustry, setSelectedIndustry] = useState<CatalogModel | null>(null);
  const [userModels, setUserModels] = useState<ConfiguredModelItem[]>([]);
  const [activeModel, setActiveModel] = useState<ConfiguredModelItem | null>(null);

  // Knowledge Sources (Non-mutually exclusive: Documents + Database)
  const [knowledgeMode, setKnowledgeMode] = useState<"documents" | "database" | "both">("both");
  const [sources, setSources] = useState<KnowledgeSourceItem[]>([]);
  const [newModelName, setNewModelName] = useState<string>("skybeak-workspace-assistant");
  const [customSystemPrompt, setCustomSystemPrompt] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // Database Connection Form
  const [dbType, setDbType] = useState<"postgresql" | "mysql" | "mssql">("postgresql");
  const [dbLabel, setDbLabel] = useState<string>("Production ERP Database");
  const [dbUri, setDbUri] = useState<string>("");
  const [availableTables, setAvailableTables] = useState<string[]>([]);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [isTestingDb, setIsTestingDb] = useState<boolean>(false);
  const [dbTestSuccess, setDbTestSuccess] = useState<boolean>(false);

  // 9-Stage Model Generation State
  const [activeJob, setActiveJob] = useState<ProcessingJobItem | null>(null);
  const [revealedApiKey, setRevealedApiKey] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [newKeyName, setNewKeyName] = useState<string>("External App Integration");
  const [copiedKey, setCopiedKey] = useState<boolean>(false);

  // Chatbot State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState<string>("");
  const [useRagContext, setUseRagContext] = useState<boolean>(true);
  const [isBotTyping, setIsBotTyping] = useState<boolean>(false);

  // Analytics & Custom Request State
  const [analytics, setAnalytics] = useState({
    total_requests: 0,
    total_tokens: 0,
    avg_latency_ms: 0,
    web_chat_requests: 0,
    external_api_requests: 0,
  });
  const [reqTitle, setReqTitle] = useState<string>("");
  const [reqDetails, setReqDetails] = useState<string>("");
  const [reqSubmitted, setReqSubmitted] = useState<boolean>(false);

  const loadWorkspaceData = useCallback(async () => {
    try {
      const [catalog, models, stats] = await Promise.all([
        skybeakApi.getCatalog(),
        skybeakApi.listModels(),
        skybeakApi.getAnalytics(),
      ]);
      setGeneralModels(catalog.general_models);
      setIndustryModels(catalog.industry_models);
      if (catalog.industry_models.length > 0 && !selectedIndustry) {
        setSelectedIndustry(catalog.industry_models[0]);
      }
      setUserModels(models);
      setAnalytics(stats);
      setBackendOnline(true);
      setErrorBanner(null);

      if (models.length > 0 && !activeModel) {
        setActiveModel(models[0]);
      }
    } catch {
      setBackendOnline(false);
    }
  }, [activeModel, selectedIndustry]);

  const loadModelDetails = useCallback(async (modelId: string) => {
    try {
      const details = await skybeakApi.getModelDetails(modelId);
      setActiveModel(details.model);
      setSources(details.knowledge_sources);
      setApiKeys(details.api_keys);
      setActiveJob(details.latest_job);

      const hist = await skybeakApi.getChatHistory(modelId);
      setMessages(
        hist.map((h: { id: string; role: "user" | "assistant"; content: string; sources_used?: string[]; latency_ms?: number; tokens_used?: number }) => ({
          id: h.id,
          role: h.role,
          content: h.content,
          sources: h.sources_used || [],
          latencyMs: h.latency_ms,
          tokens: h.tokens_used,
        }))
      );
    } catch (e: unknown) {
      setErrorBanner(e instanceof Error ? e.message : "Failed to load model details");
    }
  }, []);

  useEffect(() => {
    loadWorkspaceData();
  }, [loadWorkspaceData]);

  useEffect(() => {
    if (activeModel?.id) {
      loadModelDetails(activeModel.id);
    }
  }, [activeModel?.id, loadModelDetails]);

  // Poll 9-stage processing job while RUNNING or QUEUED
  useEffect(() => {
    if (!activeJob || (activeJob.status !== "QUEUED" && activeJob.status !== "RUNNING")) {
      return;
    }
    const timer = setInterval(async () => {
      try {
        const updated = await skybeakApi.getJobStatus(activeJob.id);
        setActiveJob(updated);
        if (updated.status === "COMPLETED" || updated.status === "FAILED") {
          clearInterval(timer);
          if (activeModel?.id) {
            await loadModelDetails(activeModel.id);
            await loadWorkspaceData();
          }
        }
      } catch {
        clearInterval(timer);
      }
    }, 1200);
    return () => clearInterval(timer);
  }, [activeJob, activeModel?.id, loadModelDetails, loadWorkspaceData]);

  // Select General or Industry Base Model -> Provision ConfiguredModel -> Go to Knowledge Setup
  const handleSelectBaseModel = async (base: CatalogModel, goDirectToChat = false) => {
    try {
      setErrorBanner(null);
      const instanceName =
        newModelName.trim() || `${base.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      const created = await skybeakApi.createModel({
        name: instanceName,
        base_model_id: base.id,
        system_prompt: customSystemPrompt.trim() || base.default_system_prompt,
      });
      setActiveModel(created);
      setRevealedApiKey(null);
      setActiveJob(null);
      await loadWorkspaceData();
      setSubView(goDirectToChat ? "chatbot" : "training");
    } catch (e: unknown) {
      setErrorBanner(e instanceof Error ? e.message : "Could not initialize model");
    }
  };

  // Document Upload Handler
  const handleFilesUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || !activeModel) return;
    setIsUploading(true);
    setErrorBanner(null);
    try {
      await skybeakApi.uploadDocuments(activeModel.id, Array.from(fileList));
      await loadModelDetails(activeModel.id);
    } catch (e: unknown) {
      setErrorBanner(e instanceof Error ? e.message : "Document upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  // Database Connection Handlers
  const handleTestDb = async () => {
    if (!dbUri.trim()) return;
    setIsTestingDb(true);
    setDbTestSuccess(false);
    setErrorBanner(null);
    try {
      const res = await skybeakApi.testDatabase(dbUri);
      setAvailableTables(res.tables);
      setSelectedTables(res.tables.slice(0, 5));
      setDbTestSuccess(true);
    } catch (e: unknown) {
      setErrorBanner(e instanceof Error ? e.message : "Database test failed");
    } finally {
      setIsTestingDb(false);
    }
  };

  const handleAttachDb = async () => {
    if (!activeModel || !dbUri.trim()) return;
    setErrorBanner(null);
    try {
      await skybeakApi.connectDatabase(activeModel.id, {
        db_type: dbType,
        db_label: dbLabel.trim() || "Connected SQL Database",
        connection_uri: dbUri,
        selected_tables: selectedTables.length > 0 ? selectedTables : undefined,
      });
      setDbUri("");
      setDbTestSuccess(false);
      await loadModelDetails(activeModel.id);
    } catch (e: unknown) {
      setErrorBanner(e instanceof Error ? e.message : "Failed to attach database");
    }
  };

  const handleRemoveSource = async (sourceId: string) => {
    if (!activeModel) return;
    await skybeakApi.removeSource(activeModel.id, sourceId);
    await loadModelDetails(activeModel.id);
  };

  // Trigger 9-Stage Generate Model Pipeline
  const handleGenerateModel = async () => {
    if (!activeModel) return;
    setErrorBanner(null);
    try {
      const res = await skybeakApi.generateModel(activeModel.id);
      if (res.initial_api_key) {
        setRevealedApiKey(res.initial_api_key);
      }
      const job = await skybeakApi.getJobStatus(res.job_id);
      setActiveJob(job);
    } catch (e: unknown) {
      setErrorBanner(e instanceof Error ? e.message : "Failed to start model generation");
    }
  };

  // Chatbot Send Handler
  const handleSendChat = async () => {
    if (!chatInput.trim() || !activeModel || isBotTyping) return;
    const prompt = chatInput.trim();
    setChatInput("");
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: "user", content: prompt },
    ]);
    setIsBotTyping(true);
    try {
      const res = await skybeakApi.chat(activeModel.id, {
        message: prompt,
        use_rag: useRagContext,
      });
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: res.reply,
          sources: res.sources_used,
          latencyMs: res.latency_ms,
          tokens: res.tokens,
        },
      ]);
      const stats = await skybeakApi.getAnalytics();
      setAnalytics(stats);
    } catch (e: unknown) {
      setErrorBanner(e instanceof Error ? e.message : "Chat inference failed");
    } finally {
      setIsBotTyping(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header & Guided Workflow Navigation */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#F1F5F9]/12 pb-5">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-white p-1.5 shadow border border-black/10 flex items-center justify-center flex-shrink-0">
            <Image
              src="/assets/sky-beak-llm-logo.jpg"
              alt="Sky Beak LLM Logo"
              width={48}
              height={48}
              className="object-contain w-full h-full"
            />
          </div>
          <div>
            <div className="inline-flex items-center gap-2 text-[#14B8A6] text-xs font-semibold mb-1">
              <BrainCircuit className="w-3.5 h-3.5" />
              <span>
                SkyBeak RAG Trainer &amp; Deployment Platform •{" "}
                {backendOnline ? "Backend Connected" : "Backend Offline (Start port 8000)"}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#F1F5F9]">
              SkyBeak AI Platform
            </h1>
            <p className="text-xs sm:text-sm text-[#F1F5F9]/75 mt-0.5">
              Workflow: 1. Select Model → 2. Configure Knowledge (DB + Docs) → 3. Generate Model → 4. Chat or Deploy via API
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: "models" as const, label: "1. General & Models", icon: Cpu },
            { id: "industry" as const, label: "2. Industry Models", icon: Building2 },
            { id: "training" as const, label: "3. Knowledge & Generate", icon: Database },
            { id: "chatbot" as const, label: "4. Online Chatbot", icon: MessageSquare },
            { id: "dashboard" as const, label: "5. My Models & API", icon: Layers },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = subView === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSubView(tab.id)}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  isActive
                    ? "codos-cta-btn bg-[#14B8A6] text-[#0F172A] shadow-md"
                    : "glass-panel text-[#F1F5F9]/80 hover:border-[#14B8A6]/45"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {errorBanner && (
        <div className="p-3.5 rounded-xl bg-red-500/15 border border-red-500/40 text-xs text-red-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorBanner}</span>
          </div>
          <button onClick={() => setErrorBanner(null)} className="underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* =====================================================================
          SCREEN 1: INITIAL DASHBOARD (GENERAL AI + INDUSTRY OVERVIEW)
         ===================================================================== */}
      {subView === "models" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category A: General AI Models */}
            <div className="p-6 rounded-3xl glass-panel border border-[#F1F5F9]/15 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold uppercase text-[#14B8A6]">
                  Category 1 • Ready Out-of-the-Box
                </span>
                <Sparkles className="w-4 h-4 text-[#14B8A6]" />
              </div>
              <h2 className="text-xl font-bold text-[#F1F5F9]">General AI Models</h2>
              <p className="text-xs text-[#F1F5F9]/75">
                Access general-purpose AI immediately without industry training—or optionally attach documents/databases for a personalized RAG chatbot &amp; API.
              </p>

              <div className="space-y-3 pt-2">
                {generalModels.map((gm) => (
                  <div
                    key={gm.id}
                    className="p-4 rounded-2xl bg-black/40 border border-[#F1F5F9]/12 space-y-3"
                  >
                    <div>
                      <h3 className="text-sm font-bold text-[#F1F5F9]">{gm.name}</h3>
                      <p className="text-xs text-[#F1F5F9]/70 mt-1">{gm.description}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleSelectBaseModel(gm, true)}
                        className="codos-cta-btn px-3.5 py-2 rounded-xl bg-[#14B8A6] text-[#0F172A] text-xs font-bold cursor-pointer"
                      >
                        Use Online Chatbot →
                      </button>
                      <button
                        onClick={() => handleSelectBaseModel(gm, false)}
                        className="px-3.5 py-2 rounded-xl glass-panel border border-[#F1F5F9]/15 text-xs font-bold text-[#F1F5F9] hover:border-[#14B8A6] cursor-pointer"
                      >
                        + Add RAG Docs / DB
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Category B: Industry-Specific AI Models */}
            <div className="p-6 rounded-3xl glass-panel border-2 border-[#14B8A6]/60 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold uppercase text-[#14B8A6]">
                  Category 2 • Domain Fine-Tuned v4 Models
                </span>
                <Building2 className="w-4 h-4 text-[#14B8A6]" />
              </div>
              <h2 className="text-xl font-bold text-[#F1F5F9]">
                Industry-Specific AI Models
              </h2>
              <p className="text-xs text-[#F1F5F9]/75">
                Choose from SkyBeak’s specialized vertical models (SME Business, Retail/E-Commerce/Manufacturing, Healthcare) and ground them on your database and documents.
              </p>

              <div className="space-y-2.5 pt-2">
                {industryModels.map((im) => (
                  <div
                    key={im.id}
                    className="p-3.5 rounded-2xl bg-black/40 border border-[#F1F5F9]/12 flex items-center justify-between gap-3"
                  >
                    <div>
                      <span className="text-[10px] font-mono font-bold text-[#14B8A6] block">
                        {im.industry}
                      </span>
                      <span className="text-sm font-bold text-[#F1F5F9]">{im.name}</span>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedIndustry(im);
                        setSubView("industry");
                      }}
                      className="codos-cta-btn px-3.5 py-2 rounded-xl bg-[#14B8A6] text-[#0F172A] text-xs font-bold cursor-pointer flex-shrink-0"
                    >
                      Configure →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SCREEN 2: INDUSTRY SELECTION INTERFACE (TASK #8)
         ===================================================================== */}
      {subView === "industry" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {industryModels.map((ind) => {
              const Icon = (ind.industry && INDUSTRY_ICONS[ind.industry]) || Building2;
              const isSelected = selectedIndustry?.id === ind.id;
              return (
                <div
                  key={ind.id}
                  onClick={() => setSelectedIndustry(ind)}
                  className={`p-5 rounded-2xl glass-panel border transition-all cursor-pointer space-y-3 ${
                    isSelected
                      ? "border-2 border-[#14B8A6] shadow-xl"
                      : "border-[#F1F5F9]/12 hover:border-[#14B8A6]/45"
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-[#14B8A6]/15 text-[#14B8A6] flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono font-bold text-[#14B8A6] uppercase">
                      {ind.industry}
                    </span>
                    <h3 className="text-base font-bold text-[#F1F5F9] mt-0.5">
                      {ind.name}
                    </h3>
                  </div>
                  <p className="text-xs text-[#F1F5F9]/75 leading-relaxed">
                    {ind.description}
                  </p>
                </div>
              );
            })}
          </div>

          {selectedIndustry && (
            <div className="lg:col-span-5 p-6 rounded-3xl glass-panel border-2 border-[#14B8A6] space-y-4">
              <span className="text-[11px] font-mono font-bold text-[#14B8A6] uppercase">
                Step 1 • Configure Selected Industry Model
              </span>
              <h3 className="text-xl font-bold text-[#F1F5F9]">
                {selectedIndustry.name}
              </h3>
              <p className="text-xs text-[#F1F5F9]/80">{selectedIndustry.description}</p>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#F1F5F9]/80 block">
                  Your Custom Model Name
                </label>
                <input
                  type="text"
                  value={newModelName}
                  onChange={(e) => setNewModelName(e.target.value)}
                  placeholder="e.g., acme-retail-support-ai"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-[#F1F5F9]/15 text-xs font-mono text-[#F1F5F9] outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#F1F5F9]/80 block">
                  System Instructions (Optional Override)
                </label>
                <textarea
                  rows={3}
                  value={customSystemPrompt || selectedIndustry.default_system_prompt}
                  onChange={(e) => setCustomSystemPrompt(e.target.value)}
                  className="w-full p-3 rounded-xl bg-black/40 border border-[#F1F5F9]/15 text-xs text-[#F1F5F9] outline-none"
                />
              </div>

              <button
                onClick={() => handleSelectBaseModel(selectedIndustry, false)}
                className="codos-cta-btn w-full py-3 rounded-xl bg-[#14B8A6] text-[#0F172A] text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Proceed to Knowledge Sources (DB &amp; Docs) →</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          SCREEN 3: CONFIGURE KNOWLEDGE SOURCES (OPTION A, B, C) & 9-STAGE GENERATE
         ===================================================================== */}
      {subView === "training" && (
        <div className="space-y-6">
          {/* Active Model Selector Bar */}
          <div className="p-4 rounded-2xl glass-panel border border-[#F1F5F9]/15 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-[#F1F5F9]">Configuring Model:</span>
              <select
                value={activeModel?.id || ""}
                onChange={(e) => {
                  const found = userModels.find((m) => m.id === e.target.value);
                  if (found) setActiveModel(found);
                }}
                className="px-3.5 py-2 rounded-xl bg-[#0F172A] border border-[#F1F5F9]/20 text-xs font-bold text-[#14B8A6]"
              >
                {userModels.map((m) => (
                  <option className="bg-[#0B1120] text-slate-100" key={m.id} value={m.id}>
                    {m.name} ({m.status})
                  </option>
                ))}
              </select>
            </div>

            {/* Option A / B / C Mode Switcher (Non-mutually exclusive) */}
            <div className="flex flex-wrap gap-2">
              {[
                { id: "database" as const, label: "Option A: Connect Database" },
                { id: "documents" as const, label: "Option B: Upload Documents" },
                { id: "both" as const, label: "Option C: Use Both (DB + Docs)" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setKnowledgeMode(opt.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                    knowledgeMode === opt.id
                      ? "bg-[#14B8A6] text-[#0F172A]"
                      : "glass-panel text-[#F1F5F9]/75"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 7 Columns: Database Connector & Document Dropzone */}
            <div className="lg:col-span-7 space-y-5">
              {/* Option A / C: Database Connection Card */}
              {(knowledgeMode === "database" || knowledgeMode === "both") && (
                <div className="p-5 rounded-3xl glass-panel border border-[#F1F5F9]/15 space-y-4">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-[#14B8A6]" />
                    <h3 className="text-sm font-bold text-[#F1F5F9]">
                      Connect Existing Database (Read-Only RAG Indexing)
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <select
                      value={dbType}
                      onChange={(e) =>
                        setDbType(e.target.value as "postgresql" | "mysql" | "mssql")
                      }
                      className="px-3 py-2 rounded-xl bg-[#0F172A] border border-[#F1F5F9]/15 text-xs text-[#F1F5F9]"
                    >
                      <option className="bg-[#0B1120] text-slate-100" value="postgresql">PostgreSQL / Azure PG</option>
                      <option className="bg-[#0B1120] text-slate-100" value="mysql">MySQL / MariaDB</option>
                      <option className="bg-[#0B1120] text-slate-100" value="mssql">SQL Server (MSSQL)</option>
                    </select>
                    <input
                      type="text"
                      value={dbLabel}
                      onChange={(e) => setDbLabel(e.target.value)}
                      placeholder="Connection Label"
                      className="sm:col-span-2 px-3 py-2 rounded-xl bg-black/40 border border-[#F1F5F9]/15 text-xs text-[#F1F5F9]"
                    />
                  </div>

                  <input
                    type="password"
                    value={dbUri}
                    onChange={(e) => setDbUri(e.target.value)}
                    placeholder="postgresql://readonly_user:password@host:5432/dbname"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-[#F1F5F9]/15 text-xs font-mono text-[#F1F5F9]"
                  />

                  {availableTables.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-[#14B8A6]">
                        Select Tables to Index ({selectedTables.length} selected):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {availableTables.map((tbl) => {
                          const checked = selectedTables.includes(tbl);
                          return (
                            <button
                              key={tbl}
                              type="button"
                              onClick={() =>
                                setSelectedTables((prev) =>
                                  checked ? prev.filter((t) => t !== tbl) : [...prev, tbl]
                                )
                              }
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono cursor-pointer ${
                                checked
                                  ? "bg-[#14B8A6] text-[#0F172A] font-bold"
                                  : "bg-black/40 text-[#F1F5F9]/70 border border-[#F1F5F9]/15"
                              }`}
                            >
                              {tbl}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2.5">
                    <button
                      type="button"
                      onClick={handleTestDb}
                      disabled={isTestingDb || !dbUri.trim()}
                      className="px-4 py-2 rounded-xl glass-panel border border-[#14B8A6]/50 text-xs font-bold text-[#14B8A6] cursor-pointer"
                    >
                      {isTestingDb ? "Testing Connection..." : "1. Test & Inspect Tables"}
                    </button>
                    <button
                      type="button"
                      onClick={handleAttachDb}
                      disabled={!activeModel || !dbUri.trim()}
                      className="codos-cta-btn px-4 py-2 rounded-xl bg-[#14B8A6] text-[#0F172A] text-xs font-bold cursor-pointer"
                    >
                      {dbTestSuccess ? "✓ 2. Save Database Source" : "Save Database Source"}
                    </button>
                  </div>
                </div>
              )}

              {/* Option B / C: Drag-and-Drop Document Upload */}
              {(knowledgeMode === "documents" || knowledgeMode === "both") && (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingOver(true);
                  }}
                  onDragLeave={() => setIsDraggingOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingOver(false);
                    handleFilesUpload(e.dataTransfer.files);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-7 rounded-3xl glass-panel border-2 border-dashed transition-all cursor-pointer text-center space-y-2.5 ${
                    isDraggingOver
                      ? "border-[#14B8A6] bg-[#14B8A6]/10"
                      : "border-[#F1F5F9]/25 hover:border-[#14B8A6]"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.docx,.jsonl,.json,.csv,.md,.txt,.yaml"
                    onChange={(e) => handleFilesUpload(e.target.files)}
                    className="hidden"
                  />
                  <UploadCloud className="w-8 h-8 text-[#14B8A6] mx-auto" />
                  <h3 className="text-sm font-bold text-[#F1F5F9]">
                    {isUploading
                      ? "Uploading files to SkyBeak..."
                      : "Drag & Drop Documents or Click to Upload"}
                  </h3>
                  <p className="text-xs text-[#F1F5F9]/70">
                    Supports PDF, DOCX, TXT, CSV, JSONL, YAML, and Markdown.
                  </p>
                </div>
              )}

              {/* Attached Knowledge Sources List */}
              <div className="rounded-2xl glass-panel border border-[#F1F5F9]/12 overflow-hidden">
                <div className="px-5 py-3 border-b border-[#F1F5F9]/10 flex items-center justify-between">
                  <span className="text-xs font-bold text-[#F1F5F9]">
                    Attached Knowledge Sources ({sources.length})
                  </span>
                  <span className="text-[11px] font-mono text-[#14B8A6]">
                    Non-mutually exclusive (DB + Docs combined)
                  </span>
                </div>
                {sources.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#F1F5F9]/60">
                    No documents or databases attached yet. Add at least one source above, then click Generate Model.
                  </div>
                ) : (
                  <div className="divide-y divide-[#F1F5F9]/10">
                    {sources.map((src) => (
                      <div
                        key={src.id}
                        className="p-3.5 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {src.source_type === "database" ? (
                            <Database className="w-4 h-4 text-[#14B8A6] flex-shrink-0" />
                          ) : (
                            <FileText className="w-4 h-4 text-[#14B8A6] flex-shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-[#F1F5F9] truncate">
                              {src.source_type === "database"
                                ? `${src.db_label} (${src.db_type})`
                                : src.file_name}
                            </div>
                            <div className="text-[10px] font-mono text-[#F1F5F9]/65">
                              Status: {src.status} • ~{src.token_count.toLocaleString()} tokens
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveSource(src.id)}
                          className="p-1.5 text-red-400 hover:bg-red-500/15 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right 5 Columns: Generate Model Button, 9-Stage Live Status & Model Ready Screen */}
            <div className="lg:col-span-5 p-6 rounded-3xl glass-panel border-2 border-[#14B8A6]/60 space-y-5">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase text-[#14B8A6]">
                  Step 3 • Build Unified RAG Knowledge Base
                </span>
                <h3 className="text-lg font-bold text-[#F1F5F9] mt-0.5">
                  Generate &amp; Deploy Model
                </h3>
              </div>

              <button
                onClick={handleGenerateModel}
                disabled={
                  !activeModel ||
                  activeJob?.status === "RUNNING" ||
                  activeJob?.status === "QUEUED"
                }
                className="codos-cta-btn w-full py-3.5 rounded-xl bg-[#14B8A6] text-[#0F172A] text-xs font-bold flex items-center justify-center gap-2 shadow-lg cursor-pointer disabled:opacity-50"
              >
                <Zap className="w-4 h-4" />
                <span>
                  {activeJob?.status === "RUNNING"
                    ? "Generating Model..."
                    : activeJob?.status === "FAILED"
                    ? "Retry Model Generation"
                    : "Generate Model"}
                </span>
              </button>

              {/* Real-Time 9-Stage Progress Indicator */}
              {activeJob && (
                <div className="p-4 rounded-2xl bg-black/45 border border-[#14B8A6]/40 space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-bold text-[#F1F5F9]">
                      Stage {activeJob.current_step}/9 • {activeJob.status}
                    </span>
                    <span className="font-bold text-[#14B8A6]">
                      {activeJob.progress_percent}%
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-[#F1F5F9]/15 overflow-hidden">
                    <div
                      className="h-full bg-[#14B8A6] transition-all duration-300"
                      style={{ width: `${activeJob.progress_percent}%` }}
                    />
                  </div>
                  <p className="text-xs font-mono text-[#F1F5F9]/85">
                    {activeJob.step_label}
                  </p>
                  {activeJob.error_message && (
                    <p className="text-xs text-red-400 font-mono">
                      Error: {activeJob.error_message}
                    </p>
                  )}
                </div>
              )}

              {/* Step 4: Model Ready Completion Card */}
              {activeModel?.status === "READY" && (
                <div className="p-4 rounded-2xl bg-[#14B8A6]/10 border border-[#14B8A6] space-y-4">
                  <div className="flex items-center gap-2 text-[#14B8A6] font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Model Ready: {activeModel.name}</span>
                  </div>

                  {revealedApiKey && (
                    <div className="p-3 rounded-xl bg-black/60 border border-[#F1F5F9]/15 space-y-1.5">
                      <span className="text-[10px] font-mono text-[#14B8A6] block">
                        Generated Developer API Key (Copy &amp; save securely):
                      </span>
                      <div className="flex items-center justify-between gap-2">
                        <code className="text-[11px] font-mono text-[#F1F5F9] truncate">
                          {revealedApiKey}
                        </code>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(revealedApiKey);
                            setCopiedKey(true);
                            setTimeout(() => setCopiedKey(false), 2000);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[#14B8A6] text-[#0F172A] text-[10px] font-bold cursor-pointer"
                        >
                          {copiedKey ? "Copied!" : "Copy Key"}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      onClick={() => setSubView("chatbot")}
                      className="codos-cta-btn py-2.5 px-3 rounded-xl bg-[#14B8A6] text-[#0F172A] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Use Online Chatbot</span>
                    </button>
                    <button
                      onClick={() => setSubView("dashboard")}
                      className="py-2.5 px-3 rounded-xl glass-panel border border-[#14B8A6] text-xs font-bold text-[#14B8A6] flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Code2 className="w-3.5 h-3.5" />
                      <span>Use Through API</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SCREEN 4: ONLINE RAG CHATBOT INTERFACE (#15, #22)
         ===================================================================== */}
      {subView === "chatbot" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 p-5 rounded-3xl glass-panel border border-[#F1F5F9]/15 space-y-4">
            <h3 className="text-sm font-bold text-[#F1F5F9]">Active Chatbot Model</h3>
            <select
              value={activeModel?.id || ""}
              onChange={(e) => {
                const found = userModels.find((m) => m.id === e.target.value);
                if (found) setActiveModel(found);
              }}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F172A] border border-[#F1F5F9]/20 text-xs font-bold text-[#F1F5F9]"
            >
              {userModels.map((m) => (
                <option className="bg-[#0B1120] text-slate-100" key={m.id} value={m.id}>
                  {m.name} ({m.industry || "General AI"})
                </option>
              ))}
            </select>

            <div className="p-3.5 rounded-2xl bg-black/40 border border-[#F1F5F9]/12 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[#F1F5F9] block">
                  RAG Retrieval Grounding
                </span>
                <span className="text-[10px] font-mono text-[#14B8A6]">
                  {sources.length} knowledge sources attached
                </span>
              </div>
              <button
                onClick={() => setUseRagContext(!useRagContext)}
                className="px-3 py-1 rounded-lg bg-[#14B8A6] text-[#0F172A] text-xs font-bold cursor-pointer"
              >
                {useRagContext ? "ON" : "OFF"}
              </button>
            </div>

            <button
              onClick={() => setSubView("training")}
              className="w-full py-2.5 rounded-xl glass-panel border border-[#F1F5F9]/15 text-xs font-bold text-[#F1F5F9] hover:border-[#14B8A6] flex items-center justify-center gap-2 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5 text-[#14B8A6]" />
              <span>Add More Docs or Database</span>
            </button>
          </div>

          <div className="lg:col-span-8 rounded-3xl glass-panel border border-[#F1F5F9]/15 flex flex-col justify-between min-h-[520px] max-h-[620px]">
            <div className="px-5 py-3.5 border-b border-[#F1F5F9]/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-[#14B8A6]" />
                <span className="text-sm font-bold text-[#F1F5F9]">
                  {activeModel?.name || "Select or Create a Model First"}
                </span>
              </div>
              <span className="text-[11px] font-mono text-[#14B8A6]">
                {activeModel?.status || "IDLE"}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-xs text-[#F1F5F9]/60 py-12">
                  Ask a question grounded on your connected database and uploaded documents.
                </div>
              )}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex items-start gap-3 ${
                    m.role === "user" ? "flex-row-reverse" : ""
                  }`}
                >
                  <div className="w-8 h-8 rounded-xl bg-[#14B8A6]/20 text-[#14B8A6] flex items-center justify-center flex-shrink-0">
                    {m.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  <div className="max-w-[80%] p-3.5 rounded-2xl bg-black/45 border border-[#F1F5F9]/12 space-y-2">
                    <div className="text-xs whitespace-pre-line text-[#F1F5F9] leading-relaxed">
                      {m.content}
                    </div>
                    {m.role === "assistant" && (
                      <div className="text-[10px] font-mono text-[#14B8A6] flex flex-wrap gap-3 pt-1 border-t border-[#F1F5F9]/10">
                        {m.latencyMs !== undefined && <span>⚡ {m.latencyMs}ms</span>}
                        {m.sources && m.sources.length > 0 && (
                          <span>Sources: {m.sources.join(", ")}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isBotTyping && (
                <div className="text-xs font-mono text-[#14B8A6]">
                  Retrieving RAG context &amp; generating response...
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendChat();
              }}
              className="p-4 border-t border-[#F1F5F9]/10 flex gap-3"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask your SkyBeak AI model..."
                className="flex-1 px-4 py-2.5 rounded-xl bg-black/40 border border-[#F1F5F9]/15 text-xs text-[#F1F5F9] outline-none"
              />
              <button
                type="submit"
                disabled={!activeModel || isBotTyping}
                className="codos-cta-btn px-5 py-2.5 rounded-xl bg-[#14B8A6] text-[#0F172A] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <span>Send</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          SCREEN 5: ADVANCED SKYBEAK MANAGEMENT DASHBOARD (#16-#23)
         ===================================================================== */}
      {subView === "dashboard" && (
        <div className="space-y-6">
          {/* Usage Analytics Row (#21) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total API & Chat Requests", value: analytics.total_requests },
              { label: "Total Tokens Processed", value: analytics.total_tokens.toLocaleString() },
              { label: "Avg Inference Latency", value: `${analytics.avg_latency_ms} ms` },
              { label: "External API Calls", value: analytics.external_api_requests },
            ].map((stat) => (
              <div key={stat.label} className="p-4 rounded-2xl glass-panel border border-[#F1F5F9]/12">
                <div className="flex items-center justify-between text-[11px] text-[#F1F5F9]/65">
                  <span>{stat.label}</span>
                  <BarChart3 className="w-3.5 h-3.5 text-[#14B8A6]" />
                </div>
                <div className="text-xl font-bold font-mono text-[#14B8A6] mt-1">
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* API Key Vault & Integration Snippet (#16, #17, #18, #19) */}
            <div className="lg:col-span-7 p-6 rounded-3xl glass-panel border border-[#F1F5F9]/15 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-[#14B8A6]" />
                  <h3 className="text-base font-bold text-[#F1F5F9]">
                    Developer API Keys ({activeModel?.name})
                  </h3>
                </div>
                {activeModel && (
                  <a
                    href={`${skybeakApi.baseUrl}/skybeak/models/${activeModel.id}/knowledge-base/export`}
                    className="px-3 py-1.5 rounded-xl glass-panel border border-[#14B8A6]/40 text-[11px] font-bold text-[#14B8A6] flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Knowledge Base (.jsonl)</span>
                  </a>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="Key label (e.g., Mobile App)"
                  className="flex-1 px-3 py-2 rounded-xl bg-black/40 border border-[#F1F5F9]/15 text-xs text-[#F1F5F9]"
                />
                <button
                  onClick={async () => {
                    if (!activeModel) return;
                    const created = await skybeakApi.createApiKey(activeModel.id, newKeyName);
                    setRevealedApiKey(created.api_key);
                    await loadModelDetails(activeModel.id);
                  }}
                  className="codos-cta-btn px-4 py-2 rounded-xl bg-[#14B8A6] text-[#0F172A] text-xs font-bold cursor-pointer"
                >
                  + Generate Key
                </button>
              </div>

              {revealedApiKey && (
                <div className="p-3 rounded-xl bg-[#14B8A6]/15 border border-[#14B8A6] text-xs font-mono text-[#F1F5F9] flex items-center justify-between">
                  <span className="truncate">{revealedApiKey}</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(revealedApiKey)}
                    className="px-2.5 py-1 rounded bg-[#14B8A6] text-[#0F172A] font-bold cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="divide-y divide-[#F1F5F9]/10">
                {apiKeys.map((k) => (
                  <div key={k.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-[#F1F5F9]">{k.name}</span>
                      <span className="font-mono text-[#14B8A6] ml-2">{k.key_prefix}</span>
                      <span className="ml-2 text-[10px] text-[#F1F5F9]/60">
                        {k.is_active ? "Active" : "Revoked"}
                      </span>
                    </div>
                    {k.is_active && activeModel && (
                      <button
                        onClick={async () => {
                          await skybeakApi.revokeApiKey(activeModel.id, k.id);
                          await loadModelDetails(activeModel.id);
                        }}
                        className="text-red-400 hover:underline text-[11px] cursor-pointer"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="p-3.5 rounded-xl bg-black/50 border border-[#F1F5F9]/12 space-y-1.5">
                <span className="text-[10px] font-mono font-bold text-[#14B8A6] uppercase block">
                  External Application Integration (cURL)
                </span>
                <pre className="text-[11px] font-mono text-[#F1F5F9]/90 overflow-x-auto">
{`curl -X POST ${skybeakApi.baseUrl}/skybeak/external/chat \\
  -H "Authorization: Bearer sb_live_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Query my connected knowledge base", "use_rag": true}'`}
                </pre>
              </div>
            </div>

            {/* Additional Custom Requests (#23) */}
            <div className="lg:col-span-5 p-6 rounded-3xl glass-panel border border-[#F1F5F9]/15 space-y-4">
              <h3 className="text-base font-bold text-[#F1F5F9]">
                Request Custom AI Functionality
              </h3>
              <p className="text-xs text-[#F1F5F9]/75">
                Need custom fine-tuning, bespoke database connectors, or dedicated enterprise SLAs? Submit a request directly to the Via Codos engineering team.
              </p>
              <input
                type="text"
                value={reqTitle}
                onChange={(e) => setReqTitle(e.target.value)}
                placeholder="Request title (e.g., Custom SAP ERP Connector)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-[#F1F5F9]/15 text-xs text-[#F1F5F9]"
              />
              <textarea
                rows={4}
                value={reqDetails}
                onChange={(e) => setReqDetails(e.target.value)}
                placeholder="Describe your custom model or integration requirements..."
                className="w-full p-3 rounded-xl bg-black/40 border border-[#F1F5F9]/15 text-xs text-[#F1F5F9]"
              />
              <button
                onClick={async () => {
                  if (!reqTitle.trim() || !reqDetails.trim()) return;
                  await skybeakApi.submitCustomRequest({
                    configured_model_id: activeModel?.id,
                    title: reqTitle,
                    details: reqDetails,
                  });
                  setReqTitle("");
                  setReqDetails("");
                  setReqSubmitted(true);
                  setTimeout(() => setReqSubmitted(false), 3000);
                }}
                className="codos-cta-btn w-full py-2.5 rounded-xl bg-[#14B8A6] text-[#0F172A] text-xs font-bold cursor-pointer"
              >
                {reqSubmitted ? "✓ Request Submitted!" : "Submit Custom Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};