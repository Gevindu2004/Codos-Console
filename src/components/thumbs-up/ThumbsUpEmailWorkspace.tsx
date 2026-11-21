"use client";

// ThumbsUp Email — the Thumbs Up API section of Codos Console.
// Independent from Call Colleague and Sky Beak: own backend (thumbsup-api/), own accounts.

import React, { useEffect, useState } from "react";
import {
  BookOpen,
  Compass,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Globe2,
  MailCheck,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Mail,
  Send,
  ServerCrash,
  Webhook,
} from "lucide-react";
import { THUMBSUP_API_URL, tuFetch, TuError, TuUser } from "./api";
import { AuthPanel } from "./AuthPanel";
import { OverviewView } from "./OverviewView";
import { KeysView } from "./KeysView";
import { TemplatesView } from "./TemplatesView";
import { SendTestView } from "./SendTestView";
import { LogsView } from "./LogsView";
import { WebhooksView } from "./WebhooksView";
import { DocsView } from "./DocsView";
import { DomainsView } from "./DomainsView";
import { DriveAssetsView } from "./DriveAssetsView";
import { SheetsView } from "./SheetsView";
import { DriveGuide, EmailGuide, SheetsGuide } from "./Guides";
import { Button, Card, CodeBlock, Input, Notice, Spinner, ToastProvider, cx, errorText } from "./ui";

export type TuView = "guide" | "overview" | "keys" | "templates" | "send" | "logs" | "domains" | "webhooks" | "docs";

const NAV: { id: TuView; label: string; icon: typeof Mail }[] = [
  { id: "guide", label: "Start here", icon: Compass },
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "keys", label: "API Keys", icon: KeyRound },
  { id: "templates", label: "Templates", icon: FileText },
  { id: "send", label: "Send Test", icon: Send },
  { id: "logs", label: "Email Logs", icon: ListChecks },
  { id: "domains", label: "Domains", icon: Globe2 },
  { id: "webhooks", label: "Webhooks", icon: Webhook },
  { id: "docs", label: "Docs & Code", icon: BookOpen },
];

type Phase = "loading" | "offline" | "guest" | "ready";

