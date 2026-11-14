"use client";

import React, { useState, useRef } from "react";
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
  Play,
  Sliders,
  Zap,
  ShieldCheck,
  Cpu,
  Database,
  RefreshCw,
  Layers,
  Code2,
  Stethoscope,
  Landmark,
  Scale,
  ShoppingBag,
  PhoneCall,
  CheckCircle2,
  Plus,
  Bot,
  User,
  RotateCcw,
} from "lucide-react";

export type SkyBeakSubView = "models" | "industry" | "chatbot" | "training";

interface SkyBeakAiWorkspaceProps {
  initialSubView?: SkyBeakSubView;
  isLightTheme?: boolean;
  onOpenApiCatalog?: () => void;
}

interface SkyBeakModelItem {
  id: string;
  name: string;
  provider: string;
  family: "SkyBeak Native" | "Partner Flagship" | "Custom Fine-Tuned";
  params: string;
  contextWindow: string;
  latency: string;
  throughput: string;
  costPer1M: string;
  strengths: string[];
  status: "Deployed" | "Ready" | "Fine-Tuned";
}

interface IndustryVerticalModel {
  id: string;
  industry: string;
  modelName: string;
  modelId: string;
  icon: React.ElementType;
  compliance: string[];
  accuracyScore: string;
  avgLatency: string;
  summary: string;
  useCases: string[];
  samplePrompt: string;
  defaultSystemPrompt: string;
}

interface TrainingDocItem {
  id: string;
  name: string;
  size: string;
  format: string;
  tokens: string;
  status: "Indexed & Chunked" | "Processing..." | "Verified";
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  model: string;
  latency?: string;
  tokens?: number;
  ragGrounded?: boolean;
  timestamp: string;
}

const INITIAL_SKYBEAK_MODELS: SkyBeakModelItem[] = [
  {
    id: "skybeak-pro-70b",
    name: "SkyBeak-Pro-70B-Instruct",
    provider: "Via Codos AI Lab",
    family: "SkyBeak Native",
    params: "70B Dense",
    contextWindow: "128k tokens",
    latency: "64ms TTFT",
    throughput: "145 tok/s",
    costPer1M: "$0.90 / 1M",
    strengths: ["Enterprise Reasoning", "Function Calling", "RAG Synthesis"],
    status: "Deployed",
  },
  {
    id: "skybeak-voice-8b",
    name: "SkyBeak-Voice-Fast-8B",
    provider: "Via Codos AI Lab",
    family: "SkyBeak Native",
    params: "8B SpecDec",
    contextWindow: "64k tokens",
    latency: "29ms TTFT",
    throughput: "310 tok/s",
    costPer1M: "$0.15 / 1M",
    strengths: ["Call Colleague Voice", "Sub-50ms Dialog", "Zero-Pause Turn"],
    status: "Deployed",
  },
  {
    id: "skybeak-omni-vision",
    name: "SkyBeak-Omni-Vision-34B",
    provider: "Via Codos AI Lab",
    family: "SkyBeak Native",
    params: "34B Multimodal",
    contextWindow: "128k tokens",
    latency: "82ms TTFT",
    throughput: "118 tok/s",
    costPer1M: "$0.65 / 1M",
    strengths: ["Document OCR", "Chart & Invoice Parsing", "Multimodal RAG"],
    status: "Deployed",
  },
  {
    id: "claude-3-5-sonnet",
    name: "Claude 3.5 Sonnet (Routed)",
    provider: "Anthropic via SkyBeak",
    family: "Partner Flagship",
    params: "Frontier",
    contextWindow: "200k tokens",
    latency: "138ms TTFT",
    throughput: "92 tok/s",
    costPer1M: "$3.00 / 1M",
    strengths: ["Complex Coding", "Nuanced Writing", "Agentic Workflows"],
    status: "Ready",
  },
  {
    id: "gpt-4o",
    name: "GPT-4o Omni (Routed)",
    provider: "OpenAI via SkyBeak",
    family: "Partner Flagship",
    params: "Frontier",
    contextWindow: "128k tokens",
    latency: "145ms TTFT",
    throughput: "98 tok/s",
    costPer1M: "$2.50 / 1M",
    strengths: ["General Reasoning", "JSON Schema Strict", "Multilingual"],
    status: "Ready",
  },
  {
    id: "gemini-1-5-pro",
    name: "Gemini 1.5 Pro (Routed)",
    provider: "Google via SkyBeak",
    family: "Partner Flagship",
    params: "Frontier MoE",
    contextWindow: "2M tokens",
    latency: "128ms TTFT",
    throughput: "105 tok/s",
    costPer1M: "$1.25 / 1M",
    strengths: ["Massive Context", "Repo-Wide Analysis", "Audio/Video Input"],
    status: "Ready",
  },
];

