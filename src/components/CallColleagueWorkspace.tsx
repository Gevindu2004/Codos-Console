"use client";

import React, { useState, useRef } from "react";
import {
  PhoneCall,
  PhoneForwarded,
  Zap,
  UploadCloud,
  FileAudio,
  FileText,
  Sliders,
  Play,
  Check,
  Copy,
  KeyRound,
  Plus,
  Trash2,
  Sparkles,
  Code2,
  ShieldCheck,
  Mic,
  Volume2,
  Activity,
  Webhook,
  RefreshCw,
} from "lucide-react";

export type CallColleagueSubView = "all" | "simulator" | "training" | "api";

interface CallColleagueAgent {
  id: string;
  name: string;
  persona: string;
  voiceEngine: string;
  handled: string;
  latency: string;
  csat: string;
  mosScore: string;
  status: "Active" | "Trained & Ready";
}

interface VoiceTrainingFile {
  id: string;
  name: string;
  type: "AUDIO" | "TRANSCRIPT" | "PLAYBOOK";
  size: string;
  durationOrRows: string;
  status: "Diarized & Ready" | "Indexed";
}

interface ColleagueApiKey {
  id: string;
  name: string;
  colleagueId: string;
  colleagueName: string;
  keySecret: string;
  scopes: string[];
  webhookUrl: string;
  created: string;
}

interface CallColleagueWorkspaceProps {
  isLightTheme: boolean;
}

const INITIAL_COLLEAGUES: CallColleagueAgent[] = [
  {
    id: "col_inbound_01",
    name: "Colleague #01 - Inbound Reception",
    persona: "Eleanor (Executive British)",
    voiceEngine: "Codos-Sonic-Voice-v3",
    handled: "1,420 calls",
    latency: "72ms",
    csat: "99.2%",
    mosScore: "4.92 MOS",
    status: "Active",
  },
  {
    id: "col_vip_02",
    name: "Colleague #02 - VIP Incident Response",
    persona: "Marcus (Technical US)",
    voiceEngine: "Codos-Sonic-Voice-v3",
    handled: "348 calls",
    latency: "79ms",
    csat: "98.8%",
    mosScore: "4.89 MOS",
    status: "Active",
  },
];

const INITIAL_TRAINING_FILES: VoiceTrainingFile[] = [
  {
    id: "vf-1",
    name: "eleanor_reference_voice_48khz.wav",
    type: "AUDIO",
    size: "18.4 MB",
    durationOrRows: "04m 12s clean speech",
    status: "Diarized & Ready",
  },
  {
    id: "vf-2",
    name: "enterprise_support_call_recordings_q3.jsonl",
    type: "TRANSCRIPT",
    size: "9.2 MB",
    durationOrRows: "3,450 diarized turns",
    status: "Indexed",
  },
  {
    id: "vf-3",
    name: "vip_objection_handling_and_sip_escalation.pdf",
    type: "PLAYBOOK",
    size: "2.6 MB",
    durationOrRows: "42 SOP rules",
    status: "Indexed",
  },
];

const ENV_API_BASE_URL =
  process.env.NEXT_PUBLIC_CODOS_API_BASE_URL || "https://api.viacodos.com";
const ENV_STREAM_WSS_URL =
  process.env.NEXT_PUBLIC_CODOS_STREAM_WSS_URL ||
  "wss://stream.viacodos.com/v1";
const ENV_CC_WEBHOOK_URL =
  process.env.NEXT_PUBLIC_CALL_COLLEAGUE_WEBHOOK_URL ||
  "https://api.viacodos.com/v1/webhooks/voice-events";

const CODE_KEYWORDS = new Set([
  "import",
  "from",
  "const",
  "let",
  "var",
  "new",
  "async",
  "function",
  "await",
  "return",
  "package",
  "func",
  "curl",
  "POST",
  "GET",
  "true",
  "false",
]);

const CODE_FUNCTIONS_AND_TYPES = new Set([
  "CodosVoiceClient",
  "CallColleagueClient",
  "NewColleagueClient",
  "DispatchRequest",
  "dispatch",
  "Dispatch",
  "log",
  "print",
  "Println",
  "getenv",
  "Getenv",
  "Background",
  "main",
]);

const CODE_PROPERTIES = new Set([
  "apiKey",
  "api_key",
  "colleagueId",
  "colleague_id",
  "ColleagueID",
  "scopes",
  "recipientPhone",
  "recipient_phone",
  "RecipientPhone",
  "bargeInSensitivityMs",
  "barge_in_ms",
  "speakingRate",
  "speaking_rate",
  "webhookUrl",
  "webhook_url",
  "WebhookURL",
  "CALL_COLLEAGUE_API_KEY",
  "sessionId",
  "SessionID",
  "edgeLatencyMs",
  "calls",
  "process",
  "env",
  "os",
  "context",
  "fmt",
  "voice",
]);

