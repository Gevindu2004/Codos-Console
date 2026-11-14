"use client";

import React, { useState } from "react";
import {
  PhoneCall,
  LayoutDashboard,
  Wand2,
  KeyRound,
  Copy,
  Check,
  Plus,
  Trash2,
  Code2,
  ShieldCheck,
} from "lucide-react";
import {
  CallColleagueProvider,
  useCallColleagueNavigation,
  useOnboardingStore,
} from "./call-colleague/CallColleagueContext";
import { OnboardingStudio } from "./call-colleague/OnboardingStudio";
import { AdminPortal } from "./call-colleague/AdminPortal";
import { Card, Button, Badge, Input } from "./call-colleague/ui";

export type CallColleagueSubView = "all" | "simulator" | "training" | "api";

interface CallColleagueWorkspaceProps {
  isLightTheme?: boolean;
}

interface ColleagueApiKey {
  id: string;
  name: string;
  agentName: string;
  keySecret: string;
  scopes: string[];
  webhookUrl: string;
  created: string;
}

const INITIAL_API_KEYS: ColleagueApiKey[] = [
  {
    id: "cc-key-1",
    name: "Production Inbound SIP & Calendar Key",
    agentName: "Luxe Hair & Color Lounge (Sophia)",
    keySecret: "API KEY 1",
    scopes: [
      "voice:inbound-sip",
      "voice:vapi-assistant",
      "calendar:google-sync",
    ],
    webhookUrl: "https://api.viacodos.com/v1/webhooks/call-colleague",
    created: "Active • Auto-Provisioned",
  },
  {
    id: "cc-key-2",
    name: "Staging WebRTC Sandbox Key",
    agentName: "Apex Family Dental & Wellness",
    keySecret: "API KEY 2",
    scopes: ["voice:webrtc-stream", "voice:warm-transfer"],
    webhookUrl: "https://staging.viacodos.com/v1/webhooks/call-colleague",
    created: "2 days ago",
  },
];