const INDUSTRY_MODELS: IndustryVerticalModel[] = [
  {
    id: "ind-healthcare",
    industry: "Healthcare & Clinical AI",
    modelName: "SkyBeak-Med-70B",
    modelId: "skybeak-med-70b",
    icon: Stethoscope,
    compliance: ["HIPAA Ready", "HL7 / FHIR", "Zero Data Retention"],
    accuracyScore: "99.1% MedQA",
    avgLatency: "68ms",
    summary:
      "Domain-trained on clinical guidelines, EHR summarization, ICD-10 medical coding, and empathetic patient intake triage.",
    useCases: [
      "Automated patient symptom intake & appointment triage via Call Colleague",
      "Clinical SOAP note generation & ICD-10 / CPT code extraction",
      "Prior authorization & insurance claim document verification",
    ],
    samplePrompt:
      "Summarize this patient intake transcript into a structured SOAP note and suggest relevant ICD-10 codes for acute migraine.",
    defaultSystemPrompt:
      "You are SkyBeak-Med-70B, a HIPAA-compliant clinical documentation and patient triage AI assistant.",
  },
  {
    id: "ind-finance",
    industry: "FinTech, Banking & Risk",
    modelName: "SkyBeak-FinQuant-34B",
    modelId: "skybeak-finquant-34b",
    icon: Landmark,
    compliance: ["PCI-DSS", "SOC-2 Type II", "ISO 27001"],
    accuracyScore: "98.7% FinBench",
    avgLatency: "54ms",
    summary:
      "Engineered for real-time fraud anomaly explanation, SEC/IFRS financial filing extraction, KYC/AML compliance, and wealth advisory.",
    useCases: [
      "Real-time credit card & wire fraud alert verification calls",
      "Automated 10-K / earnings report table & ratio extraction",
      "AML / KYC customer onboarding document verification",
    ],
    samplePrompt:
      "Analyze this Q3 balance sheet summary and calculate debt-to-equity, free cash flow margin, and liquidity risk flags.",
    defaultSystemPrompt:
      "You are SkyBeak-FinQuant-34B, a precision financial analysis and risk compliance AI model.",
  },
  {
    id: "ind-legal",
    industry: "Legal & Contract Intelligence",
    modelName: "SkyBeak-Lex-70B",
    modelId: "skybeak-lex-70b",
    icon: Scale,
    compliance: ["SOC-2 Type II", "GDPR", "Privilege Isolated"],
    accuracyScore: "98.9% LegalBench",
    avgLatency: "71ms",
    summary:
      "Specialized in MSA/NDA contract redlining, indemnity & liability clause detection, regulatory compliance, and citation-backed research.",
    useCases: [
      "Automated NDA, MSA & SaaS vendor agreement risk scoring",
      "Clause-by-clause deviation detection against enterprise playbooks",
      "Multi-jurisdiction data privacy (GDPR / CCPA) audit checks",
    ],
    samplePrompt:
      "Review this limitation of liability clause and flag any uncapped indemnification risks for our SaaS platform.",
    defaultSystemPrompt:
      "You are SkyBeak-Lex-70B, an enterprise legal contract intelligence and compliance AI model.",
  },
  {
    id: "ind-ecommerce",
    industry: "E-Commerce & Retail Concierge",
    modelName: "SkyBeak-Commerce-14B",
    modelId: "skybeak-commerce-14b",
    icon: ShoppingBag,
    compliance: ["PCI-DSS", "GDPR", "99.99% SLA"],
    accuracyScore: "99.4% CSAT",
    avgLatency: "42ms",
    summary:
      "High-speed conversational commerce model for live order tracking, instant refunds/exchanges, catalog recommendations, and voice shopping.",
    useCases: [
      "24/7 inbound order status,WISMO & return authorization on voice & chat",
      "Semantic product catalog discovery & personalized upsell bundles",
      "Multilingual customer support across 35+ languages",
    ],
    samplePrompt:
      "Customer order #ORD-88210 is delayed by 2 days. Draft an empathetic resolution offering express reshipment and a 15% credit.",
    defaultSystemPrompt:
      "You are SkyBeak-Commerce-14B, a high-converting retail concierge and customer resolution AI.",
  },
  {
    id: "ind-telecom",
    industry: "Telecom & Call Center Ops",
    modelName: "SkyBeak-Telecom-8B",
    modelId: "skybeak-telecom-8b",
    icon: PhoneCall,
    compliance: ["FCC / TCPA", "SOC-2 Type II", "Sub-50ms Edge"],
    accuracyScore: "99.3% Intent",
    avgLatency: "32ms",
    summary:
      "Ultra-low-latency telephony model purpose-built for high-volume contact centers, SIP trunk IVR replacement, and live agent assist.",
    useCases: [
      "Zero-hold-time inbound call resolution & smart SIP department routing",
      "Automated billing dispute explanation & plan upgrade provisioning",
      "Real-time sentiment coaching & live call summary generation",
    ],
    samplePrompt:
      "Generate a concise voice script for Eleanor to resolve a roaming data overage inquiry and apply a loyalty waiver.",
    defaultSystemPrompt:
      "You are SkyBeak-Telecom-8B, an ultra-low-latency contact center and telephony AI specialist.",
  },
  {
    id: "ind-devops",
    industry: "Software & API Engineering",
    modelName: "SkyBeak-Code-32B",
    modelId: "skybeak-code-32b",
    icon: Code2,
    compliance: ["SOC-2 Type II", "Zero Code Retention", "OWASP Checked"],
    accuracyScore: "94.2% HumanEval",
    avgLatency: "58ms",
    summary:
      "Trained on OpenAPI specs, distributed microservices, TypeScript/Python/Go SDK synthesis, and automated incident root-cause analysis.",
    useCases: [
      "Automated Thumbs Up API gateway schema & SDK client generation",
      "Production log anomaly root-cause analysis & incident runbooks",
      "Security vulnerability scanning & automated pull request fixes",
    ],
    samplePrompt:
      "Write a TypeScript middleware that verifies Thumbs Up API HMAC-SHA256 webhook signatures with replay protection.",
    defaultSystemPrompt:
      "You are SkyBeak-Code-32B, a principal cloud architect and API security engineering AI.",
  },
];

