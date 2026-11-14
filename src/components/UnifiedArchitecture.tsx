"use client";

import React, { useState } from "react";
import {
  Copy,
  Check,
  Layers,
  CreditCard,
  Key,
} from "lucide-react";

const KEYWORDS = new Set([
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
]);

const FUNCTIONS_AND_TYPES = new Set([
  "CodosConsole",
  "CodosClient",
  "NewClient",
  "VoiceParams",
  "handleCustomerIncident",
  "complete",
  "dispatchColleague",
  "dispatch_colleague",
  "Dispatch",
  "log",
  "print",
  "Printf",
  "getenv",
  "Background",
  "main",
]);

const PROPERTIES = new Set([
  "apiKey",
  "region",
  "prompt",
  "routing",
  "recipientPhone",
  "recipient_phone",
  "persona",
  "customContext",
  "context",
  "Recipient",
  "Persona",
  "CODOS_API_KEY",
  "api_key",
  "id",
  "latencyMs",
  "data",
  "output",
  "session_id",
  "ID",
  "llm",
  "voice",
  "Voice",
]);

function highlightCodeSegment(segment: string, keyPrefix: string): React.ReactNode[] {
  // Match strings ("..." or '...'), URLs, flags (-X, -H, -d), words, numbers, or punctuation
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
    if (token === "-X" || token === "-H" || token === "-d" || KEYWORDS.has(token)) {
      return (
        <span key={key} className="tok-keyword">
          {token}
        </span>
      );
    }
    if (FUNCTIONS_AND_TYPES.has(token)) {
      return (
        <span key={key} className="tok-fn">
          {token}
        </span>
      );
    }
    if (PROPERTIES.has(token)) {
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
      // Check for inline // comment (not inside https://)
      const inlineSlash = line.indexOf(" //");
      if (inlineSlash !== -1) {
        codePart = line.slice(0, inlineSlash);
        commentPart = line.slice(inlineSlash);
      }
    }

    return (
      <div key={lineIdx} className="table-row hover:bg-[#14B8A6]/[0.06] transition-colors">
        <span className="table-cell pr-4 select-none text-right text-[10px] opacity-35 font-mono w-7">
          {String(lineIdx + 1).padStart(2, "0")}
        </span>
        <span className="table-cell whitespace-pre">
          {codePart ? highlightCodeSegment(codePart, `l${lineIdx}`) : null}
          {commentPart ? <span className="tok-comment">{commentPart}</span> : null}
          {line.length === 0 ? "\n" : null}
        </span>
      </div>
    );
  });
}