function highlightCodeSegment(
  segment: string,
  keyPrefix: string
): React.ReactNode[] {
  const tokenRegex =
    /("[^"]*"|'[^']*'|https?:\/\/[^\s"\\]+|-[XHd]\b|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][A-Za-z0-9_]*\b|[^\s"A-Za-z0-9_]+|\s+)/g;
  const parts = segment.match(tokenRegex) || [segment];

  return parts.map((token, idx) => {
    const key = `${keyPrefix}-${idx}`;
    if (
      (token.startsWith('"') && token.endsWith('"')) ||
      (token.startsWith("'") && token.endsWith("'")) ||
      token.startsWith("http://") ||
      token.startsWith("https://")
    ) {
      return (
        <span key={key} className="tok-string">
          {token}
        </span>
      );
    }
    if (
      token === "-X" ||
      token === "-H" ||
      token === "-d" ||
      CODE_KEYWORDS.has(token)
    ) {
      return (
        <span key={key} className="tok-keyword">
          {token}
        </span>
      );
    }
    if (CODE_FUNCTIONS_AND_TYPES.has(token)) {
      return (
        <span key={key} className="tok-fn">
          {token}
        </span>
      );
    }
    if (CODE_PROPERTIES.has(token)) {
      return (
        <span key={key} className="tok-prop">
          {token}
        </span>
      );
    }
    if (/^\d+(\.\d+)?$/.test(token)) {
      return (
        <span key={key} className="tok-num">
          {token}
        </span>
      );
    }
    if (/^[A-Za-z_]/.test(token)) {
      return (
        <span key={key} className="tok-var">
          {token}
        </span>
      );
    }
    if (/^\s+$/.test(token)) {
      return token;
    }
    return (
      <span key={key} className="tok-punct">
        {token}
      </span>
    );
  });
}

function renderHighlightedCode(code: string): React.ReactNode {
  const lines = code.split("\n");
  return lines.map((line, lineIdx) => {
    const trimmed = line.trimStart();
    let codePart = line;
    let commentPart = "";

    if (trimmed.startsWith("//") || trimmed.startsWith("#")) {
      const commentStart = line.indexOf(trimmed[0]);
      codePart = line.slice(0, commentStart);
      commentPart = line.slice(commentStart);
    } else {
      const inlineSlash = line.indexOf(" //");
      if (inlineSlash !== -1) {
        codePart = line.slice(0, inlineSlash);
        commentPart = line.slice(inlineSlash);
      }
    }

    return (
      <div
        key={lineIdx}
        className="flex items-baseline hover:bg-[#14B8A6]/[0.06] px-1 rounded transition-colors min-h-[20px]"
      >
        <span className="pr-3.5 select-none text-right text-[10px] opacity-40 font-mono w-7 shrink-0">
          {String(lineIdx + 1).padStart(2, "0")}
        </span>
        <span className="whitespace-pre font-mono">
          {codePart ? highlightCodeSegment(codePart, `cc-${lineIdx}`) : null}
          {commentPart ? (
            <span className="tok-comment">{commentPart}</span>
          ) : null}
          {line.length === 0 ? " " : null}
        </span>
      </div>
    );
  });
}

/**
 * Masks an API key so only the first couple of characters are visible
 * and the remaining characters are shown as asterisks (*).
 */
const maskApiKey = (fullKey: string): string => {
  const visiblePrefix = fullKey.slice(0, 3);
  const starCount = Math.max(10, fullKey.length - 3);
  return `${visiblePrefix}${"*".repeat(starCount)}`;
};

const INITIAL_COLLEAGUE_KEYS: ColleagueApiKey[] = [
  {
    id: "cc_key_1",
    name: "API Key 1 — Inbound Reception SIP & Dispatch",
    colleagueId: "col_inbound_01",
    colleagueName: "Colleague #01 - Inbound Reception",
    keySecret: "API KEY 1",
    scopes: ["voice:outbound-dispatch", "voice:inbound-sip", "voice:webrtc-stream"],
    webhookUrl: ENV_CC_WEBHOOK_URL,
    created: "Loaded from .env • Primary",
  },
  {
    id: "cc_key_2",
    name: "API Key 2 — VIP Incident Escalation Trigger",
    colleagueId: "col_vip_02",
    colleagueName: "Colleague #02 - VIP Incident Response",
    keySecret: "API KEY 2",
    scopes: ["voice:outbound-dispatch", "voice:live-transfer"],
    webhookUrl:
      process.env.NEXT_PUBLIC_CALL_COLLEAGUE_VIP_WEBHOOK_URL ||
      "https://incident.enterprise.io/hooks/codos-call",
    created: "Loaded from .env",
  },
];