export const SkyBeakAiWorkspace: React.FC<SkyBeakAiWorkspaceProps> = ({
  initialSubView = "models",
  isLightTheme = false,
  onOpenApiCatalog,
}) => {
  const [subView, setSubView] = useState<SkyBeakSubView>(initialSubView);

  // 1. SkyBeak AI Models state
  const [models, setModels] = useState<SkyBeakModelItem[]>(
    INITIAL_SKYBEAK_MODELS
  );
  const [modelFamilyFilter, setModelFamilyFilter] = useState<
    "ALL" | "SkyBeak Native" | "Partner Flagship" | "Custom Fine-Tuned"
  >("ALL");
  const [selectedModelId, setSelectedModelId] =
    useState<string>("skybeak-pro-70b");
  const [routingMode, setRoutingMode] = useState<
    "lowest-latency" | "cost-optimized" | "highest-quality"
  >("lowest-latency");

  // 2. Industry-Specific AI Model Selection state
  const [selectedIndustry, setSelectedIndustry] =
    useState<IndustryVerticalModel>(INDUSTRY_MODELS[0]);
  const [activatedIndustryIds, setActivatedIndustryIds] = useState<string[]>([
    "ind-healthcare",
    "ind-telecom",
  ]);

  // 3. General AI Chatbot Interface state
  const [chatModel, setChatModel] = useState<string>("SkyBeak-Pro-70B-Instruct");
  const [chatSystemPrompt, setChatSystemPrompt] = useState<string>(
    "You are SkyBeak AI, the unified enterprise assistant inside Codos Console. Provide accurate, concise, and actionable answers."
  );
  const [chatTemperature, setChatTemperature] = useState<number>(0.3);
  const [useRagContext, setUseRagContext] = useState<boolean>(true);
  const [chatInput, setChatInput] = useState<string>("");
  const [isBotTyping, setIsBotTyping] = useState<boolean>(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg-1",
      role: "assistant",
      content:
        "Welcome to **SkyBeak AI Chat Studio**. I am connected to your unified Codos Console workspace, including your **Call Colleague** voice transcripts, **Thumbs Up API** telemetry, and custom RAG knowledge base.\n\nHow can I help you build, analyze, or automate today?",
      model: "SkyBeak-Pro-70B-Instruct",
      latency: "58ms",
      tokens: 48,
      ragGrounded: true,
      timestamp: "Just now",
    },
  ]);

  // 4. Custom AI Model Training & Drag-and-Drop Upload state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [trainingDocs, setTrainingDocs] = useState<TrainingDocItem[]>([
    {
      id: "doc-1",
      name: "via-codos-enterprise-sla-playbook.pdf",
      size: "4.2 MB",
      format: "PDF",
      tokens: "184,500 tok",
      status: "Indexed & Chunked",
    },
    {
      id: "doc-2",
      name: "call-colleague-support-dialogues-v4.jsonl",
      size: "12.8 MB",
      format: "JSONL",
      tokens: "640,200 tok",
      status: "Verified",
    },
    {
      id: "doc-3",
      name: "thumbs-up-api-openapi-spec.yaml",
      size: "1.1 MB",
      format: "YAML",
      tokens: "42,800 tok",
      status: "Indexed & Chunked",
    },
  ]);
  const [customModelName, setCustomModelName] = useState<string>(
    "skybeak-codos-custom-v1"
  );
  const [baseTrainingModel, setBaseTrainingModel] = useState<string>(
    "SkyBeak-Pro-70B-Instruct"
  );
  const [trainingMethod, setTrainingMethod] = useState<string>(
    "LoRA Fine-Tuning + RAG Hybrid"
  );
  const [epochs, setEpochs] = useState<number>(3);
  const [learningRate, setLearningRate] = useState<string>("2e-4");
  const [chunkSize, setChunkSize] = useState<number>(512);
  const [isTraining, setIsTraining] = useState<boolean>(false);
  const [trainingProgress, setTrainingProgress] = useState<number>(0);
  const [trainingCompleted, setTrainingCompleted] = useState<boolean>(false);

  // Handlers for Drag-and-Drop Document Upload
  const processUploadedFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const newDocs: TrainingDocItem[] = Array.from(fileList).map((file, idx) => {
      const ext = file.name.split(".").pop()?.toUpperCase() || "DOC";
      const sizeMb = Math.max(0.1, file.size / (1024 * 1024)).toFixed(1);
      const estTokens = Math.max(
        1200,
        Math.round(file.size / 4)
      ).toLocaleString();
      return {
        id: `doc-${Date.now()}-${idx}`,
        name: file.name,
        size: `${sizeMb} MB`,
        format: ext,
        tokens: `${estTokens} tok`,
        status: "Indexed & Chunked",
      };
    });
    setTrainingDocs((prev) => [...newDocs, ...prev]);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    processUploadedFiles(e.dataTransfer.files);
  };

  const handleAddSampleDataset = () => {
    const sampleDoc: TrainingDocItem = {
      id: `doc-${Date.now()}`,
      name: `domain-knowledge-corpus-${trainingDocs.length + 1}.jsonl`,
      size: "6.4 MB",
      format: "JSONL",
      tokens: "312,000 tok",
      status: "Indexed & Chunked",
    };
    setTrainingDocs((prev) => [sampleDoc, ...prev]);
  };

  const handleRemoveDoc = (id: string) => {
    setTrainingDocs((prev) => prev.filter((d) => d.id !== id));
  };

  const handleStartTraining = () => {
    if (trainingDocs.length === 0 || isTraining) return;
    setIsTraining(true);
    setTrainingCompleted(false);
    setTrainingProgress(18);

    setTimeout(() => setTrainingProgress(48), 500);
    setTimeout(() => setTrainingProgress(82), 1000);
    setTimeout(() => {
      setTrainingProgress(100);
      setIsTraining(false);
      setTrainingCompleted(true);

      const newCustomModel: SkyBeakModelItem = {
        id: customModelName.toLowerCase().replace(/\s+/g, "-"),
        name: customModelName,
        provider: "Custom Fine-Tuned (Via Codos)",
        family: "Custom Fine-Tuned",
        params: `${baseTrainingModel.split("-")[1] || "70B"} LoRA`,
        contextWindow: "128k tokens",
        latency: "52ms TTFT",
        throughput: "160 tok/s",
        costPer1M: "$0.45 / 1M",
        strengths: [
          `${trainingDocs.length} Custom Docs Indexed`,
          trainingMethod.split(" ")[0],
          "Domain Grounded",
        ],
        status: "Fine-Tuned",
      };

      setModels((prev) => [
        newCustomModel,
        ...prev.filter((m) => m.name !== customModelName),
      ]);
      setChatModel(customModelName);
    }, 1600);
  };

  // Handlers for Chatbot
  const handleSendChatMessage = (customPromptText?: string) => {
    const textToSend = (customPromptText ?? chatInput).trim();
    if (!textToSend || isBotTyping) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: textToSend,
      model: chatModel,
      timestamp: "Just now",
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customPromptText) setChatInput("");
    setIsBotTyping(true);

    setTimeout(() => {
      setIsBotTyping(false);
      const replyContent = generateSmartAssistantReply(
        textToSend,
        chatModel,
        useRagContext,
        trainingDocs.length
      );
      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: "assistant",
        content: replyContent,
        model: chatModel,
        latency: "61ms",
        tokens: 134,
        ragGrounded: useRagContext,
        timestamp: "Just now",
      };
      setMessages((prev) => [...prev, botMsg]);
    }, 650);
  };

  const handleOpenIndustryInChat = (ind: IndustryVerticalModel) => {
    setChatModel(ind.modelName);
    setChatSystemPrompt(ind.defaultSystemPrompt);
    setSubView("chatbot");
    handleSendChatMessage(ind.samplePrompt);
  };

  const handleToggleIndustryActivation = (id: string) => {
    setActivatedIndustryIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const filteredModels = models.filter(
    (m) => modelFamilyFilter === "ALL" || m.family === modelFamilyFilter
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* =====================================================================
          TOP HEADER & 4-MODULE NAVIGATION BAR
         ===================================================================== */}
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
              <span>SkyBeak AI Studio • Multi-Model Intelligence &amp; Fine-Tuning</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#F1F5F9]">
              SkyBeak AI Models &amp; Training Suite
            </h1>
            <p className="text-xs sm:text-sm text-[#F1F5F9]/75 mt-0.5">
              Manage foundation models, select industry-specific verticals, chat in real time, and train custom models via drag-and-drop documents.
            </p>
          </div>
        </div>

        {/* 4-Screen Sub-Navigation Switcher inside SkyBeak AI Models */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            {
              id: "models" as const,
              label: "SkyBeak AI Models",
              badge: "Models",
              icon: Cpu,
            },
            {
              id: "industry" as const,
              label: "Industry AI Models",
              badge: "6 Verticals",
              icon: Building2,
            },
            {
              id: "chatbot" as const,
              label: "General AI Chatbot",
              badge: "Chat",
              icon: MessageSquare,
            },
            {
              id: "training" as const,
              label: "Custom AI Training",
              badge: "Train",
              icon: UploadCloud,
            },
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
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${
                    isActive
                      ? "bg-black/20 !text-[#FFFFFF]"
                      : isLightTheme
                      ? "bg-[#14213D]/12 text-[#14213D]"
                      : "bg-[#F1F5F9]/10 text-[#F1F5F9]/85"
                  }`}
                >
                  {tab.badge}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* =====================================================================
          SCREEN 1: SKYBEAK AI MODELS INTERFACE
         ===================================================================== */}
      {subView === "models" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Smart Router Telemetry & Strategy Bar */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-8 p-5 rounded-2xl glass-panel border border-[#F1F5F9]/12 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#14B8A6]" />
                  <h2 className="text-sm font-bold text-[#F1F5F9]">
                    SkyBeak Dynamic Smart Router
                  </h2>
                </div>
                <p className="text-xs text-[#F1F5F9]/70">
                  Automatically routes requests across native SkyBeak models and partner LLMs with zero-downtime failover.
                </p>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                {(
                  [
                    { id: "lowest-latency", label: "Lowest Latency" },
                    { id: "cost-optimized", label: "Cost Optimized" },
                    { id: "highest-quality", label: "Max Reasoning" },
                  ] as const
                ).map((strat) => (
                  <button
                    key={strat.id}
                    onClick={() => setRoutingMode(strat.id)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      routingMode === strat.id
                        ? "codos-cta-btn bg-[#14B8A6] text-[#0F172A]"
                        : "glass-panel text-[#F1F5F9]/75"
                    }`}
                  >
                    {strat.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="lg:col-span-4 p-5 rounded-2xl glass-panel border border-[#F1F5F9]/12 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-[#F1F5F9]/65 block">
                  Semantic Prompt Cache
                </span>
                <span className="text-xl font-bold font-mono text-[#14B8A6]">
                  44.2% Hit Rate
                </span>
                <span className="text-[10px] text-[#F1F5F9]/60 block mt-0.5">
                  Saving ~$184.50 / day
                </span>
              </div>
              {onOpenApiCatalog && (
                <button
                  onClick={onOpenApiCatalog}
                  className="codos-cta-btn px-3.5 py-2 rounded-xl bg-[#14B8A6] text-[#0F172A] text-xs font-bold cursor-pointer"
                >
                  API Docs ↗
                </button>
              )}
            </div>
          </div>

          {/* Model Family Filter Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  "ALL",
                  "SkyBeak Native",
                  "Partner Flagship",
                  "Custom Fine-Tuned",
                ] as const
              ).map((fam) => (
                <button
                  key={fam}
                  onClick={() => setModelFamilyFilter(fam)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    modelFamilyFilter === fam
                      ? "codos-cta-btn bg-[#14B8A6] text-[#0F172A]"
                      : "glass-panel text-[#F1F5F9]/75"
                  }`}
                >
                  {fam === "ALL" ? `All Models (${models.length})` : fam}
                </button>
              ))}
            </div>

            <button
              onClick={() => setSubView("training")}
              className="codos-cta-btn px-4 py-2 rounded-xl bg-[#14B8A6] text-[#0F172A] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Train New Custom Model</span>
            </button>
          </div>

          {/* SkyBeak AI Models Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredModels.map((model) => {
              const isSelected = selectedModelId === model.id;
              return (
                <div
                  key={model.id}
                  onClick={() => setSelectedModelId(model.id)}
                  className={`p-5 rounded-2xl glass-panel border transition-all cursor-pointer flex flex-col justify-between gap-4 ${
                    isSelected
                      ? "border-2 border-[#14B8A6] shadow-xl"
                      : "border-[#F1F5F9]/12 hover:border-[#14B8A6]/45"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-mono uppercase font-bold text-[#14B8A6] block">
                          {model.family} • {model.provider}
                        </span>
                        <h3 className="text-base font-bold text-[#F1F5F9] mt-0.5">
                          {model.name}
                        </h3>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-[#14B8A6]">
                        ● {model.status}
                      </span>
                    </div>

                    {/* Key Specs Grid */}
                    <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-black/40 border border-[#F1F5F9]/10 text-[11px] font-mono">
                      <div>
                        <span className="text-[#F1F5F9]/55 block text-[10px]">
                          Parameters
                        </span>
                        <span className="font-bold text-[#F1F5F9]">
                          {model.params}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#F1F5F9]/55 block text-[10px]">
                          Context Window
                        </span>
                        <span className="font-bold text-[#F1F5F9]">
                          {model.contextWindow}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#F1F5F9]/55 block text-[10px]">
                          First Token Latency
                        </span>
                        <span className="font-bold text-[#14B8A6]">
                          {model.latency}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#F1F5F9]/55 block text-[10px]">
                          Throughput / Cost
                        </span>
                        <span className="font-bold text-[#F1F5F9]">
                          {model.throughput} • {model.costPer1M}
                        </span>
                      </div>
                    </div>

                    {/* Capabilities tags */}
                    <div className="flex flex-wrap gap-1.5">
                      {model.strengths.map((str) => (
                        <span
                          key={str}
                          className="text-[10px] font-medium px-2 py-0.5 rounded-md border border-[#F1F5F9]/15 text-[#F1F5F9]/80"
                        >
                          {str}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#F1F5F9]/10 flex items-center justify-between gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setChatModel(model.name);
                        setSubView("chatbot");
                      }}
                      className="codos-cta-btn flex-1 py-2 rounded-xl bg-[#14B8A6] text-[#0F172A] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Open in AI Chat</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setBaseTrainingModel(model.name);
                        setSubView("training");
                      }}
                      className="px-3 py-2 rounded-xl glass-panel text-xs font-bold text-[#F1F5F9] hover:border-[#14B8A6] cursor-pointer"
                      title="Fine-tune this model"
                    >
                      Fine-Tune
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =====================================================================
          SCREEN 2: INDUSTRY-SPECIFIC AI MODEL SELECTION SCREENS
         ===================================================================== */}
      {subView === "industry" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#F1F5F9]">
                Industry-Specific AI Model Selection
              </h2>
              <p className="text-xs text-[#F1F5F9]/75">
                Select a pre-trained vertical AI model with built-in regulatory guardrails, domain terminology, and Call Colleague voice integration.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-[#14B8A6]">
              {activatedIndustryIds.length} of {INDUSTRY_MODELS.length} Industry
              Models Active
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 7 Columns: Industry Vertical Selection Grid */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {INDUSTRY_MODELS.map((ind) => {
                const Icon = ind.icon;
                const isSelected = selectedIndustry.id === ind.id;
                const isActivated = activatedIndustryIds.includes(ind.id);

                return (
                  <div
                    key={ind.id}
                    onClick={() => setSelectedIndustry(ind)}
                    className={`p-5 rounded-2xl glass-panel border transition-all cursor-pointer flex flex-col justify-between gap-3.5 ${
                      isSelected
                        ? "border-2 border-[#14B8A6] shadow-xl"
                        : "border-[#F1F5F9]/12 hover:border-[#14B8A6]/45"
                    }`}
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="w-9 h-9 rounded-xl bg-[#14B8A6]/15 flex items-center justify-center text-[#14B8A6]">
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-mono font-bold text-[#14B8A6]">
                          {isActivated ? "✓ Activated" : "Available"}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] font-mono font-bold text-[#14B8A6] block">
                          {ind.modelName}
                        </span>
                        <h3 className="text-sm font-bold text-[#F1F5F9]">
                          {ind.industry}
                        </h3>
                      </div>

                      <p className="text-xs text-[#F1F5F9]/75 leading-relaxed line-clamp-3">
                        {ind.summary}
                      </p>
                    </div>

                    <div className="pt-2.5 border-t border-[#F1F5F9]/10 flex items-center justify-between text-[11px] font-mono">
                      <span className="font-bold text-[#14B8A6]">
                        {ind.accuracyScore}
                      </span>
                      <span className="text-[#F1F5F9]/65">
                        {ind.avgLatency} latency
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right 5 Columns: Selected Industry Model Configuration & Deployment Screen */}
            <div className="lg:col-span-5 p-6 rounded-3xl glass-panel border-2 border-[#14B8A6] space-y-5 sticky top-24">
              <div className="flex items-start justify-between gap-3 border-b border-[#F1F5F9]/12 pb-4">
                <div>
                  <span className="text-[11px] font-mono font-bold text-[#14B8A6] uppercase">
                    Selected Vertical Model
                  </span>
                  <h3 className="text-xl font-bold text-[#F1F5F9] mt-0.5">
                    {selectedIndustry.industry}
                  </h3>
                  <code className="text-xs font-mono text-[#14B8A6]">
                    Model ID: {selectedIndustry.modelId}
                  </code>
                </div>
                <button
                  onClick={() =>
                    handleToggleIndustryActivation(selectedIndustry.id)
                  }
                  className="codos-cta-btn px-3.5 py-1.5 rounded-xl bg-[#14B8A6] text-[#0F172A] text-xs font-bold cursor-pointer"
                >
                  {activatedIndustryIds.includes(selectedIndustry.id)
                    ? "Active in Console"
                    : "Activate Model"}
                </button>
              </div>

              <p className="text-xs text-[#F1F5F9]/80 leading-relaxed">
                {selectedIndustry.summary}
              </p>

              {/* Compliance & Guardrail Badges */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#F1F5F9]/65 block">
                  Compliance &amp; Security Guardrails
                </span>
                <div className="flex flex-wrap gap-2">
                  {selectedIndustry.compliance.map((comp) => (
                    <span
                      key={comp}
                      className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold px-2.5 py-1 rounded-lg border border-[#F1F5F9]/15 text-[#14B8A6]"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>{comp}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Domain Use Cases */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#F1F5F9]/65 block">
                  Pre-Configured Industry Workflows
                </span>
                <ul className="space-y-2 text-xs text-[#F1F5F9]/85">
                  {selectedIndustry.useCases.map((uc, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-[#14B8A6] flex-shrink-0 mt-0.5" />
                      <span>{uc}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Sample Industry Prompt Preview */}
              <div className="p-3.5 rounded-xl bg-black/40 border border-[#F1F5F9]/12 space-y-1.5">
                <span className="text-[10px] font-mono font-bold uppercase text-[#14B8A6] block">
                  Sample Domain Prompt
                </span>
                <p className="text-xs font-mono text-[#F1F5F9]/90 leading-relaxed">
                  &quot;{selectedIndustry.samplePrompt}&quot;
                </p>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => handleOpenIndustryInChat(selectedIndustry)}
                  className="codos-cta-btn py-2.5 px-4 rounded-xl bg-[#14B8A6] text-[#0F172A] text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Test in AI Chatbot</span>
                </button>

                <button
                  onClick={() => {
                    setBaseTrainingModel(selectedIndustry.modelName);
                    setCustomModelName(`${selectedIndustry.modelId}-custom-v1`);
                    setSubView("training");
                  }}
                  className="codos-cta-btn py-2.5 px-4 rounded-xl bg-[#14B8A6] text-[#0F172A] text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Train on Custom Docs</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SCREEN 3: GENERAL AI CHATBOT INTERFACE
         ===================================================================== */}
      {subView === "chatbot" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch animate-in fade-in duration-150">
          {/* Left 4 Columns: Chatbot Model, Persona & RAG Settings */}
          <div className="lg:col-span-4 p-5 rounded-3xl glass-panel border border-[#F1F5F9]/12 flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#F1F5F9]/10 pb-3">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#14B8A6]" />
                  <h2 className="text-sm font-bold text-[#F1F5F9]">
                    Chatbot Configuration
                  </h2>
                </div>
                <button
                  onClick={() =>
                    setMessages([
                      {
                        id: `msg-reset-${Date.now()}`,
                        role: "assistant",
                        content: `Conversation cleared. Active model: **${chatModel}**. How can I assist you?`,
                        model: chatModel,
                        latency: "42ms",
                        tokens: 24,
                        ragGrounded: useRagContext,
                        timestamp: "Just now",
                      },
                    ])
                  }
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#14B8A6] hover:opacity-80 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Chat</span>
                </button>
              </div>

              {/* Active Model Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#F1F5F9]/80 block">
                  Active SkyBeak / Industry Model
                </label>
                <select
                  value={chatModel}
                  onChange={(e) => setChatModel(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F172A] border border-[#F1F5F9]/15 text-xs font-semibold text-[#F1F5F9] outline-none"
                >
                  <optgroup label="SkyBeak Native & Custom Models">
                    {models.map((m) => (
                      <option key={m.id} value={m.name}>
                        {m.name} ({m.latency})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Industry-Specific Models">
                    {INDUSTRY_MODELS.map((ind) => (
                      <option key={ind.id} value={ind.modelName}>
                        {ind.modelName} — {ind.industry}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* System Instructions */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#F1F5F9]/80 block">
                  System Instructions / Persona
                </label>
                <textarea
                  rows={3}
                  value={chatSystemPrompt}
                  onChange={(e) => setChatSystemPrompt(e.target.value)}
                  className="w-full p-3 rounded-xl bg-black/40 border border-[#F1F5F9]/15 text-xs text-[#F1F5F9] outline-none leading-relaxed"
                />
              </div>

              {/* Temperature Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#F1F5F9]/80">
                    Temperature
                  </span>
                  <span className="font-mono font-bold text-[#14B8A6]">
                    {chatTemperature.toFixed(1)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={chatTemperature}
                  onChange={(e) =>
                    setChatTemperature(parseFloat(e.target.value))
                  }
                  className="w-full accent-[#14B8A6] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-[#F1F5F9]/55">
                  <span>0.0Deterministic</span>
                  <span>0.5 Balanced</span>
                  <span>1.0 Creative</span>
                </div>
              </div>

              {/* RAG Document Grounding Toggle */}
              <div className="p-3.5 rounded-2xl bg-black/40 border border-[#F1F5F9]/12 flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-[#F1F5F9] block">
                    RAG Document Grounding
                  </span>
                  <span className="text-[10px] text-[#14B8A6] font-mono">
                    {trainingDocs.length} uploaded knowledge files active
                  </span>
                </div>
                <button
                  onClick={() => setUseRagContext(!useRagContext)}
                  className="codos-cta-btn px-3 py-1 rounded-lg bg-[#14B8A6] text-[#0F172A] text-[11px] font-bold cursor-pointer"
                >
                  {useRagContext ? "Enabled" : "Disabled"}
                </button>
              </div>
            </div>

            {/* Quick Prompt Starters */}
            <div className="space-y-2 pt-3 border-t border-[#F1F5F9]/10">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#F1F5F9]/60 block">
                Quick Prompt Starters
              </span>
              <div className="space-y-1.5">
                {[
                  "Generate a Call Colleague outbound script for VIP renewal",
                  "Write a TypeScript cURL wrapper for Thumbs Up API key rotation",
                  "Summarize our uploaded SLA playbook & refund policy",
                ].map((starter, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendChatMessage(starter)}
                    className="w-full text-left p-2.5 rounded-xl bg-black/40 hover:border-[#14B8A6]/50 border border-[#F1F5F9]/10 text-[11px] text-[#F1F5F9]/85 transition-all cursor-pointer truncate"
                  >
                    → {starter}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right 8 Columns: Interactive Chat Conversation Thread & Input */}
          <div className="lg:col-span-8 rounded-3xl glass-panel border border-[#F1F5F9]/15 flex flex-col justify-between overflow-hidden min-h-[540px] max-h-[640px]">
            {/* Chat Header */}
            <div className="px-5 py-3.5 border-b border-[#F1F5F9]/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Bot className="w-5 h-5 text-[#14B8A6]" />
                <div>
                  <h3 className="text-sm font-bold text-[#F1F5F9]">
                    {chatModel}
                  </h3>
                  <span className="text-[10px] font-mono text-[#14B8A6]">
                    ● Streaming Ready •{" "}
                    {useRagContext
                      ? `Grounded on ${trainingDocs.length} Custom Docs`
                      : "Standard Inference"}
                  </span>
                </div>
              </div>
              <span className="text-[11px] font-mono text-[#F1F5F9]/60">
                128k Context Window
              </span>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {messages.map((msg) => {
                const isUser = msg.role === "user";
                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3 ${
                      isUser ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                        isUser
                          ? isLightTheme
                            ? "bg-[#14213D] !text-[#FFFFFF]"
                            : "bg-[#14B8A6] text-[#0F172A]"
                          : "bg-black/40 border border-[#F1F5F9]/15 text-[#14B8A6]"
                      }`}
                    >
                      {isUser ? (
                        <User className="w-4 h-4" />
                      ) : (
                        <Bot className="w-4 h-4" />
                      )}
                    </div>

                    <div
                      className={`max-w-[82%] rounded-2xl p-4 space-y-2 border ${
                        isUser
                          ? "bg-[#14B8A6]/15 border-[#14B8A6]/35 text-[#F1F5F9]"
                          : "bg-black/40 border-[#F1F5F9]/12 text-[#F1F5F9]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4 text-[10px] font-mono">
                        <span className="font-bold text-[#14B8A6]">
                          {isUser ? "You (Via Codos Enterprise)" : msg.model}
                        </span>
                        <span className="text-[#F1F5F9]/55">
                          {msg.timestamp}
                        </span>
                      </div>

                      <div className="text-xs sm:text-[13px] leading-relaxed whitespace-pre-line text-[#F1F5F9]">
                        {msg.content}
                      </div>

                      {!isUser && (
                        <div className="pt-2 border-t border-[#F1F5F9]/10 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-[#F1F5F9]/60">
                          <div className="flex items-center gap-3">
                            {msg.latency && (
                              <span className="text-[#14B8A6] font-semibold">
                                ⚡ {msg.latency}
                              </span>
                            )}
                            {msg.tokens && <span>{msg.tokens} tokens</span>}
                            {msg.ragGrounded && (
                              <span className="text-[#14B8A6]">
                                ✓ RAG Verified
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(msg.content);
                              setCopiedMsgId(msg.id);
                              setTimeout(() => setCopiedMsgId(null), 2000);
                            }}
                            className="inline-flex items-center gap-1 hover:text-[#14B8A6] cursor-pointer"
                          >
                            {copiedMsgId === msg.id ? (
                              <Check className="w-3 h-3 text-[#14B8A6]" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            <span>
                              {copiedMsgId === msg.id ? "Copied" : "Copy"}
                            </span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {isBotTyping && (
                <div className="flex items-center gap-2 text-xs font-mono text-[#14B8A6] pl-2">
                  <Sparkles className="w-4 h-4 animate-spin" />
                  <span>{chatModel} is synthesizing response...</span>
                </div>
              )}
            </div>

            {/* Chat Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendChatMessage();
              }}
              className="p-4 border-t border-[#F1F5F9]/10 flex items-center gap-3"
            >
              <input
                type="text"
                placeholder={`Message ${chatModel} (or ask about your ${trainingDocs.length} uploaded training docs)...`}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-black/40 border border-[#F1F5F9]/15 text-xs text-[#F1F5F9] outline-none"
              />
              <button
                type="submit"
                disabled={isBotTyping}
                className="codos-cta-btn px-5 py-2.5 rounded-xl bg-[#14B8A6] text-[#0F172A] text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                <span>Send</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          SCREEN 4: CUSTOM AI MODEL TRAINING UI WITH DRAG-AND-DROP UPLOAD
         ===================================================================== */}
      {subView === "training" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in fade-in duration-150">
          {/* Left 7 Columns: Drag-and-Drop Document Upload & Dataset Queue */}
          <div className="lg:col-span-7 space-y-5">
            {/* Drag-and-Drop Upload Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-8 rounded-3xl glass-panel border-2 border-dashed transition-all cursor-pointer text-center space-y-3 ${
                isDraggingOver
                  ? "border-[#14B8A6] bg-[#14B8A6]/10 scale-[1.01]"
                  : "border-[#F1F5F9]/25 hover:border-[#14B8A6]"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.jsonl,.json,.csv,.md,.txt,.yaml"
                onChange={(e) => processUploadedFiles(e.target.files)}
                className="hidden"
              />

              <div className="w-12 h-12 rounded-2xl bg-[#14B8A6]/15 text-[#14B8A6] flex items-center justify-center mx-auto">
                <UploadCloud className="w-6 h-6" />
              </div>

              <div className="space-y-1">
                <h2 className="text-base font-bold text-[#F1F5F9]">
                  Drag &amp; Drop Training Documents or Click to Browse
                </h2>
                <p className="text-xs text-[#F1F5F9]/70 max-w-md mx-auto">
                  Upload enterprise knowledge files, call transcripts, or instruction datasets (<code className="font-mono">PDF</code>, <code className="font-mono">JSONL</code>, <code className="font-mono">CSV</code>, <code className="font-mono">DOCX</code>, <code className="font-mono">MD</code>, <code className="font-mono">YAML</code>).
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="codos-cta-btn px-4 py-2 rounded-xl bg-[#14B8A6] text-[#0F172A] text-xs font-bold cursor-pointer"
                >
                  Select Files from Computer
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddSampleDataset();
                  }}
                  className="px-4 py-2 rounded-xl glass-panel border border-[#F1F5F9]/15 text-xs font-bold text-[#F1F5F9] hover:border-[#14B8A6] cursor-pointer"
                >
                  + Add Sample JSONL Corpus
                </button>
              </div>
            </div>

            {/* Uploaded Training Corpus List */}
            <div className="rounded-2xl glass-panel border border-[#F1F5F9]/12 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#F1F5F9]/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-[#14B8A6]" />
                  <h3 className="text-sm font-bold text-[#F1F5F9]">
                    Uploaded Training &amp; RAG Dataset Corpus ({trainingDocs.length} files)
                  </h3>
                </div>
                <span className="text-xs font-mono text-[#14B8A6] font-semibold">
                  Auto-Chunked ({chunkSize} tok/chunk)
                </span>
              </div>

              <div className="divide-y divide-[#F1F5F9]/10">
                {trainingDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-4 flex items-center justify-between gap-4 hover:bg-[#14B8A6]/5 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-[#14B8A6]/15 text-[#14B8A6] flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#F1F5F9] truncate">
                          {doc.name}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-mono text-[#F1F5F9]/65 mt-0.5">
                          <span className="font-bold text-[#14B8A6]">
                            {doc.format}
                          </span>
                          <span>•</span>
                          <span>{doc.size}</span>
                          <span>•</span>
                          <span>{doc.tokens}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-[10px] font-mono font-bold text-[#14B8A6] hidden sm:inline">
                        ✓ {doc.status}
                      </span>
                      <button
                        onClick={() => handleRemoveDoc(doc.id)}
                        className="p-1.5 rounded-lg hover:bg-red-500/15 text-red-500 transition-colors cursor-pointer"
                        title="Remove document"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right 5 Columns: Fine-Tuning Hyperparameters & Live Training Runner */}
          <div className="lg:col-span-5 p-6 rounded-3xl glass-panel border border-[#F1F5F9]/15 space-y-5">
            <div className="border-b border-[#F1F5F9]/10 pb-3">
              <span className="text-[10px] font-mono font-bold uppercase text-[#14B8A6] block">
                SkyBeak Training Cluster • 8x H100 SXM5
              </span>
              <h3 className="text-lg font-bold text-[#F1F5F9] mt-0.5">
                Custom Model Training Configuration
              </h3>
            </div>

            <div className="space-y-3.5">
              {/* Custom Model Output Name */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#F1F5F9]/80 block">
                  Custom Output Model Name
                </label>
                <input
                  type="text"
                  value={customModelName}
                  onChange={(e) => setCustomModelName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-[#F1F5F9]/15 text-xs font-mono text-[#F1F5F9] outline-none"
                />
              </div>

              {/* Base Foundation Model */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#F1F5F9]/80 block">
                  Base Foundation Model
                </label>
                <select
                  value={baseTrainingModel}
                  onChange={(e) => setBaseTrainingModel(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#0F172A] border border-[#F1F5F9]/15 text-xs text-[#F1F5F9] outline-none"
                >
                  <option value="SkyBeak-Pro-70B-Instruct">
                    SkyBeak-Pro-70B-Instruct (Recommended)
                  </option>
                  <option value="SkyBeak-Voice-Fast-8B">
                    SkyBeak-Voice-Fast-8B (Low-Latency Voice)
                  </option>
                  <option value="SkyBeak-Omni-Vision-34B">
                    SkyBeak-Omni-Vision-34B (Document &amp; OCR)
                  </option>
                  <option value="SkyBeak-Med-70B">
                    SkyBeak-Med-70B (Healthcare Vertical)
                  </option>
                  <option value="SkyBeak-FinQuant-34B">
                    SkyBeak-FinQuant-34B (FinTech Vertical)
                  </option>
                </select>
              </div>

              {/* Training Architecture */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#F1F5F9]/80 block">
                  Fine-Tuning &amp; Alignment Method
                </label>
                <select
                  value={trainingMethod}
                  onChange={(e) => setTrainingMethod(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#0F172A] border border-[#F1F5F9]/15 text-xs text-[#F1F5F9] outline-none"
                >
                  <option>LoRA Fine-Tuning + RAG Hybrid</option>
                  <option>QLoRA 4-Bit Low-Rank Adapter</option>
                  <option>Full Supervised Fine-Tuning (SFT)</option>
                  <option>Direct Preference Optimization (DPO)</option>
                </select>
              </div>

              {/* Hyperparameters Grid */}
              <div className="grid grid-cols-3 gap-2.5 pt-1">
                <div className="p-2.5 rounded-xl bg-black/40 border border-[#F1F5F9]/10">
                  <label className="text-[10px] text-[#F1F5F9]/60 block">
                    Epochs
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={epochs}
                    onChange={(e) => setEpochs(Number(e.target.value))}
                    className="w-full bg-transparent text-xs font-mono font-bold text-[#F1F5F9] outline-none mt-0.5"
                  />
                </div>
                <div className="p-2.5 rounded-xl bg-black/40 border border-[#F1F5F9]/10">
                  <label className="text-[10px] text-[#F1F5F9]/60 block">
                    Learning Rate
                  </label>
                  <input
                    type="text"
                    value={learningRate}
                    onChange={(e) => setLearningRate(e.target.value)}
                    className="w-full bg-transparent text-xs font-mono font-bold text-[#14B8A6] outline-none mt-0.5"
                  />
                </div>
                <div className="p-2.5 rounded-xl bg-black/40 border border-[#F1F5F9]/10">
                  <label className="text-[10px] text-[#F1F5F9]/60 block">
                    Chunk Tokens
                  </label>
                  <input
                    type="number"
                    step={128}
                    value={chunkSize}
                    onChange={(e) => setChunkSize(Number(e.target.value))}
                    className="w-full bg-transparent text-xs font-mono font-bold text-[#F1F5F9] outline-none mt-0.5"
                  />
                </div>
              </div>
            </div>

            {/* Training Progress / Completion Status */}
            {(isTraining || trainingCompleted) && (
              <div className="p-4 rounded-2xl bg-black/40 border border-[#14B8A6]/40 space-y-2.5 animate-in fade-in">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-[#F1F5F9]">
                    {isTraining
                      ? `Training ${customModelName}...`
                      : `✓ ${customModelName} Deployed!`}
                  </span>
                  <span className="font-bold text-[#14B8A6]">
                    {trainingProgress}%
                  </span>
                </div>

                <div className="w-full h-2 rounded-full bg-[#F1F5F9]/15 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      isLightTheme ? "bg-[#14213D]" : "bg-[#14B8A6]"
                    }`}
                    style={{ width: `${trainingProgress}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono text-[#F1F5F9]/65">
                  <span>Epoch {epochs}/{epochs} • Loss: 0.284</span>
                  <span>Val Accuracy: 99.1%</span>
                </div>
              </div>
            )}

            {/* Launch Training Button */}
            <div className="space-y-2.5 pt-1">
              <button
                onClick={handleStartTraining}
                disabled={isTraining || trainingDocs.length === 0}
                className="codos-cta-btn w-full py-3 rounded-xl bg-[#14B8A6] text-[#0F172A] text-xs font-bold flex items-center justify-center gap-2 shadow-lg cursor-pointer"
              >
                <Zap className="w-4 h-4" />
                <span>
                  {isTraining
                    ? "Running LoRA Fine-Tuning & Indexing..."
                    : `Start Custom Training (${trainingDocs.length} Docs)`}
                </span>
              </button>

              {trainingCompleted && (
                <button
                  onClick={() => setSubView("chatbot")}
                  className="w-full py-2.5 rounded-xl glass-panel border border-[#14B8A6] text-xs font-bold text-[#14B8A6] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Test {customModelName} in AI Chatbot →</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function generateSmartAssistantReply(
  prompt: string,
  modelName: string,
  ragEnabled: boolean,
  docCount: number
): string {
  const lower = prompt.toLowerCase();
  const ragPrefix = ragEnabled
    ? `[Grounded on ${docCount} uploaded knowledge documents via ${modelName}]\n\n`
    : `[Synthesized by ${modelName}]\n\n`;

  if (lower.includes("soap") || lower.includes("icd") || lower.includes("migraine")) {
    return `${ragPrefix}**Clinical SOAP Note & ICD-10 Coding Summary:**\n• **Subjective:** Patient presents with acute unilateral throbbing headache, photophobia, and nausea lasting 14 hours.\n• **Assessment:** Acute intractable migraine without aura.\n• **Recommended ICD-10 Code:** \`G43.019\` (Migraine without aura, intractable, without status migrainosus).\n• **Call Colleague Action:** Scheduled follow-up neurology tele-consult on Trunk #420-CODO.`;
  }
  if (lower.includes("script") || lower.includes("call colleague") || lower.includes("voice")) {
    return `${ragPrefix}**Call Colleague Outbound Voice Script (Eleanor Persona • 72ms Latency):**\n\n"Hello! This is Eleanor calling from Via Codos Enterprise. I noticed your team's API & Voice bundle is approaching renewal—I've pre-applied your 20% unified loyalty credit so your Call Colleague trunks and SkyBeak LLM quotas continue uninterrupted. Would you like me to send the consolidated invoice confirmation now?"`;
  }
  if (lower.includes("curl") || lower.includes("typescript") || lower.includes("webhook") || lower.includes("key")) {
    return `${ragPrefix}**Thumbs Up API Gateway — Key Rotation & Webhook Verification:**\n\n1. **Endpoint:** \`POST https://api.viacodos.com/v1/gateway/keys/rotate\`\n2. **Scope Required:** \`api:admin\`\n3. **Execution:** Zero-downtime rotation propagates across all 38 edge PoPs in \`11ms\` while preserving active Call Colleague WebRTC streams.`;
  }
  return `${ragPrefix}Here is your structured resolution generated by **${modelName}**:\n\n1. **Unified Routing:** Prompt analyzed with semantic caching enabled (saving ~42% token expenditure).\n2. **Cross-Service Sync:** Ready to trigger **Call Colleague** voice dispatch or **Thumbs Up API** webhook notifications from your single master account.\n3. **Next Step:** You can fine-tune this behavior further in the **Custom Model Training** tab by dragging and dropping additional domain documents.`;
}