export function ThumbsUpEmailWorkspace() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [user, setUser] = useState<TuUser | null>(null);
  const [view, setView] = useState<TuView>("overview");
  // Back from "Sign in with Google": open Sheets
  const [product, setProduct] = useState<"email" | "drive" | "sheets">(() => {
    if (typeof window === "undefined") return "email";
    const p = new URLSearchParams(window.location.search);
    return p.has("tu_sheets") || p.has("tu_sheets_error") ? "sheets" : "email";
  });
  const [driveView, setDriveView] = useState<"guide" | "projects" | "keys">("projects");
  const [sheetsView, setSheetsView] = useState<"guide" | "sheets" | "keys">("sheets");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let alive = true;
    tuFetch<{ user: TuUser }>("/dashboard/auth/me")
      .then((r) => {
        if (!alive) return;
        setUser(r.user);
        setPhase("ready");
      })
      .catch((err: TuError) => {
        if (!alive) return;
        setPhase(err.code === "server_offline" ? "offline" : "guest");
      });
    return () => {
      alive = false;
    };
  }, [retry]);

  const logout = async () => {
    await tuFetch("/dashboard/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
    setView("overview");
    setPhase("guest");
  };

  return (
    <ToastProvider>
      <div className="space-y-6 animate-in fade-in duration-200">
        {phase === "loading" && <Spinner label="Opening ThumbsUp Email…" />}

        {phase === "offline" && (
          <Card className="p-8 space-y-4 max-w-2xl">
            <div className="flex items-center gap-3">
              <ServerCrash className="w-6 h-6 text-amber-500" />
              <h2 className="text-lg font-bold text-[#F1F5F9]">The ThumbsUp server isn&apos;t running</h2>
            </div>
            <p className="text-sm text-[#F1F5F9]/75">
              Start it in a new terminal, then press <b>Try again</b>. It should be reachable at{" "}
              <code className="font-mono text-[#14B8A6]">{THUMBSUP_API_URL}</code>.
            </p>
            <CodeBlock
              language="powershell"
              code={"cd thumbsup-api\n.\\.venv\\Scripts\\python.exe -m uvicorn app.main:app --port 8001"}
            />
            <p className="text-xs text-[#F1F5F9]/65">
              If it stops with a red message, it&apos;s telling you which setting in <code className="font-mono">thumbsup-api/.env</code> to fix.
            </p>
            <Button
              onClick={() => {
                setPhase("loading");
                setRetry((n) => n + 1);
              }}
            >
              Try again
            </Button>
          </Card>
        )}

        {phase === "guest" && (
          <AuthPanel
            onAuthed={(u) => {
              setUser(u);
              setView("overview");
              setPhase("ready");
            }}
          />
        )}

        {phase === "ready" && user && (
          <>
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#14B8A6]/15 text-[#14B8A6] flex items-center justify-center">
                  {product === "email" ? (
                    <Mail className="w-5 h-5" />
                  ) : product === "drive" ? (
                    <FolderOpen className="w-5 h-5" />
                  ) : (
                    <FileSpreadsheet className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="text-[11px] font-bold tracking-wider text-[#14B8A6]">THUMBS UP API</div>
                  <h1 className="text-2xl font-bold text-[#F1F5F9] leading-tight">
                    {product === "email" ? "ThumbsUp Email" : product === "drive" ? "ThumbsUp Drive Assets" : "ThumbsUp Sheets"}
                  </h1>
                </div>
              </div>
              <div className="flex items-center gap-1 p-1 rounded-2xl border border-[#F1F5F9]/12">
                {(
                  [
                    ["email", "Email API", Mail],
                    ["drive", "Drive Assets", FolderOpen],
                    ["sheets", "Sheets", FileSpreadsheet],
                  ] as const
                ).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    onClick={() => setProduct(id)}
                    className={cx(
                      "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold cursor-pointer transition-colors",
                      product === id ? "codos-cta-btn bg-[#14B8A6] text-[#0F172A]" : "text-[#F1F5F9]/70 hover:text-[#14B8A6]"
                    )}
                  >
                    <Icon className="w-4 h-4" /> {label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-bold text-[#F1F5F9]">{user.name}</div>
                  <div className="text-[11px] text-[#F1F5F9]/60">
                    {user.email} · {user.plan} plan
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={logout}>
                  <LogOut className="w-3.5 h-3.5" /> Log out
                </Button>
              </div>
            </div>

            {!user.email_verified && <VerifyBanner user={user} onVerified={setUser} />}

            {product === "email" && (
              <>
            {/* Sub navigation */}
            <nav className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
              {NAV.map((n) => {
                const Icon = n.icon;
                const active = view === n.id;
                return (
                  <button
                    key={n.id}
                    onClick={() => setView(n.id)}
                    className={cx(
                      "flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all cursor-pointer",
                      active
                        ? "codos-cta-btn bg-[#14B8A6] text-[#0F172A] shadow-lg"
                        : "text-[#F1F5F9]/75 hover:bg-[#14B8A6]/10 hover:text-[#14B8A6]"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {n.label}
                  </button>
                );
              })}
            </nav>

            {view === "guide" && <EmailGuide go={setView} />}
            {view === "overview" && <OverviewView user={user} go={setView} />}
            {view === "keys" && <KeysView go={setView} />}
            {view === "templates" && <TemplatesView />}
            {view === "send" && <SendTestView go={setView} />}
            {view === "logs" && <LogsView />}
            {view === "domains" && <DomainsView verified={user.email_verified} />}
            {view === "webhooks" && <WebhooksView />}
            {view === "docs" && <DocsView go={setView} />}
              </>
            )}

            {product === "drive" && (
              <>
                <nav className="flex gap-1">
                  {(
                    [
                      ["guide", "Start here", Compass],
                      ["projects", "Projects", FolderOpen],
                      ["keys", "API Keys", KeyRound],
                    ] as const
                  ).map(([id, label, Icon]) => (
                    <button
                      key={id}
                      onClick={() => setDriveView(id)}
                      className={cx(
                        "flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-all",
                        driveView === id ? "codos-cta-btn bg-[#14B8A6] text-[#0F172A] shadow-lg" : "text-[#F1F5F9]/75 hover:bg-[#14B8A6]/10 hover:text-[#14B8A6]"
                      )}
                    >
                      <Icon className="w-4 h-4" /> {label}
                    </button>
                  ))}
                </nav>
                {driveView === "guide" && <DriveGuide goProjects={() => setDriveView("projects")} goKeys={() => setDriveView("keys")} />}
                {driveView === "projects" && <DriveAssetsView verified={user.email_verified} />}
                {driveView === "keys" && <KeysView go={() => setDriveView("projects")} />}
              </>
            )}

            {product === "sheets" && (
              <>
                <nav className="flex gap-1">
                  {(
                    [
                      ["guide", "Start here", Compass],
                      ["sheets", "Sheets", FileSpreadsheet],
                      ["keys", "API Keys", KeyRound],
                    ] as const
                  ).map(([id, label, Icon]) => (
                    <button
                      key={id}
                      onClick={() => setSheetsView(id)}
                      className={cx(
                        "flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-all",
                        sheetsView === id ? "codos-cta-btn bg-[#14B8A6] text-[#0F172A] shadow-lg" : "text-[#F1F5F9]/75 hover:bg-[#14B8A6]/10 hover:text-[#14B8A6]"
                      )}
                    >
                      <Icon className="w-4 h-4" /> {label}
                    </button>
                  ))}
                </nav>
                {sheetsView === "guide" && <SheetsGuide goSheets={() => setSheetsView("sheets")} goKeys={() => setSheetsView("keys")} />}
                {sheetsView === "sheets" && <SheetsView />}
                {sheetsView === "keys" && <KeysView go={() => setSheetsView("sheets")} />}
              </>
            )}
          </>
        )}
      </div>
    </ToastProvider>
  );
}

function VerifyBanner({ user, onVerified }: { user: TuUser; onVerified: (u: TuUser) => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await tuFetch<{ user: TuUser }>("/dashboard/auth/verify", { json: { code } });
      onVerified(r.user);
    } catch (err) {
      setMsg({ tone: "error", text: errorText(err) });
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setMsg(null);
    try {
      await tuFetch("/dashboard/auth/verify/resend", { method: "POST" });
      setMsg({ tone: "success", text: `New code sent to ${user.email}.` });
    } catch (err) {
      setMsg({ tone: "error", text: errorText(err) });
    }
  };

  return (
    <Card className="p-5 border-amber-500/40">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
        <div className="flex items-start gap-3">
          <MailCheck className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-bold text-[#F1F5F9]">Please verify your email address</div>
            <div className="text-xs text-[#F1F5F9]/70 mt-0.5">
              We sent a 6-digit code to <b>{user.email}</b>. Until you verify, emails can only go to your own address.
            </div>
          </div>
        </div>
        <form onSubmit={verify} className="flex gap-2 shrink-0">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
            placeholder="123456"
            inputMode="numeric"
            className="w-32 text-center tracking-[0.3em] font-mono"
            required
          />
          <Button type="submit" loading={busy} disabled={code.length !== 6}>
            Verify
          </Button>
          <Button type="button" variant="ghost" onClick={resend}>
            Resend
          </Button>
        </form>
      </div>
      {msg && (
        <div className="mt-3">
          <Notice tone={msg.tone}>{msg.text}</Notice>
        </div>
      )}
    </Card>
  );
}