export const CallColleagueWorkspace: React.FC<CallColleagueWorkspaceProps> = ({
  isLightTheme,
}) => {
  const [subView, setSubView] = useState<CallColleagueSubView>("all");

  // Colleagues list state
  const [colleagues, setColleagues] =
    useState<CallColleagueAgent[]>(INITIAL_COLLEAGUES);

  // Live Test Call Simulator state
  const [dialerNumber, setDialerNumber] = useState("+1 (555) 234-8900");
  const [selectedDialerColleagueId, setSelectedDialerColleagueId] =
    useState<string>("col_inbound_01");
  const [isCalling, setIsCalling] = useState(false);
  const [callStatus, setCallStatus] = useState<string | null>(null);

  // Call Colleague Training state
  const [trainingColleagueName, setTrainingColleagueName] = useState(
    "Colleague #03 - Billing & Renewal Specialist"
  );
  const [baseVoiceEngine, setBaseVoiceEngine] = useState(
    "Codos-Sonic-Voice-v3 (Sub-70ms Neural Speech)"
  );
  const [voiceClonePreset, setVoiceClonePreset] = useState(
    "Eleanor - Executive British (Warm & Authoritative)"
  );
  const [speakingRate, setSpeakingRate] = useState(1.05);
  const [bargeInMs, setBargeInMs] = useState(65);
  const [callPlaybookPrompt, setCallPlaybookPrompt] = useState(
    "Greet the caller by name, verify organization ID, resolve invoice or subscription renewal inquiries autonomously, and perform a warm SIP transfer to Tier-2 human engineering if hardware outage is reported."
  );
  const [trainingFiles, setTrainingFiles] = useState<VoiceTrainingFile[]>(
    INITIAL_TRAINING_FILES
  );
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isTrainingVoice, setIsTrainingVoice] = useState(false);
  const [voiceTrainProgress, setVoiceTrainProgress] = useState(100);
  const [voiceTrainBadge, setVoiceTrainBadge] = useState<string | null>(
    "Acoustic Checkpoint v3.4 Ready • 68ms Turn Latency • 4.94 MOS"
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Call Colleague API Generation state
  const [colleagueApiKeys, setColleagueApiKeys] = useState<ColleagueApiKey[]>(
    INITIAL_COLLEAGUE_KEYS
  );
  const [selectedApiColleagueId, setSelectedApiColleagueId] =
    useState<string>("col_inbound_01");
  const [newApiKeyName, setNewApiKeyName] = useState(
    "Production Call Colleague Dispatch Key"
  );
  const [webhookUrl, setWebhookUrl] = useState(
    "https://api.enterprise.com/webhooks/call-colleague"
  );
  const [selectedScopes, setSelectedScopes] = useState<string[]>([
    "voice:outbound-dispatch",
    "voice:inbound-sip",
    "voice:webrtc-stream",
    "voice:transcripts-webhook",
  ]);
  const [copiedTextId, setCopiedTextId] = useState<string | null>(null);
  const [sdkLang, setSdkLang] = useState<"TS" | "PY" | "CURL" | "GO">("TS");
  const [lastGeneratedKey, setLastGeneratedKey] = useState<string>(
    INITIAL_COLLEAGUE_KEYS[0].keySecret
  );

  // Handlers
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTextId(id);
    setTimeout(() => setCopiedTextId(null), 2000);
  };

  const handleTriggerTestCall = () => {
    const chosenColleague =
      colleagues.find((c) => c.id === selectedDialerColleagueId) ||
      colleagues[0];
    setIsCalling(true);
    setCallStatus(`Initiating SIP trunk handshake to ${dialerNumber}...`);
    setTimeout(() => {
      setCallStatus(
        `Connected (68ms RTT) • ${chosenColleague.name} speaking in real-time duplex mode...`
      );
    }, 900);
    setTimeout(() => {
      setIsCalling(false);
      setCallStatus(
        `Call completed successfully • Sentiment: Positive (99.4% CSAT) • Transcript & webhook dispatched.`
      );
    }, 3000);
  };

  const addFilesToTrainingCorpus = (fileNames: string[]) => {
    const added: VoiceTrainingFile[] = fileNames.map((name, idx) => {
      const lower = name.toLowerCase();
      const isAudio =
        lower.endsWith(".wav") ||
        lower.endsWith(".mp3") ||
        lower.endsWith(".flac");
      const isTranscript =
        lower.endsWith(".jsonl") ||
        lower.endsWith(".json") ||
        lower.endsWith(".csv");
      return {
        id: `vf-${Date.now()}-${idx}`,
        name,
        type: isAudio ? "AUDIO" : isTranscript ? "TRANSCRIPT" : "PLAYBOOK",
        size: isAudio ? "14.2 MB" : "3.1 MB",
        durationOrRows: isAudio ? "03m 25s neural audio" : "1,280 dialogue turns",
        status: isAudio ? "Diarized & Ready" : "Indexed",
      };
    });
    setTrainingFiles((prev) => [...added, ...prev]);
  };

  const handleDropFiles = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const names = Array.from(e.dataTransfer.files).map((f) => f.name);
      addFilesToTrainingCorpus(names);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const names = Array.from(e.target.files).map((f) => f.name);
      addFilesToTrainingCorpus(names);
    }
  };

  const handleStartVoiceTraining = () => {
    if (isTrainingVoice) return;
    setIsTrainingVoice(true);
    setVoiceTrainProgress(12);
    setVoiceTrainBadge(
      "Extracting acoustic speaker embeddings & indexing call playbooks..."
    );

    setTimeout(() => {
      setVoiceTrainProgress(48);
      setVoiceTrainBadge(
        "Epoch 2/4 • Fine-tuning prosody, barge-in VAD (65ms) & turn-taking..."
      );
    }, 800);

    setTimeout(() => {
      setVoiceTrainProgress(84);
      setVoiceTrainBadge(
        "Epoch 4/4 • Optimizing WebRTC & SIP low-latency audio quantizer..."
      );
    }, 1700);

    setTimeout(() => {
      setVoiceTrainProgress(100);
      setIsTrainingVoice(false);
      const newId = `col_custom_${Date.now().toString().slice(-4)}`;
      const shortPersona = voiceClonePreset.split(" - ")[0] || "Custom Voice";
      const newAgent: CallColleagueAgent = {
        id: newId,
        name:
          trainingColleagueName.trim() ||
          `Colleague #0${colleagues.length + 1} - Custom Trained Agent`,
        persona: `${shortPersona} (${speakingRate}x • ${bargeInMs}ms VAD)`,
        voiceEngine: baseVoiceEngine.split(" ")[0],
        handled: "0 calls (Just Trained)",
        latency: `${bargeInMs}ms`,
        csat: "99.5% Est.",
        mosScore: "4.95 MOS",
        status: "Trained & Ready",
      };
      setColleagues((prev) => [newAgent, ...prev]);
      setSelectedDialerColleagueId(newId);
      setSelectedApiColleagueId(newId);
      setVoiceTrainBadge(
        `Trained & Deployed "${newAgent.name}" • Endpoint ID: ${newId}`
      );
    }, 2600);
  };

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  const handleGenerateColleagueApi = (e: React.FormEvent) => {
    e.preventDefault();
    const targetColleague =
      colleagues.find((c) => c.id === selectedApiColleagueId) || colleagues[0];
    const nextKeyNumber = colleagueApiKeys.length + 1;
    const generatedFullKey = `API KEY ${nextKeyNumber}`;

    const newKeyEntry: ColleagueApiKey = {
      id: `cc_key_${Date.now()}`,
      name:
        newApiKeyName.trim() ||
        `API Key ${nextKeyNumber} — ${targetColleague.name}`,
      colleagueId: targetColleague.id,
      colleagueName: targetColleague.name,
      keySecret: generatedFullKey,
      scopes:
        selectedScopes.length > 0
          ? selectedScopes
          : ["voice:outbound-dispatch"],
      webhookUrl:
        webhookUrl.trim() || ENV_CC_WEBHOOK_URL,
      created: "Just now",
    };

    setColleagueApiKeys((prev) => [newKeyEntry, ...prev]);
    setLastGeneratedKey(generatedFullKey);
  };

  const activeApiColleague =
    colleagues.find((c) => c.id === selectedApiColleagueId) || colleagues[0];

  const getGeneratedCodeSnippet = () => {
    const colId = activeApiColleague.id;
    const colName = activeApiColleague.name;
    const scopesStr = selectedScopes.join(", ");

    if (sdkLang === "TS") {
      return `import { CodosVoiceClient } from "@viacodos/call-colleague-sdk";

// Provisioned for: ${colName} (Key loaded from .env)
const colleague = new CodosVoiceClient({
  apiKey: process.env.CALL_COLLEAGUE_API_KEY,
  colleagueId: "${colId}",
  scopes: [${selectedScopes.map((s) => `"${s}"`).join(", ")}],
});

const session = await colleague.calls.dispatch({
  recipientPhone: "${dialerNumber}",
  bargeInSensitivityMs: ${bargeInMs},
  speakingRate: ${speakingRate},
  webhookUrl: "${webhookUrl}",
});

console.log("Call Colleague Connected:", session.sessionId, session.edgeLatencyMs);`;
    }

    if (sdkLang === "PY") {
      return `import os
from viacodos import CallColleagueClient

# Provisioned for: ${colName} (Key loaded from .env)
client = CallColleagueClient(
    api_key=os.getenv("CALL_COLLEAGUE_API_KEY"),
    colleague_id="${colId}"
)

session = client.calls.dispatch(
    recipient_phone="${dialerNumber}",
    barge_in_ms=${bargeInMs},
    speaking_rate=${speakingRate},
    webhook_url="${webhookUrl}"
)
print(f"Dispatched {session.colleague_id} -> Session: {session.id}")`;
    }

    if (sdkLang === "CURL") {
      return `curl -X POST ${ENV_API_BASE_URL}/v1/voice/colleague/dispatch \\
  -H "Authorization: Bearer $CALL_COLLEAGUE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "colleague_id": "${colId}",
    "recipient_phone": "${dialerNumber}",
    "barge_in_ms": ${bargeInMs},
    "speaking_rate": ${speakingRate},
    "scopes": "${scopesStr}",
    "webhook_url": "${webhookUrl}"
  }'`;
    }

    return `package main

import (
    "context"
    "fmt"
    "os"
    "github.com/viacodos/codos-go/voice"
)

func main() {
    client := voice.NewColleagueClient(os.Getenv("CALL_COLLEAGUE_API_KEY"))
    res, _ := client.Dispatch(context.Background(), &voice.DispatchRequest{
        ColleagueID:    "${colId}",
        RecipientPhone: "${dialerNumber}",
        WebhookURL:     "${webhookUrl}",
    })
    fmt.Println("Call Colleague Active:", res.SessionID)
}`;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Top Studio Header & Sub-Navigation Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#F1F5F9]/10">
        <div>
          <div className="inline-flex items-center gap-2 text-[#14B8A6] text-xs font-semibold mb-1.5">
            <PhoneCall className="w-3.5 h-3.5" />
            <span>
              Telephony &amp; Conversational AI • Voice Training &amp; API Studio
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#F1F5F9]">
            Call Colleague Studio
          </h1>
          <p className="text-xs sm:text-sm text-[#F1F5F9]/75 mt-1">
            Simulate live SIP/WebRTC voice calls, train custom AI Call Colleague personas with voice &amp; script uploads, and generate scoped Call Colleague APIs.
          </p>
        </div>

        {/* Sub-Navigation Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            {
              id: "all" as const,
              label: "Full Studio",
              badge: "All",
              icon: PhoneCall,
            },
            {
              id: "simulator" as const,
              label: "Live Simulator",
              badge: "Dialer",
              icon: Zap,
            },
            {
              id: "training" as const,
              label: "Colleague Training",
              badge: "Train Voice",
              icon: UploadCloud,
            },
            {
              id: "api" as const,
              label: "API Generation",
              badge: "Voice API",
              icon: KeyRound,
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
          SECTION 1: LIVE TEST CALL SIMULATOR & ACTIVE CALL COLLEAGUES
         ===================================================================== */}
      {(subView === "all" || subView === "simulator") && (
        <div className="space-y-6">
          {/* Test Call Interactive Dialer */}
          <div className="p-6 rounded-2xl glass-panel border border-[#14B8A6]/35 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#F1F5F9] flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#14B8A6]" />
                <span>Live Test Call Simulator</span>
              </h2>
              <span className="text-xs font-mono font-semibold text-[#14B8A6]">
                WebRTC &amp; SIP Ready
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#F1F5F9]/75">
                  Recipient Phone Number
                </label>
                <input
                  type="text"
                  value={dialerNumber}
                  onChange={(e) => setDialerNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-[#F1F5F9]/15 text-xs font-mono text-[#F1F5F9] outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#F1F5F9]/75">
                  Trained Voice Colleague Persona
                </label>
                <select
                  value={selectedDialerColleagueId}
                  onChange={(e) => setSelectedDialerColleagueId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F172A] border border-[#F1F5F9]/15 text-xs text-[#F1F5F9] outline-none"
                >
                  {colleagues.map((col) => (
                    <option key={col.id} value={col.id}>
                      {col.name} — {col.persona}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleTriggerTestCall}
                  disabled={isCalling}
                  className="codos-cta-btn w-full py-2.5 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] text-[#0F172A] text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                >
                  <PhoneForwarded className="w-4 h-4" />
                  <span>
                    {isCalling ? "Dialing..." : "Simulate Outbound Call"}
                  </span>
                </button>
              </div>
            </div>

            {callStatus && (
              <div className="p-3 rounded-xl bg-black/40 border border-[#F1F5F9]/15 text-xs font-mono text-[#14B8A6] font-semibold flex items-center gap-2 animate-in fade-in">
                <span
                  className={`w-2 h-2 rounded-full animate-pulse ${
                    isLightTheme ? "bg-[#14213D]" : "bg-[#14B8A6]"
                  }`}
                />
                <span>{callStatus}</span>
              </div>
            )}
          </div>

          {/* Deployed Colleague List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#F1F5F9]">
                Active Call Colleagues ({colleagues.length})
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSubView("training")}
                  className="text-xs font-bold text-[#14B8A6] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>+ Train New Voice Colleague</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {colleagues.map((agent) => (
                <div
                  key={agent.id}
                  className="p-5 rounded-2xl glass-panel border border-[#F1F5F9]/12 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-[#14B8A6]/15 flex items-center justify-center text-[#14B8A6]">
                        <PhoneCall className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-[#F1F5F9]">
                          {agent.name}
                        </h3>
                        <p className="text-[10px] text-[#F1F5F9]/65">
                          {agent.persona} •{" "}
                          <span className="font-mono">{agent.id}</span>
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-[#14B8A6]">
                      {agent.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 pt-2 border-t border-[#F1F5F9]/10 text-[11px]">
                    <div>
                      <span className="text-[#F1F5F9]/60 block">
                        Calls Handled
                      </span>
                      <span className="font-bold text-[#F1F5F9]">
                        {agent.handled}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#F1F5F9]/60 block">
                        Avg Latency
                      </span>
                      <span className="font-bold text-[#14B8A6]">
                        {agent.latency}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#F1F5F9]/60 block">
                        CSAT Score
                      </span>
                      <span className="font-bold text-[#14B8A6]">
                        {agent.csat}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#F1F5F9]/60 block">
                        Voice Quality
                      </span>
                      <span className="font-bold text-[#F1F5F9]">
                        {agent.mosScore}
                      </span>
                    </div>
                  </div>

                  {/* Quick Actions per Colleague */}
                  <div className="flex items-center gap-2 pt-2 border-t border-[#F1F5F9]/10">
                    <button
                      onClick={() => {
                        setTrainingColleagueName(agent.name);
                        setSubView("training");
                      }}
                      className="flex-1 py-2 px-3 rounded-xl glass-panel hover:border-[#14B8A6]/50 text-[11px] font-semibold text-[#F1F5F9] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Sliders className="w-3.5 h-3.5 text-[#14B8A6]" />
                      <span>Fine-Tune &amp; Train</span>
                    </button>
                    <button
                      onClick={() => {
                        setSelectedApiColleagueId(agent.id);
                        setSubView("api");
                      }}
                      className="codos-cta-btn flex-1 py-2 px-3 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] text-[#0F172A] text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Generate Colleague API</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SECTION 2: CALL COLLEAGUE TRAINING STUDIO (VOICE & PLAYBOOK TRAINING)
         ===================================================================== */}
      {(subView === "all" || subView === "training") && (
        <div className="p-6 rounded-2xl glass-panel border border-[#F1F5F9]/15 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F1F5F9]/10 pb-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[#14B8A6] text-xs font-semibold mb-1">
                <Mic className="w-3.5 h-3.5" />
                <span>Neural Acoustic Cloning &amp; Call Playbook Fine-Tuning</span>
              </div>
              <h2 className="text-lg font-bold text-[#F1F5F9]">
                Call Colleague Training Studio
              </h2>
              <p className="text-xs text-[#F1F5F9]/70">
                Upload reference voice audio, past call transcripts, and SOP objection playbooks to train a custom sub-70ms AI Call Colleague.
              </p>
            </div>
            <span className="text-xs font-mono font-semibold text-[#14B8A6] self-start sm:self-auto">
              48kHz Neural Acoustic Pipeline
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 7 Cols: Drag-and-Drop Voice & Script Corpus Upload */}
            <div className="lg:col-span-7 space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingOver(true);
                }}
                onDragLeave={() => setIsDraggingOver(false)}
                onDrop={handleDropFiles}
                onClick={() => fileInputRef.current?.click()}
                className={`p-6 rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center space-y-2.5 ${
                  isDraggingOver
                    ? "border-[#14B8A6] bg-[#14B8A6]/10"
                    : "border-[#F1F5F9]/20 hover:border-[#14B8A6]/50"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".wav,.mp3,.flac,.jsonl,.json,.pdf,.docx,.txt"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                <div className="w-11 h-11 rounded-2xl bg-[#14B8A6]/15 flex items-center justify-center text-[#14B8A6]">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-[#F1F5F9]">
                    Drag &amp; Drop Voice Samples (.WAV, .MP3) or Call Playbooks (.JSONL, .PDF)
                  </h3>
                  <p className="text-[11px] text-[#F1F5F9]/65 mt-0.5">
                    Automatic speaker diarization, acoustic prosody cloning, and objection-handling RAG indexing.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      addFilesToTrainingCorpus([
                        `colleague_voice_sample_${trainingFiles.length + 1}.wav`,
                      ]);
                    }}
                    className="codos-cta-btn px-3 py-1.5 rounded-xl bg-[#14B8A6] text-[#0F172A] text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>+ Add Sample Voice Audio</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      addFilesToTrainingCorpus([
                        `inbound_escalation_playbook_v${trainingFiles.length + 1}.pdf`,
                      ]);
                    }}
                    className="px-3 py-1.5 rounded-xl glass-panel text-[11px] font-semibold text-[#F1F5F9] hover:border-[#14B8A6]/45 flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#14B8A6]" />
                    <span>+ Add Call Playbook</span>
                  </button>
                </div>
              </div>

              {/* Uploaded Voice & Script Corpus List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#F1F5F9]">
                    Voice &amp; Script Training Corpus ({trainingFiles.length} files)
                  </span>
                  <span className="font-mono text-[11px] text-[#14B8A6]">
                    Speaker Embeddings Verified
                  </span>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {trainingFiles.map((file) => (
                    <div
                      key={file.id}
                      className="p-3 rounded-xl bg-black/30 border border-[#F1F5F9]/10 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {file.type === "AUDIO" ? (
                          <FileAudio className="w-4 h-4 text-[#14B8A6] shrink-0" />
                        ) : (
                          <FileText className="w-4 h-4 text-[#14B8A6] shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-[#F1F5F9] truncate">
                            {file.name}
                          </div>
                          <div className="text-[10px] font-mono text-[#F1F5F9]/60">
                            {file.type} • {file.size} • {file.durationOrRows}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-mono font-bold text-[#14B8A6]">
                          {file.status}
                        </span>
                        <button
                          onClick={() =>
                            setTrainingFiles((prev) =>
                              prev.filter((f) => f.id !== file.id)
                            )
                          }
                          className="p-1 text-[#F1F5F9]/50 hover:text-rose-400 transition-colors cursor-pointer"
                          title="Remove training file"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Call Colleague System Prompt & Escalation Rules */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#F1F5F9] flex items-center justify-between">
                  <span>Colleague Call Playbook &amp; SIP Escalation Instructions</span>
                  <span className="text-[10px] font-mono text-[#14B8A6]">
                    Injected into Real-Time Voice Context
                  </span>
                </label>
                <textarea
                  rows={3}
                  value={callPlaybookPrompt}
                  onChange={(e) => setCallPlaybookPrompt(e.target.value)}
                  className="w-full p-3 rounded-xl bg-black/40 border border-[#F1F5F9]/15 text-xs text-[#F1F5F9] outline-none leading-relaxed"
                />
              </div>
            </div>

            {/* Right 5 Cols: Acoustic Hyperparameters & Live Training Runner */}
            <div className="lg:col-span-5 p-5 rounded-2xl bg-black/30 border border-[#F1F5F9]/12 space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-[#F1F5F9]/10 pb-2.5">
                  <Sliders className="w-4 h-4 text-[#14B8A6]" />
                  <h3 className="text-sm font-bold text-[#F1F5F9]">
                    Voice Persona &amp; Acoustic Tuning
                  </h3>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-[#F1F5F9]/75">
                    Call Colleague Agent Name
                  </label>
                  <input
                    type="text"
                    value={trainingColleagueName}
                    onChange={(e) => setTrainingColleagueName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-[#F1F5F9]/15 text-xs text-[#F1F5F9] outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-[#F1F5F9]/75">
                    Base Acoustic Speech Engine
                  </label>
                  <select
                    value={baseVoiceEngine}
                    onChange={(e) => setBaseVoiceEngine(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#0F172A] border border-[#F1F5F9]/15 text-xs text-[#F1F5F9] outline-none"
                  >
                    <option>Codos-Sonic-Voice-v3 (Sub-70ms Neural Speech)</option>
                    <option>Codos-Multilingual-HD-v2 (32 Languages)</option>
                    <option>SkyBeak-Voice-Neural-Pro (Zero-Shot Acoustic Clone)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-[#F1F5F9]/75">
                    Voice Clone Timbre &amp; Persona
                  </label>
                  <select
                    value={voiceClonePreset}
                    onChange={(e) => setVoiceClonePreset(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#0F172A] border border-[#F1F5F9]/15 text-xs text-[#F1F5F9] outline-none"
                  >
                    <option>Eleanor - Executive British (Warm &amp; Authoritative)</option>
                    <option>Marcus - Technical Specialist (Clear US)</option>
                    <option>Aria - Empathetic Healthcare &amp; Support Concierge</option>
                    <option>Custom Uploaded Voice Clone (.WAV Reference)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#F1F5F9]/75">Speaking Rate</span>
                      <span className="font-mono font-bold text-[#14B8A6]">
                        {speakingRate.toFixed(2)}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.85}
                      max={1.25}
                      step={0.05}
                      value={speakingRate}
                      onChange={(e) =>
                        setSpeakingRate(parseFloat(e.target.value))
                      }
                      className="w-full accent-[#14B8A6] cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#F1F5F9]/75">Barge-In VAD</span>
                      <span className="font-mono font-bold text-[#14B8A6]">
                        {bargeInMs}ms
                      </span>
                    </div>
                    <input
                      type="range"
                      min={45}
                      max={120}
                      step={5}
                      value={bargeInMs}
                      onChange={(e) =>
                        setBargeInMs(parseInt(e.target.value, 10))
                      }
                      className="w-full accent-[#14B8A6] cursor-pointer"
                    />
                  </div>
                </div>

                {/* Live Voice Training Progress & Metrics */}
                <div className="p-3.5 rounded-xl bg-black/40 border border-[#F1F5F9]/10 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#F1F5F9] flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-[#14B8A6]" />
                      <span>Acoustic Training Status</span>
                    </span>
                    <span className="font-mono font-bold text-[#14B8A6]">
                      {voiceTrainProgress}%
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-[#14B8A6] transition-all duration-300"
                      style={{ width: `${voiceTrainProgress}%` }}
                    />
                  </div>
                  {voiceTrainBadge && (
                    <p className="text-[11px] font-mono text-[#14B8A6]">
                      {voiceTrainBadge}
                    </p>
                  )}
                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[#F1F5F9]/10 text-[10px] font-mono">
                    <div>
                      <span className="text-[#F1F5F9]/55 block">MOS Score</span>
                      <span className="font-bold text-[#F1F5F9]">4.94 / 5.0</span>
                    </div>
                    <div>
                      <span className="text-[#F1F5F9]/55 block">Word Error</span>
                      <span className="font-bold text-[#14B8A6]">1.8% WER</span>
                    </div>
                    <div>
                      <span className="text-[#F1F5F9]/55 block">Audio RTT</span>
                      <span className="font-bold text-[#14B8A6]">{bargeInMs}ms</span>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleStartVoiceTraining}
                disabled={isTrainingVoice || trainingFiles.length === 0}
                className="codos-cta-btn w-full py-3 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] text-[#0F172A] text-xs font-bold flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  {isTrainingVoice
                    ? "Training Call Colleague Voice..."
                    : "Train & Deploy Call Colleague"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SECTION 3: CALL COLLEAGUE API GENERATION & WEBHOOK STUDIO
         ===================================================================== */}
      {(subView === "all" || subView === "api") && (
        <div className="p-6 rounded-2xl glass-panel border border-[#F1F5F9]/15 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F1F5F9]/10 pb-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[#14B8A6] text-xs font-semibold mb-1">
                <KeyRound className="w-3.5 h-3.5" />
                <span>Call Colleague API Key, SIP Token &amp; SDK Generator</span>
              </div>
              <h2 className="text-lg font-bold text-[#F1F5F9]">
                Call Colleague API Generation
              </h2>
              <p className="text-xs text-[#F1F5F9]/70">
                Generate dedicated API keys scoped to your trained Call Colleague agents, configure real-time call webhooks, and copy ready-to-run integration code.
              </p>
            </div>
            <span className="text-xs font-mono font-semibold text-[#14B8A6] self-start sm:self-auto">
              REST • WebRTC • SIP Trunking
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 6 Cols: API Key & Scope Generator Form + Provisioned Keys */}
            <div className="lg:col-span-6 space-y-5">
              <form
                onSubmit={handleGenerateColleagueApi}
                className="p-5 rounded-2xl bg-black/30 border border-[#F1F5F9]/12 space-y-4"
              >
                <h3 className="text-sm font-bold text-[#F1F5F9] flex items-center gap-2">
                  <Plus className="w-4 h-4 text-[#14B8A6]" />
                  <span>Generate Scoped Call Colleague API Key</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-[#F1F5F9]/75">
                      Target AI Call Colleague
                    </label>
                    <select
                      value={selectedApiColleagueId}
                      onChange={(e) => setSelectedApiColleagueId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#0F172A] border border-[#F1F5F9]/15 text-xs text-[#F1F5F9] outline-none"
                    >
                      {colleagues.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.id})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-[#F1F5F9]/75">
                      API Key Label
                    </label>
                    <input
                      type="text"
                      value={newApiKeyName}
                      onChange={(e) => setNewApiKeyName(e.target.value)}
                      placeholder="e.g. Outbound Sales Dispatch Key"
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-[#F1F5F9]/15 text-xs text-[#F1F5F9] outline-none"
                    />
                  </div>
                </div>

                {/* Scopes Selection */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-[#F1F5F9]/75">
                    Call Colleague Permission Scopes
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      "voice:outbound-dispatch",
                      "voice:inbound-sip",
                      "voice:webrtc-stream",
                      "voice:transcripts-webhook",
                      "voice:live-transfer",
                    ].map((scope) => {
                      const active = selectedScopes.includes(scope);
                      return (
                        <button
                          key={scope}
                          type="button"
                          onClick={() => toggleScope(scope)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold border transition-all cursor-pointer ${
                            active
                              ? "codos-cta-btn bg-[#14B8A6] text-[#0F172A] border-[#14B8A6]"
                              : "bg-black/30 border-[#F1F5F9]/15 text-[#F1F5F9]/75 hover:border-[#14B8A6]/45"
                          }`}
                        >
                          {active ? "✓ " : "+ "}
                          {scope}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Webhook Endpoint URL */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-[#F1F5F9]/75 flex items-center gap-1.5">
                    <Webhook className="w-3.5 h-3.5 text-[#14B8A6]" />
                    <span>Post-Call &amp; Live Transcript Webhook URL</span>
                  </label>
                  <input
                    type="text"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-[#F1F5F9]/15 text-xs font-mono text-[#F1F5F9] outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="codos-cta-btn w-full py-2.5 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] text-[#0F172A] text-xs font-bold flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>Generate Call Colleague API Key &amp; Update SDK</span>
                </button>
              </form>

              {/* Provisioned Call Colleague API Keys List */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#F1F5F9]">
                    Generated Call Colleague Keys ({colleagueApiKeys.length})
                  </span>
                  <span className="font-mono text-[11px] text-[#14B8A6]">
                    HMAC-SHA256 Signed
                  </span>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {colleagueApiKeys.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl bg-black/30 border border-[#F1F5F9]/12 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-bold text-[#F1F5F9]">
                            {item.name}
                          </div>
                          <div className="text-[10px] text-[#14B8A6] font-mono">
                            Bound to: {item.colleagueName} ({item.colleagueId})
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-[#F1F5F9]/60">
                          {item.created}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-black/40 border border-[#F1F5F9]/10 font-mono text-xs">
                        <span className="text-[#14B8A6] truncate">
                          {maskApiKey(item.keySecret)}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy(item.keySecret, item.id)
                            }
                            className="px-2 py-1 rounded bg-[#F1F5F9]/10 hover:bg-[#F1F5F9]/20 text-[10px] text-[#F1F5F9] flex items-center gap-1 cursor-pointer"
                          >
                            {copiedTextId === item.id ? (
                              <>
                                <Check className="w-3 h-3 text-[#14B8A6]" />
                                <span>Copied Full Key</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy Key</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setColleagueApiKeys((prev) =>
                                prev.filter((k) => k.id !== item.id)
                              )
                            }
                            className="p-1 text-[#F1F5F9]/50 hover:text-rose-400 cursor-pointer"
                            title="Revoke API key"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {item.scopes.map((sc) => (
                          <span
                            key={sc}
                            className="text-[9px] font-mono px-2 py-0.5 rounded bg-[#F1F5F9]/10 text-[#F1F5F9]/80"
                          >
                            {sc}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right 6 Cols: Live Auto-Generated Call Colleague SDK & REST Code */}
            <div className="lg:col-span-6 p-5 rounded-2xl bg-black/30 border border-[#F1F5F9]/12 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F1F5F9]/10 pb-3">
                  <div className="flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-[#14B8A6]" />
                    <div>
                      <h3 className="text-sm font-bold text-[#F1F5F9]">
                        Auto-Generated Call Colleague API Snippet
                      </h3>
                      <p className="text-[10px] font-mono text-[#14B8A6]">
                        Endpoint: POST /v1/voice/colleague/dispatch • Colleague:{" "}
                        {activeApiColleague.id}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {(["TS", "PY", "CURL", "GO"] as const).map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setSdkLang(lang)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                          sdkLang === lang
                            ? "codos-cta-btn bg-[#14B8A6] text-[#0F172A]"
                            : "bg-black/40 text-[#F1F5F9]/75 hover:text-[#F1F5F9]"
                        }`}
                      >
                        {lang}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(getGeneratedCodeSnippet(), "sdk-snippet")
                      }
                      className="px-2.5 py-1 rounded-lg bg-[#F1F5F9]/10 hover:bg-[#F1F5F9]/20 text-[10px] font-mono text-[#F1F5F9] flex items-center gap-1 cursor-pointer"
                    >
                      {copiedTextId === "sdk-snippet" ? (
                        <>
                          <Check className="w-3 h-3 text-[#14B8A6]" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Code Viewer with IDE Syntax Highlighting */}
                <pre className="p-4 rounded-xl bg-black/50 border border-[#F1F5F9]/10 text-xs font-mono overflow-x-auto leading-relaxed">
                  <code className="block">
                    {renderHighlightedCode(getGeneratedCodeSnippet())}
                  </code>
                </pre>

                {/* Live Endpoint Metadata Summary */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-2.5 pt-2">
                  <div className="p-3 rounded-xl bg-black/40 border border-[#F1F5F9]/10 min-w-0 overflow-hidden space-y-0.5">
                    <span className="text-[10px] text-[#F1F5F9]/60 block truncate">
                      REST Dispatch Endpoint
                    </span>
                    <span
                      title="/v1/voice/colleague/dispatch"
                      className="text-[11px] font-mono font-bold text-[#14B8A6] block truncate"
                    >
                      /v1/voice/colleague/dispatch
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-black/40 border border-[#F1F5F9]/10 min-w-0 overflow-hidden space-y-0.5">
                    <span className="text-[10px] text-[#F1F5F9]/60 block truncate">
                      Duplex WebSocket Stream
                    </span>
                    <span
                      title={ENV_STREAM_WSS_URL}
                      className="text-[11px] font-mono font-bold text-[#F1F5F9] block truncate"
                    >
                      {ENV_STREAM_WSS_URL}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-black/40 border border-[#F1F5F9]/10 min-w-0 overflow-hidden space-y-0.5">
                    <span className="text-[10px] text-[#F1F5F9]/60 block truncate">
                      Active Voice Key (.env)
                    </span>
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-[11px] font-mono font-bold text-[#14B8A6] block truncate">
                        {maskApiKey(lastGeneratedKey)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(lastGeneratedKey, "active-voice-key")
                        }
                        className="p-0.5 text-[#14B8A6] hover:opacity-80 cursor-pointer shrink-0"
                        title="Copy full key"
                      >
                        {copiedTextId === "active-voice-key" ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#F1F5F9]/10 text-[11px] text-[#F1F5F9]/70">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#14B8A6]" />
                  <span>
                    TLS 1.3 + SRTP Encrypted Voice Stream • SOC2 &amp; HIPAA Ready
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleTriggerTestCall}
                  className="text-xs font-bold text-[#14B8A6] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Play className="w-3 h-3" />
                  <span>Test Dispatch API Now</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