function DeveloperApiDrawer() {
  const { businessName, voicePersona, virtualPhoneNumber } =
    useOnboardingStore();
  const [apiKeys, setApiKeys] = useState<ColleagueApiKey[]>(INITIAL_API_KEYS);
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  const handleCopyKey = (id: string, secret: string) => {
    navigator.clipboard.writeText(secret);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleCreateKey = (e: React.FormEvent) => {
    e.preventDefault();
    const nextNum = apiKeys.length + 1;
    const newEntry: ColleagueApiKey = {
      id: `cc-key-${Date.now()}`,
      name:
        newKeyLabel.trim() ||
        `${businessName || "CallColleague"} Voice Key #${nextNum}`,
      agentName: `${businessName} (${voicePersona.name})`,
      keySecret: `API KEY ${nextNum}`,
      scopes: [
        "voice:inbound-sip",
        "voice:vapi-assistant",
        "calendar:google-sync",
      ],
      webhookUrl: "https://api.viacodos.com/v1/webhooks/call-colleague",
      created: "Just now",
    };
    setApiKeys([newEntry, ...apiKeys]);
    setNewKeyLabel("");
    handleCopyKey(newEntry.id, newEntry.keySecret);
  };

  const snippetText = `import { CallColleagueClient } from "@viacodos/call-colleague-sdk";

// Provisioned for: ${businessName} (${voicePersona.name})
const agent = new CallColleagueClient({
  apiKey: process.env.CALL_COLLEAGUE_API_KEY,
  virtualPhoneNumber: "${virtualPhoneNumber || "+1 (888) 412-9940"}",
  voicePersona: "${voicePersona.id}",
});

const session = await agent.calls.dispatch({
  callerPhone: "+1 (555) 234-8900",
  enableCalendarSync: true,
});`;

  const copySnippet = () => {
    navigator.clipboard.writeText(snippetText);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 1800);
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <Badge variant="info" className="mb-2">
              <KeyRound className="w-3 h-3 mr-1" /> Scoped Voice API Keys
            </Badge>
            <h2 className="text-xl font-bold text-white">
              CallColleague.ai Developer Keys & Webhooks
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Full keys remain masked on screen as{" "}
              <code className="text-[#14B8A6] font-mono">API**********</code>{" "}
              and copy directly to your clipboard.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleCreateKey}
          className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 mb-6 p-4 rounded-xl bg-slate-950/80 border border-slate-800"
        >
          <div className="flex-1">
            <Input
              label="Generate Scoped Voice API Key"
              placeholder="e.g., Production SIP Bridge Key"
              value={newKeyLabel}
              onChange={(e) => setNewKeyLabel(e.target.value)}
            />
          </div>
          <Button type="submit" variant="primary">
            <Plus className="w-4 h-4" /> Mint Voice API Key
          </Button>
        </form>

        <div className="space-y-3">
          {apiKeys.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-white">
                    {item.name}
                  </span>
                  <Badge variant="info">{item.agentName}</Badge>
                  <span className="text-[11px] text-slate-500">
                    {item.created}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <code className="px-2.5 py-1 rounded-lg bg-slate-900 border border-[#14B8A6]/30 text-xs font-mono text-[#14B8A6]">
                    API**********
                  </code>
                  {item.scopes.map((sc) => (
                    <span
                      key={sc}
                      className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800"
                    >
                      {sc}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleCopyKey(item.id, item.keySecret)}
                >
                  {copiedId === item.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#14B8A6]" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copy Key
                    </>
                  )}
                </Button>
                {apiKeys.length > 1 && (
                  <button
                    onClick={() =>
                      setApiKeys((prev) => prev.filter((k) => k.id !== item.id))
                    }
                    className="p-2 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                    title="Revoke Key"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-[#14B8A6]" />
            <h3 className="text-sm font-bold text-white">
              Next.js / TypeScript Voice SDK Quickstart
            </h3>
          </div>
          <Button size="sm" variant="secondary" onClick={copySnippet}>
            {copiedSnippet ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#14B8A6]" /> Copied
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" /> Copy Snippet
              </>
            )}
          </Button>
        </div>

        <pre className="p-4 rounded-xl bg-[#070B14] border border-slate-800 text-xs font-mono overflow-x-auto leading-relaxed text-slate-200">
          <code>
            <span className="text-[#C084FC]">import</span>{" "}
            {"{ CallColleagueClient }"}{" "}
            <span className="text-[#C084FC]">from</span>{" "}
            <span className="text-[#14B8A6]">
              &quot;@viacodos/call-colleague-sdk&quot;
            </span>
            ;{"\n\n"}
            <span className="text-[#64748B] italic">
              {"// Provisioned for: "}
              {businessName} ({voicePersona.name})
            </span>
            {"\n"}
            <span className="text-[#C084FC]">const</span> agent ={" "}
            <span className="text-[#C084FC]">new</span>{" "}
            <span className="text-[#38BDF8]">CallColleagueClient</span>({"{\n"}
            {"  "}
            <span className="text-[#93C5FD]">apiKey</span>:{" "}
            <span className="text-[#E2E8F0]">
              process.env.CALL_COLLEAGUE_API_KEY
            </span>
            ,{"\n"}
            {"  "}
            <span className="text-[#93C5FD]">virtualPhoneNumber</span>:{" "}
            <span className="text-[#14B8A6]">
              &quot;{virtualPhoneNumber || "+1 (888) 412-9940"}&quot;
            </span>
            ,{"\n"}
            {"  "}
            <span className="text-[#93C5FD]">voicePersona</span>:{" "}
            <span className="text-[#14B8A6]">&quot;{voicePersona.id}&quot;</span>
            ,{"\n"}
            {"}"});{"\n\n"}
            <span className="text-[#C084FC]">const</span> session ={" "}
            <span className="text-[#C084FC]">await</span> agent.calls.
            <span className="text-[#38BDF8]">dispatch</span>({"{\n"}
            {"  "}
            <span className="text-[#93C5FD]">callerPhone</span>:{" "}
            <span className="text-[#14B8A6]">&quot;+1 (555) 234-8900&quot;</span>
            ,{"\n"}
            {"  "}
            <span className="text-[#93C5FD]">enableCalendarSync</span>:{" "}
            <span className="text-[#F59E0B]">true</span>,{"\n"}
            {"}"});
          </code>
        </pre>
      </Card>
    </div>
  );
}

function CallColleagueInnerWorkspace() {
  const { activeView, navigateTo } = useCallColleagueNavigation();
  const [showApiKeysView, setShowApiKeysView] = useState(false);

  const isStudioActive =
    !showApiKeysView &&
    (activeView === "onboarding" || activeView === "success");
  const isPortalActive =
    !showApiKeysView && (activeView === "dashboard" || activeView === "login");

  return (
    <div className="call-colleague-root space-y-6 animate-in fade-in duration-200">
      {/* Top Mode Switcher Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#0B1221]/90 border border-slate-800/90 shadow-lg">
        <div className="flex items-center gap-2.5">
          <div className="cc-solid-badge w-9 h-9 rounded-xl bg-[#14B8A6] flex items-center justify-center text-[#0F172A] shadow-md shadow-[#14B8A6]/25">
            <PhoneCall className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">
                CallColleague<span className="text-[#14B8A6]">.ai</span>
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#14B8A6]/15 text-[#14B8A6] border border-[#14B8A6]/35">
                Next.js 16 Integrated
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              24/7 Autonomous AI Voice Receptionist Studio & Customer Portal
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setShowApiKeysView(false);
              navigateTo("onboarding");
            }}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              isStudioActive
                ? "bg-[#14B8A6] text-[#0F172A] shadow-md shadow-[#14B8A6]/25"
                : "bg-slate-950/80 text-slate-300 hover:text-white border border-slate-800"
            }`}
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>Agent Setup Studio (6-Step Wizard)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowApiKeysView(false);
              navigateTo("dashboard");
            }}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              isPortalActive
                ? "bg-[#14B8A6] text-[#0F172A] shadow-md shadow-[#14B8A6]/25"
                : "bg-slate-950/80 text-slate-300 hover:text-white border border-slate-800"
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Customer Admin Portal</span>
          </button>

          <button
            type="button"
            onClick={() => setShowApiKeysView(true)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              showApiKeysView
                ? "bg-[#14B8A6] text-[#0F172A] shadow-md shadow-[#14B8A6]/25"
                : "bg-slate-950/80 text-slate-300 hover:text-white border border-slate-800"
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Voice API Keys & SDK</span>
          </button>
        </div>
      </div>

      {/* Main Active View */}
      {showApiKeysView ? (
        <DeveloperApiDrawer />
      ) : activeView === "dashboard" || activeView === "login" ? (
        <AdminPortal />
      ) : (
        <OnboardingStudio />
      )}

      {/* Footer Compliance Bar */}
      <div className="pt-4 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#14B8A6]" />
          CallColleague AI Receptionist Platform — Powered by Vapi, Twilio &
          Google Calendar Sync
        </span>
        <span>Sub-600ms Voice Latency • Multi-Tenant SaaS</span>
      </div>
    </div>
  );
}

export function CallColleagueWorkspace(
  _props: CallColleagueWorkspaceProps
) {
  return (
    <CallColleagueProvider initialView="onboarding">
      <CallColleagueInnerWorkspace />
    </CallColleagueProvider>
  );
}

export default CallColleagueWorkspace;