export const UnifiedArchitecture: React.FC = () => {
  const [activeLang, setActiveLang] = useState<"ts" | "py" | "curl" | "go">("ts");
  const [copied, setCopied] = useState(false);

  const codeSnippets = {
    ts: `import { CodosConsole } from "@viacodos/sdk";

// Single client initialized with 1 enterprise key
const codos = new CodosConsole({
  apiKey: process.env.CODOS_API_KEY, // unified access token
  region: "us-east-1"
});

async function handleCustomerIncident() {
  // 1. Query LLM Router to extract intent and sentiment
  const analysis = await codos.llm.complete({
    prompt: "User reports payment gateway timeout error",
    routing: "lowest-latency"
  });

  // 2. Dispatch autonomous AI Call Colleague to caller
  const callSession = await codos.voice.dispatchColleague({
    recipientPhone: "+15550198273",
    persona: "executive_incident_liaison",
    customContext: analysis.data
  });

  console.log("Call active:", callSession.id, "Latency:", callSession.latencyMs);
}`,
    py: `from codos_console import CodosClient
import os

# Initialize unified Codos client
codos = CodosClient(api_key=os.getenv("CODOS_API_KEY"))

# 1. Route multi-model prompt
analysis = codos.llm.complete(
    prompt="User reports payment gateway timeout error",
    routing="cost-optimized"
)

# 2. Dispatch AI Call Colleague
call = codos.voice.dispatch_colleague(
    recipient_phone="+15550198273",
    persona="support_tier_2",
    context=analysis.output
)

print(f"Colleague connected: {call.session_id} on Thumbs Up Gateway")`,
    curl: `curl -X POST https://api.viacodos.com/v1/orchestrate/unified \\
  -H "Authorization: Bearer codos_live_prod_898f21a..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "services": ["llm", "voice", "thumbs_up_api"],
    "voice": { "recipient": "+15550198273", "voice_persona": "eleanor" },
    "llm": { "strategy": "auto_failover", "prompt": "Explain billing resolution" }
  }'`,
    go: `package main

import (
	"context"
	"fmt"
	"github.com/viacodos/codos-go/codos"
)

func main() {
	client := codos.NewClient("codos_live_prod_898f21a...")
	session, _ := client.Voice.Dispatch(context.Background(), &codos.VoiceParams{
		Recipient: "+15550198273",
		Persona:   "enterprise_agent",
	})
	fmt.Printf("Voice Colleague Active: %s via Thumbs Up API\\n", session.ID)
}`,
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(codeSnippets[activeLang]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section
      id="architecture"
      className="w-full lg:h-screen lg:max-h-screen min-h-[650px] pt-16 pb-6 px-6 sm:px-10 lg:px-12 flex flex-col justify-between gap-5 overflow-hidden bg-[#0F172A]"
    >
      {/* Compact Header */}
      <div className="text-center space-y-2 max-w-4xl mx-auto flex-shrink-0">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#F1F5F9]">
          Unified Architecture. <span className="text-[#14B8A6]">Engineered for Scale.</span>
        </h2>
        <p className="text-xs sm:text-sm text-[#F1F5F9]/70 max-w-2xl mx-auto">
          Stop managing 3 separate logins, 3 payment methods, and 3 disparate API keys.
          One SDK client gives you programmatic control over voice agents, API gateways, and LLM routers.
        </p>
      </div>

      {/* Main Content Grid */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0 items-stretch">
        <div className="lg:col-span-5 flex flex-col justify-between gap-4">
          <div className="p-5 rounded-2xl glass-panel border border-[#F1F5F9]/12 hover:border-[#14B8A6]/45 transition-colors space-y-2 flex-1 flex flex-col justify-center">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#14B8A6]/20 flex items-center justify-center text-[#14B8A6] flex-shrink-0">
                <Key className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-[#F1F5F9]">
                1. Single Authentication
              </h3>
            </div>
            <p className="text-xs text-[#F1F5F9]/70 leading-relaxed">
              One master key with fine-grained RBAC permissions controls your voice dispatchers,
              gateway rate limits, and LLM token budgets.
            </p>
          </div>

          <div className="p-5 rounded-2xl glass-panel border border-[#F1F5F9]/12 hover:border-[#14B8A6]/45 transition-colors space-y-2 flex-1 flex flex-col justify-center">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#14B8A6]/20 flex items-center justify-center text-[#14B8A6] flex-shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-[#F1F5F9]">
                2. Inter-Service Synergy
              </h3>
            </div>
            <p className="text-xs text-[#F1F5F9]/70 leading-relaxed">
              Call Colleague streams live conversations into Thumbs Up API metrics while
              fetching dynamic context from Sky Beak LLM in real time.
            </p>
          </div>

          <div className="p-5 rounded-2xl glass-panel border border-[#F1F5F9]/12 hover:border-[#14B8A6]/45 transition-colors space-y-2 flex-1 flex flex-col justify-center">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#14B8A6]/20 flex items-center justify-center text-[#14B8A6] flex-shrink-0">
                <CreditCard className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-[#F1F5F9]">
                3. Consolidated Invoicing
              </h3>
            </div>
            <p className="text-xs text-[#F1F5F9]/70 leading-relaxed">
              Call minutes, API request volume, and LLM token expenditures are bundled into
              a single monthly invoice with unified credit allocations.
            </p>
          </div>
        </div>

        <div className="lg:col-span-7 rounded-3xl glass-panel border border-[#F1F5F9]/15 overflow-hidden shadow-2xl flex flex-col">
          <div className="flex items-center justify-between px-5 py-3 bg-[#090E1A] border-b border-[#F1F5F9]/10 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#27C93F]" />
              </div>
              <span className="text-xs font-mono text-[#F1F5F9]/70 hidden sm:inline">
                codos-console-unified-workflow.{activeLang}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex rounded-lg bg-[#F1F5F9]/5 p-0.5 text-xs font-mono">
                {(["ts", "py", "curl", "go"] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setActiveLang(lang)}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      activeLang === lang
                        ? "codos-cta-btn bg-[#14B8A6] text-[#0F172A] font-bold"
                        : "text-[#F1F5F9]/60 hover:text-[#F1F5F9]"
                    }`}
                  >
                    {lang.toUpperCase()}
                  </button>
                ))}
              </div>

              <button
                onClick={handleCopy}
                className="p-1.5 rounded-lg bg-[#F1F5F9]/10 hover:bg-[#F1F5F9]/20 text-[#F1F5F9] transition-colors cursor-pointer"
                title="Copy code"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-[#14B8A6]" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          <div className="p-5 bg-[#090E1A]/90 overflow-auto flex-1 text-xs font-mono leading-relaxed text-[#F1F5F9] flex items-center">
            <pre className="w-full table">
              <code>{renderHighlightedCode(codeSnippets[activeLang])}</code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
};
