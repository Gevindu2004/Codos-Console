"use client";

// ThumbsUp Sheets: use a Google Sheet as a database.
// Columns come from code (SQL, HTML forms, React, JSON, CSV) or the editor, never typed into the sheet by hand.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Code2,
  Columns3,
  ExternalLink,
  FileSpreadsheet,
  History,
  Link2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Table2,
  Trash2,
  Wand2,
} from "lucide-react";
import {
  THUMBSUP_API_URL,
  tuFetch,
  TuColumnType,
  TuSheetApply,
  TuSheetColumn,
  TuSheetConfig,
  TuSheetConnection,
  TuSheetDatabase,
  TuSheetDetect,
  TuSheetEvent,
  TuSheetMigration,
  TuSheetRow,
  TuSheetTable,
  timeAgo,
} from "./api";
import { useTuData } from "./hooks";
import {
  Button,
  Card,
  CodeBlock,
  CopyButton,
  EmptyState,
  Field,
  Input,
  Modal,
  Notice,
  SectionHeader,
  Select,
  Spinner,
  TabBar,
  Tag,
  TextArea,
  Toggle,
  cx,
  errorText,
  useToast,
} from "./ui";

const TYPE_LABEL: Record<TuColumnType, string> = {
  text: "Text",
  number: "Number",
  boolean: "Yes / No",
  email: "Email",
  url: "Web address",
  phone: "Phone",
  date: "Date",
  datetime: "Date & time",
};
const TYPES = Object.keys(TYPE_LABEL) as TuColumnType[];

const RETURN_ERRORS: Record<string, string> = {
  cancelled: "Google sign-in was cancelled.",
  permission_missing: "Please allow ThumbsUp to see the sheets you create or pick with it (the checkbox on Google's screen).",
  state_mismatch: "That sign-in link expired or was opened in another browser. Please try again.",
  expired: "That sign-in took too long. Please try again.",
  not_logged_in: "Your ThumbsUp session ended. Log in and connect again.",
  no_refresh_token: "Google didn't give long-term access. Remove ThumbsUp at myaccount.google.com/permissions and connect again.",
  google_error: "Google sign-in didn't work. Please try again.",
  not_configured: "Sign in with Google isn't set up on this server yet.",
};

export function SheetsView() {
  const config = useTuData<TuSheetConfig>("/dashboard/sheets/config");
  const [openId, setOpenId] = useState<string | null>(null);
  const toast = useToast();
  // Read once, before the address bar is tidied below
  const [justConnected] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tu_sheets") === "connected"
  );

  // Coming back from Google sign-in
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ok = params.get("tu_sheets");
    const err = params.get("tu_sheets_error");
    if (!ok && !err) return;
    if (ok === "connected") toast("success", "Google account connected. Now create or pick a sheet.");
    if (err) toast("error", RETURN_ERRORS[err] || "Google sign-in didn't complete.");
    ["tu_sheets", "tu_sheets_error", "account"].forEach((k) => params.delete(k));
    const q = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (q ? `?${q}` : ""));
  }, [toast]);

  if (config.error) return <Notice tone="error">{config.error}</Notice>;
  if (!config.data) return <Spinner />;
  if (!config.data.oauth_enabled && !config.data.robot_enabled) return <SetupNeeded />;
  if (openId) return <DatabaseDetail id={openId} config={config.data} onBack={() => setOpenId(null)} />;
  return <DatabaseList config={config.data} onOpen={setOpenId} justConnected={justConnected} />;
}

// ====================================================================== setup
function SetupNeeded() {
  return (
    <Card className="p-8 space-y-4 max-w-3xl">
      <div className="flex items-center gap-3">
        <FileSpreadsheet className="w-6 h-6 text-amber-500" />
        <h2 className="text-lg font-bold text-[#F1F5F9]">Sheets needs one-time setup on the server</h2>
      </div>
      <p className="text-sm text-[#F1F5F9]/75">
        Customers connect their Google account with <b>Sign in with Google</b>. The server admin creates a Google OAuth client once:
      </p>
      <ol className="text-sm text-[#F1F5F9]/80 space-y-2 list-decimal pl-5">
        <li>
          In <b>console.cloud.google.com</b>, enable the <b>Google Sheets API</b> (and the <b>Google Picker API</b> for picking existing sheets).
        </li>
        <li>
          <b>APIs &amp; Services → OAuth consent screen</b>: add the scope <code className="font-mono">drive.file</code> (it&apos;s non-sensitive).
        </li>
        <li>
          <b>Credentials → Create → OAuth client ID → Web application</b>. Redirect URI:{" "}
          <code className="font-mono">{THUMBSUP_API_URL}/dashboard/sheets/google/callback</code>
        </li>
        <li>
          Add to <code className="font-mono">thumbsup-api/.env</code> and restart:
        </li>
      </ol>
      <CodeBlock
        language=".env"
        code={"GOOGLE_OAUTH_CLIENT_ID=...apps.googleusercontent.com\nGOOGLE_OAUTH_CLIENT_SECRET=...\nDATA_ENCRYPTION_KEY=<32+ random characters>"}
      />
    </Card>
  );
}

// ====================================================================== list
const DB_STATUS: Record<TuSheetDatabase["status"], [string, string]> = {
  active: ["Connected", "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"],
  needs_verification: ["Needs verification", "bg-amber-500/15 text-amber-500 border-amber-500/30"],
  no_access: ["Lost access", "bg-red-500/15 text-red-500 border-red-500/30"],
  error: ["Problem", "bg-red-500/15 text-red-500 border-red-500/30"],
};

function DbStatus({ d }: { d: TuSheetDatabase }) {
  const [label, cls] = DB_STATUS[d.status];
  return (
    <span className={cx("inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold", cls)}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

function DatabaseList({ config, onOpen, justConnected }: { config: TuSheetConfig; onOpen: (id: string) => void; justConnected: boolean }) {
  const list = useTuData<{ databases: TuSheetDatabase[] }>("/dashboard/sheets/databases");
  // Just came back from Google: open the connect window on the "choose a sheet" step
  const [connecting, setConnecting] = useState(justConnected);

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Sheets"
        subtitle="Use a Google Sheet as a database. Your app adds, reads, updates and deletes rows through one API. Columns are created from your code, so you never type them by hand."
        action={
          <Button onClick={() => setConnecting(true)}>
            <Plus className="w-4 h-4" /> Connect a sheet
          </Button>
        }
      />
      {list.error && <Notice tone="error">{list.error}</Notice>}
      {!list.data ? (
        <Spinner />
      ) : list.data.databases.length === 0 ? (
        <>
          <HowItWorks />
          <EmptyState
            icon={<FileSpreadsheet className="w-6 h-6" />}
            title="No sheets connected yet"
            text="Connect your Google account and ThumbsUp creates the sheet for you. It takes about a minute."
            action={
              <Button onClick={() => setConnecting(true)}>
                <Plus className="w-4 h-4" /> Connect a sheet
              </Button>
            }
          />
        </>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {list.data.databases.map((d) => (
            <button key={d.id} onClick={() => onOpen(d.id)} className="text-left cursor-pointer">
              <Card className="p-5 h-full hover:border-[#14B8A6]/50 transition-colors space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-[#F1F5F9] truncate">{d.name}</div>
                      <div className="text-[11px] text-[#F1F5F9]/60 truncate">
                        {d.auth_mode === "oauth" ? d.google_email : "Shared with the robot"}
                      </div>
                    </div>
                  </div>
                  <DbStatus d={d} />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {d.tables.length === 0 ? (
                    <Tag tone="slate">No tables yet</Tag>
                  ) : (
                    d.tables.slice(0, 6).map((t) => (
                      <Tag key={t.id}>
                        {t.name} · {t.row_count}
                      </Tag>
                    ))
                  )}
                </div>
                {(d.pending_writes > 0 || d.failed_writes > 0) && (
                  <div className="text-[11px] text-[#F1F5F9]/65">
                    {d.pending_writes > 0 && <span>{d.pending_writes} writes on the way to Google · </span>}
                    {d.failed_writes > 0 && <span className="text-red-500 font-bold">{d.failed_writes} failed</span>}
                  </div>
                )}
              </Card>
            </button>
          ))}
        </div>
      )}
      <ConnectModal
        open={connecting}
        config={config}
        onClose={() => setConnecting(false)}
        onDone={(d) => {
          setConnecting(false);
          list.reload();
          onOpen(d.id);
        }}
      />
    </div>
  );
}

function HowItWorks() {
  const steps = [
    ["Connect", "Sign in with Google. ThumbsUp makes a new sheet in your Drive (or uses one you pick)."],
    ["Set the columns", "Paste your form's HTML, React code, SQL or JSON. We find the column names and add them."],
    ["Use the API", "Your app saves and reads rows with one API key. Delete a column and the rest move left by themselves."],
  ];
  return (
    <div className="grid md:grid-cols-3 gap-3">
      {steps.map(([title, text], i) => (
        <Card key={title} className="p-4">
          <div className="text-[11px] font-bold text-[#14B8A6]">STEP {i + 1}</div>
          <div className="font-bold text-[#F1F5F9] mt-1">{title}</div>
          <p className="text-xs text-[#F1F5F9]/70 mt-1 leading-relaxed">{text}</p>
        </Card>
      ))}
    </div>
  );
}

// ====================================================================== connect
async function startGoogle(toast: (t: "success" | "error", s: string) => void) {
  try {
    const r = await tuFetch<{ url: string }>("/dashboard/sheets/google/start", { method: "POST" });
    window.location.href = r.url;
  } catch (err) {
    toast("error", errorText(err));
  }
}

function ConnectModal({
  open,
  config,
  onClose,
  onDone,
}: {
  open: boolean;
  config: TuSheetConfig;
  onClose: () => void;
  onDone: (d: TuSheetDatabase) => void;
}) {
  const toast = useToast();
  const conns = useTuData<{ connections: TuSheetConnection[] }>(open ? "/dashboard/sheets/connections" : null);
  const [method, setMethod] = useState<"google" | "robot">(config.oauth_enabled ? "google" : "robot");
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [account, setAccount] = useState("");
  const [name, setName] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = useMemo(() => (conns.data?.connections || []).filter((c) => c.status === "active"), [conns.data]);
  const selected = active.some((c) => c.id === account) ? account : active[active.length - 1]?.id || "";

  const pick = async () => {
    if (!config.picker || !selected) return;
    setError(null);
    try {
      const { access_token } = await tuFetch<{ access_token: string }>(`/dashboard/sheets/connections/${selected}/picker-token`, {
        method: "POST",
      });
      const id = await openGooglePicker(access_token, config.picker.api_key, config.picker.app_id);
      if (id) setLink(id);
    } catch (err) {
      setError(errorText(err));
    }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body =
        method === "robot"
          ? { name, mode: "robot", spreadsheet: link }
          : { name, mode, connection_id: selected, spreadsheet: mode === "existing" ? link : "" };
      const d = await tuFetch<TuSheetDatabase>("/dashboard/sheets/databases", { json: body });
      toast("success", mode === "new" && method === "google" ? "Sheet created in your Google Drive." : "Sheet connected.");
      setName("");
      setLink("");
      onDone(d);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Connect a Google Sheet" wide>
      {config.oauth_enabled && config.robot_enabled && (
        <div className="grid sm:grid-cols-2 gap-3">
          {(
            [
              ["google", "Sign in with Google", "Recommended. Fast, and ThumbsUp only sees the sheets you create or pick here."],
              ["robot", "Share with our robot", "Share an existing sheet with our robot email. Simple, but slower for busy apps."],
            ] as const
          ).map(([id, title, text]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMethod(id)}
              className={cx(
                "text-left rounded-xl border p-4 cursor-pointer transition-colors",
                method === id ? "border-[#14B8A6] bg-[#14B8A6]/10" : "border-[#F1F5F9]/15 hover:border-[#14B8A6]/50"
              )}
            >
              <div className="text-sm font-bold text-[#F1F5F9]">{title}</div>
              <div className="text-xs text-[#F1F5F9]/65 mt-1">{text}</div>
            </button>
          ))}
        </div>
      )}

      {method === "google" && !conns.data && <Spinner />}
      {method === "google" && conns.data && active.length === 0 && (
        <div className="space-y-3">
          <Notice title="First, connect your Google account">
            Google will ask you to let ThumbsUp &quot;see, edit, create and delete only the specific Google Drive files you use with this
            app&quot;. ThumbsUp can&apos;t see anything else in your Drive.
          </Notice>
          <Button onClick={() => startGoogle(toast)}>
            <GoogleG /> Continue with Google
          </Button>
        </div>
      )}

      {(method === "robot" || (method === "google" && active.length > 0)) && (
        <form onSubmit={create} className="space-y-4">
          {method === "google" && (
            <>
              <Field label="Google account">
                <div className="flex gap-2">
                  <Select value={selected} onChange={(e) => setAccount(e.target.value)}>
                    {active.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.google_email}
                      </option>
                    ))}
                  </Select>
                  <Button type="button" variant="secondary" onClick={() => startGoogle(toast)}>
                    Add another
                  </Button>
                </div>
              </Field>
              <TabBar
                tabs={[
                  { id: "new", label: "Create a new sheet" },
                  { id: "existing", label: "Use an existing sheet" },
                ]}
                value={mode}
                onChange={setMode}
              />
            </>
          )}

          <Field label="Name" help={method === "google" && mode === "new" ? "Also the spreadsheet's name in Google Drive." : "Only shown in ThumbsUp."}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Website leads" maxLength={120} required />
          </Field>

          {method === "google" && mode === "existing" && (
            <Field
              label="Spreadsheet"
              help={
                config.picker
                  ? "Pick it from your Drive. ThumbsUp gets access to that one file only."
                  : "Paste the link. (Only sheets created through ThumbsUp work without the picker; ask the admin to enable the Google Picker.)"
              }
            >
              <div className="flex gap-2">
                <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…" required />
                {config.picker && (
                  <Button type="button" variant="secondary" onClick={pick}>
                    <FileSpreadsheet className="w-4 h-4" /> Pick from Drive
                  </Button>
                )}
              </div>
            </Field>
          )}

          {method === "robot" && (
            <>
              <Notice title="1. Share the sheet with our robot">
                In Google Sheets click <b>Share</b>, add this email as <b>Editor</b>, then paste the sheet&apos;s link below.
                <div className="flex items-center gap-2 mt-2">
                  <code className="font-mono text-[#14B8A6] text-xs break-all">{config.robot_email}</code>
                  <CopyButton value={config.robot_email || ""} />
                </div>
              </Notice>
              <Field label="2. Spreadsheet link">
                <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…" required />
              </Field>
            </>
          )}

          {error && <Notice tone="error">{error}</Notice>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              {method === "google" && mode === "new" ? "Create sheet" : "Connect"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" className="w-4 h-4" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}

// Google's file picker (loaded only when used)
type PickerData = { action: string; docs?: { id: string }[] };
type PickerNs = {
  PickerBuilder: new () => {
    addView: (v: unknown) => PickerBuilderT;
  };
  ViewId: { SPREADSHEETS: unknown };
  Action: { PICKED: string; CANCEL: string };
};
type PickerBuilderT = {
  addView: (v: unknown) => PickerBuilderT;
  setOAuthToken: (t: string) => PickerBuilderT;
  setDeveloperKey: (k: string) => PickerBuilderT;
  setAppId: (a: string) => PickerBuilderT;
  setCallback: (cb: (d: PickerData) => void) => PickerBuilderT;
  build: () => { setVisible: (v: boolean) => void };
};

function openGooglePicker(token: string, apiKey: string, appId: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const w = window as unknown as { gapi?: { load: (n: string, cb: () => void) => void }; google?: { picker: PickerNs } };
    const show = () => {
      const p = w.google!.picker;
      new p.PickerBuilder()
        .addView(p.ViewId.SPREADSHEETS)
        .setOAuthToken(token)
        .setDeveloperKey(apiKey)
        .setAppId(appId)
        .setCallback((d: PickerData) => {
          if (d.action === p.Action.PICKED) resolve(d.docs?.[0]?.id || null);
          else if (d.action === p.Action.CANCEL) resolve(null);
        })
        .build()
        .setVisible(true);
    };
    const load = () => w.gapi!.load("picker", show);
    if (w.gapi) return load();
    const s = document.createElement("script");
    s.src = "https://apis.google.com/js/api.js";
    s.onload = load;
    s.onerror = () => reject(new Error("Couldn't load Google's file picker."));
    document.body.appendChild(s);
  });
}

// ====================================================================== detail
type DetailTab = "tables" | "code" | "data" | "api" | "activity";

function DatabaseDetail({ id, config, onBack }: { id: string; config: TuSheetConfig; onBack: () => void }) {
  const toast = useToast();
  const db = useTuData<TuSheetDatabase>(`/dashboard/sheets/databases/${id}`);
  const [tab, setTab] = useState<DetailTab>("tables");
  const [settings, setSettings] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const d = db.data;

  useEffect(() => {
    if (!d || (d.pending_writes === 0 && d.status !== "needs_verification")) return;
    const t = setTimeout(db.reload, 4000);
    return () => clearTimeout(t);
  }, [d, db.reload]);

  if (db.error) return <Notice tone="error">{db.error}</Notice>;
  if (!d) return <Spinner />;

  const refresh = async () => {
    setRefreshing(true);
    try {
      db.setData(await tuFetch<TuSheetDatabase>(`/dashboard/sheets/databases/${id}/refresh`, { method: "POST" }));
      toast("success", "Up to date with Google Sheets.");
    } catch (err) {
      toast("error", errorText(err));
    } finally {
      setRefreshing(false);
    }
  };

  const tabs: { id: DetailTab; label: string; icon: typeof Table2 }[] = [
    { id: "tables", label: "Tables & columns", icon: Columns3 },
    { id: "code", label: "Columns from code", icon: Wand2 },
    { id: "data", label: "Data", icon: Table2 },
    { id: "api", label: "API & code", icon: Code2 },
    { id: "activity", label: "Activity", icon: History },
  ];

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-semibold text-[#F1F5F9]/70 hover:text-[#14B8A6] cursor-pointer">
        <ArrowLeft className="w-4 h-4" /> All sheets
      </button>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-[#F1F5F9] truncate">{d.name}</h2>
              <DbStatus d={d} />
            </div>
            <div className="text-xs text-[#F1F5F9]/60 mt-0.5">
              {d.auth_mode === "oauth" ? `Google account: ${d.google_email}` : "Shared with the ThumbsUp robot"} · synced{" "}
              {timeAgo(d.last_synced_at)}
              {d.pending_writes > 0 && ` · ${d.pending_writes} writes on the way`}
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {d.verified && (
            <a href={d.spreadsheet_url} target="_blank" rel="noopener noreferrer">
              <Button variant="secondary" size="sm">
                <ExternalLink className="w-3.5 h-3.5" /> Open in Google Sheets
              </Button>
            </a>
          )}
          <Button variant="secondary" size="sm" onClick={refresh} loading={refreshing} disabled={d.status !== "active"}>
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setSettings(true)}>
            <Pencil className="w-3.5 h-3.5" /> Settings
          </Button>
        </div>
      </div>

      {d.status === "needs_verification" && <VerifyPanel d={d} onVerified={db.setData} />}
      {d.status === "no_access" && (
        <Notice tone="error" title="ThumbsUp can't reach this sheet">
          {d.last_error} Waiting writes are kept and sent as soon as access is back.
          {d.auth_mode === "oauth" && (
            <div className="mt-2">
              <Button size="sm" onClick={() => startGoogle(toast)}>
                <GoogleG /> Reconnect Google account
              </Button>
            </div>
          )}
        </Notice>
      )}
      {d.failed_writes > 0 && <FailedWrites d={d} onRetried={db.reload} />}

      {d.status !== "needs_verification" && (
        <>
          <nav className="flex gap-1 overflow-x-auto pb-1">
            {tabs.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cx(
                    "flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold whitespace-nowrap cursor-pointer transition-all",
                    tab === t.id ? "codos-cta-btn bg-[#14B8A6] text-[#0F172A] shadow-lg" : "text-[#F1F5F9]/75 hover:bg-[#14B8A6]/10 hover:text-[#14B8A6]"
                  )}
                >
                  <Icon className="w-4 h-4" /> {t.label}
                </button>
              );
            })}
          </nav>
          {tab === "tables" && <TablesTab d={d} onChange={db.setData} goCode={() => setTab("code")} />}
          {tab === "code" && <CodeImportTab d={d} onApplied={(nd) => { db.setData(nd); setTab("tables"); }} />}
          {tab === "data" && <DataTab d={d} config={config} />}
          {tab === "api" && <ApiTab d={d} />}
          {tab === "activity" && <ActivityTab id={d.id} />}
        </>
      )}

      <SettingsModal open={settings} d={d} onClose={() => setSettings(false)} onSaved={db.setData} onDeleted={onBack} />
    </div>
  );
}

function VerifyPanel({ d, onVerified }: { d: TuSheetDatabase; onVerified: (d: TuSheetDatabase) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const check = async () => {
    setBusy(true);
    setError(null);
    try {
      onVerified(await tuFetch<TuSheetDatabase>(`/dashboard/sheets/databases/${d.id}/verify`, { method: "POST" }));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="p-6 space-y-4 border-amber-500/40">
      <div className="flex items-start gap-3">
        <ShieldCheck className="w-6 h-6 text-amber-500 shrink-0" />
        <div>
          <h3 className="font-bold text-[#F1F5F9]">One last step: prove the sheet is yours</h3>
          <p className="text-sm text-[#F1F5F9]/75 mt-1">
            Anyone could paste a link, so we check that you can edit the sheet. Add this code anywhere in the <b>spreadsheet&apos;s name</b>{" "}
            (top-left in Google Sheets), then press <b>Check now</b>. You can remove it afterwards.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <code className="font-mono text-lg font-bold text-[#14B8A6] px-3 py-1.5 rounded-lg bg-[#14B8A6]/10">{d.verification_code}</code>
        <CopyButton value={d.verification_code || ""} />
        <Button onClick={check} loading={busy}>
          Check now
        </Button>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
    </Card>
  );
}

function FailedWrites({ d, onRetried }: { d: TuSheetDatabase; onRetried: () => void }) {
  const toast = useToast();
  const retry = async () => {
    try {
      const r = await tuFetch<{ retried: number }>(`/dashboard/sheets/databases/${d.id}/retry`, { method: "POST" });
      toast("success", `Sending ${r.retried} writes again.`);
      onRetried();
    } catch (err) {
      toast("error", errorText(err));
    }
  };
  return (
    <Notice tone="error" title={`${d.failed_writes} writes couldn't be saved in Google Sheets`}>
      The Activity tab shows why. After fixing it (for example a tab that was deleted), send them again.
      <div className="mt-2">
        <Button size="sm" variant="secondary" onClick={retry}>
          <RefreshCw className="w-3.5 h-3.5" /> Try again
        </Button>
      </div>
    </Notice>
  );
}

// ---------------------------------------------------------------- tables & columns
function useApply(dbId: string, onDone: (d: TuSheetDatabase) => void) {
  const toast = useToast();
  return useCallback(
    async (path: string, method: string, json?: unknown, success?: string) => {
      try {
        const r = await tuFetch<TuSheetApply | { table: TuSheetTable }>(path, { method, json });
        if ("database" in r) onDone(r.database);
        else onDone(await tuFetch<TuSheetDatabase>(`/dashboard/sheets/databases/${dbId}`));
        if (success) toast("success", success);
        return true;
      } catch (err) {
        toast("error", errorText(err));
        return false;
      }
    },
    [dbId, onDone, toast]
  );
}

function TablesTab({ d, onChange, goCode }: { d: TuSheetDatabase; onChange: (d: TuSheetDatabase) => void; goCode: () => void }) {
  const apply = useApply(d.id, onChange);
  const [newTable, setNewTable] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 justify-between items-center">
        <p className="text-sm text-[#F1F5F9]/70">
          Each table is a tab in the spreadsheet. Its first row holds the column names. <b>id</b>, <b>created_at</b> and <b>updated_at</b> are
          added automatically.
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={goCode}>
            <Wand2 className="w-4 h-4" /> Columns from code
          </Button>
          <Button onClick={() => setNewTable(true)}>
            <Plus className="w-4 h-4" /> New table
          </Button>
        </div>
      </div>
      {d.tables.length === 0 ? (
        <EmptyState
          icon={<Columns3 className="w-6 h-6" />}
          title="No tables yet"
          text="Paste your form or your SQL and ThumbsUp creates the table with all its columns. Or add one by hand."
          action={
            <Button onClick={goCode}>
              <Wand2 className="w-4 h-4" /> Columns from code
            </Button>
          }
        />
      ) : (
        d.tables.map((t) => <TableCard key={t.id} t={t} apply={apply} />)
      )}
      <NewTableModal open={newTable} onClose={() => setNewTable(false)} dbId={d.id} apply={apply} />
    </div>
  );
}

type ApplyFn = (path: string, method: string, json?: unknown, success?: string) => Promise<boolean>;

function TableCard({ t, apply }: { t: TuSheetTable; apply: ApplyFn }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<TuSheetColumn | null>(null);
  const [deleting, setDeleting] = useState<TuSheetColumn | null>(null);
  const [dropTable, setDropTable] = useState(false);
  const [rename, setRename] = useState<string | null>(null);
  const base = `/dashboard/sheets/tables/${t.id}`;

  const move = (c: TuSheetColumn, to: number) => apply(`${base}/columns`, "PATCH", { column: c.name, position: to }, `Moved '${c.name}'.`);

  return (
    <Card className="p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Table2 className="w-4 h-4 text-[#14B8A6]" />
          {rename === null ? (
            <h3 className="font-bold text-[#F1F5F9]">{t.name}</h3>
          ) : (
            <form
              className="flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await apply(base, "PATCH", { name: rename }, "Table renamed.")) setRename(null);
              }}
            >
              <Input value={rename} onChange={(e) => setRename(e.target.value)} className="py-1.5" maxLength={50} autoFocus />
              <Button size="sm" type="submit">
                Save
              </Button>
              <Button size="sm" variant="ghost" type="button" onClick={() => setRename(null)}>
                Cancel
              </Button>
            </form>
          )}
          <Tag tone="slate">{t.row_count} rows</Tag>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => setRename(t.name)}>
            <Pencil className="w-3.5 h-3.5" /> Rename
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDropTable(true)}>
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="flex gap-2 min-w-max pb-1">
          <SystemCol name="id" />
          {t.columns.map((c, i) => (
            <div key={c.name} className="rounded-xl border border-[#F1F5F9]/15 px-3 py-2 min-w-[150px] group">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-bold text-[#F1F5F9] truncate max-w-[140px]" title={c.name}>
                  {c.name}
                  {c.required && <span className="text-[#14B8A6]"> *</span>}
                </div>
                <div className="text-[10px] font-mono text-[#F1F5F9]/50">{String.fromCharCode(66 + i <= 90 ? 66 + i : 63)}</div>
              </div>
              <div className="text-[11px] text-[#F1F5F9]/60">{TYPE_LABEL[c.type] || c.type}</div>
              <div className="flex gap-0.5 mt-1.5 opacity-70 group-hover:opacity-100">
                <IconBtn label="Move left" disabled={i === 0} onClick={() => move(c, i - 1)}>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </IconBtn>
                <IconBtn label="Move right" disabled={i === t.columns.length - 1} onClick={() => move(c, i + 1)}>
                  <ChevronRight className="w-3.5 h-3.5" />
                </IconBtn>
                <IconBtn label="Edit" onClick={() => setEditing(c)}>
                  <Pencil className="w-3.5 h-3.5" />
                </IconBtn>
                <IconBtn label="Delete" onClick={() => setDeleting(c)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </IconBtn>
              </div>
            </div>
          ))}
          <SystemCol name="created_at" />
          <SystemCol name="updated_at" />
          <button
            onClick={() => setAdding(true)}
            className="rounded-xl border border-dashed border-[#14B8A6]/50 px-4 py-2 min-w-[120px] text-sm font-bold text-[#14B8A6] hover:bg-[#14B8A6]/10 cursor-pointer flex items-center justify-center gap-1"
          >
            <Plus className="w-4 h-4" /> Column
          </button>
        </div>
      </div>

      <Toggle
        checked={t.allow_public_insert}
        onChange={(v) => apply(base, "PATCH", { allow_public_insert: v }, v ? "Website forms can now add rows." : "Website forms turned off.")}
        label="Website forms can add rows"
        help="Lets a form on your website add rows with a public key (only from your allowed websites). Forms can never read or change data."
      />

      <ColumnModal
        open={adding}
        title={`Add a column to ${t.name}`}
        onClose={() => setAdding(false)}
        positions={t.columns.length}
        onSave={async (c) => {
          const ok = await apply(`${base}/columns`, "POST", c, `Column '${c.name}' added.`);
          if (ok) setAdding(false);
        }}
      />
      <ColumnModal
        open={!!editing}
        title={`Edit '${editing?.name}'`}
        initial={editing || undefined}
        positions={t.columns.length - 1}
        initialPosition={editing ? t.columns.findIndex((c) => c.name === editing.name) : undefined}
        onClose={() => setEditing(null)}
        onSave={async (c) => {
          if (!editing) return;
          const body: Record<string, unknown> = { column: editing.name };
          if (c.name !== editing.name) body.new_name = c.name;
          if (c.type !== editing.type || c.required !== editing.required) {
            body.type = c.type;
            body.required = c.required;
          }
          const oldPos = t.columns.findIndex((x) => x.name === editing.name);
          if (c.position !== undefined && c.position !== oldPos) body.position = c.position;
          if (Object.keys(body).length === 1) return setEditing(null);
          if (await apply(`${base}/columns`, "PATCH", body, "Column updated.")) setEditing(null);
        }}
      />
      <ConfirmModal
        open={!!deleting}
        title={`Delete the column '${deleting?.name}'?`}
        confirm="Delete column"
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting && (await apply(`${base}/columns?name=${encodeURIComponent(deleting.name)}`, "DELETE", undefined, "Column deleted."))) setDeleting(null);
        }}
      >
        Its data is deleted from the sheet in every row. The columns to its right move one place left, like deleting a column in Google Sheets.
        Your app keeps working, because the API uses column <b>names</b>, not letters.
      </ConfirmModal>
      <ConfirmModal
        open={dropTable}
        title={`Delete the table '${t.name}'?`}
        confirm="Delete table and rows"
        onClose={() => setDropTable(false)}
        onConfirm={async () => {
          if (await apply(base, "DELETE", undefined, "Table deleted.")) setDropTable(false);
        }}
      >
        The tab and <b>all its {t.row_count} rows</b> are deleted from the spreadsheet. This can&apos;t be undone (except with Google Sheets&apos; version
        history).
      </ConfirmModal>
    </Card>
  );
}

function SystemCol({ name }: { name: string }) {
  return (
    <div className="rounded-xl border border-[#F1F5F9]/10 bg-[#94A3B8]/8 px-3 py-2 min-w-[110px]" title="Added automatically by ThumbsUp">
      <div className="text-sm font-bold text-[#F1F5F9]/60">{name}</div>
      <div className="text-[11px] text-[#F1F5F9]/50">automatic</div>
    </div>
  );
}

function IconBtn({ children, label, onClick, disabled }: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="p-1 rounded-md text-[#F1F5F9]/70 hover:bg-[#14B8A6]/15 hover:text-[#14B8A6] disabled:opacity-25 cursor-pointer disabled:cursor-default"
    >
      {children}
    </button>
  );
}

type ColumnModalProps = {
  open: boolean;
  title: string;
  initial?: TuSheetColumn;
  positions: number;
  initialPosition?: number;
  onClose: () => void;
  onSave: (c: TuSheetColumn & { position?: number }) => void | Promise<void>;
};

function ColumnModal(props: ColumnModalProps) {
  return (
    <Modal open={props.open} onClose={props.onClose} title={props.title}>
      <ColumnForm {...props} />
    </Modal>
  );
}

function ColumnForm({ initial, positions, initialPosition, onClose, onSave }: ColumnModalProps) {
  // Mounted each time the window opens, so it always starts from the current values
  const [name, setName] = useState(initial?.name || "");
  const [type, setType] = useState<TuColumnType>(initial?.type || "text");
  const [required, setRequired] = useState(initial?.required || false);
  const [position, setPosition] = useState<number>(initialPosition ?? positions);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await onSave({ name: name.trim(), type, required, position });
        setBusy(false);
      }}
    >
      <Field label="Column name" help="Use the same name your code sends, e.g. email or first_name.">
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={63} required autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type" help="ThumbsUp checks values before saving them.">
          <Select value={type} onChange={(e) => setType(e.target.value as TuColumnType)}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Position">
          <Select value={position} onChange={(e) => setPosition(Number(e.target.value))}>
            {Array.from({ length: positions + 1 }, (_, i) => (
              <option key={i} value={i}>
                {i === positions && !initial ? "At the end" : `Column ${i + 1}`}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Toggle checked={required} onChange={setRequired} label="Required" help="New rows must have a value here." />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          Save
        </Button>
      </div>
    </form>
  );
}

function ConfirmModal({
  open,
  title,
  confirm,
  children,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  confirm: string;
  children: React.ReactNode;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-[#F1F5F9]/75 leading-relaxed">{children}</p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="danger"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            await onConfirm();
            setBusy(false);
          }}
        >
          <Trash2 className="w-4 h-4" /> {confirm}
        </Button>
      </div>
    </Modal>
  );
}

function NewTableModal({ open, onClose, dbId, apply }: { open: boolean; onClose: () => void; dbId: string; apply: ApplyFn }) {
  return (
    <Modal open={open} onClose={onClose} title="New table" wide>
      <NewTableForm onClose={onClose} dbId={dbId} apply={apply} />
    </Modal>
  );
}

function NewTableForm({ onClose, dbId, apply }: { onClose: () => void; dbId: string; apply: ApplyFn }) {
  const [name, setName] = useState("");
  const [cols, setCols] = useState<TuSheetColumn[]>([{ name: "", type: "text", required: false }]);
  const [busy, setBusy] = useState(false);
  return (
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const ok = await apply(
            `/dashboard/sheets/databases/${dbId}/tables`,
            "POST",
            { name: name.trim(), columns: cols.filter((c) => c.name.trim()).map((c) => ({ ...c, name: c.name.trim() })) },
            `Table '${name.trim()}' created.`
          );
          setBusy(false);
          if (ok) onClose();
        }}
      >
        <Field label="Table name" help="Becomes a new tab in the spreadsheet.">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. contacts" maxLength={50} required autoFocus />
        </Field>
        <ColumnListEditor cols={cols} onChange={setCols} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Create table
          </Button>
        </div>
      </form>
  );
}

function ColumnListEditor({ cols, onChange, allowEmpty }: { cols: TuSheetColumn[]; onChange: (c: TuSheetColumn[]) => void; allowEmpty?: boolean }) {
  const set = (i: number, patch: Partial<TuSheetColumn>) => onChange(cols.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-[#F1F5F9]/85">Columns</div>
      {cols.map((c, i) => (
        <div key={i} className="flex gap-2 items-center">
          <Input value={c.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="column name" maxLength={63} className="py-2" />
          <Select value={c.type} onChange={(e) => set(i, { type: e.target.value as TuColumnType })} className="py-2 max-w-[150px]">
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
          <label className="flex items-center gap-1.5 text-xs text-[#F1F5F9]/75 whitespace-nowrap cursor-pointer">
            <input type="checkbox" checked={c.required} onChange={(e) => set(i, { required: e.target.checked })} className="accent-[#14B8A6]" />
            Required
          </label>
          <IconBtn label="Remove" disabled={!allowEmpty && cols.length === 1} onClick={() => onChange(cols.filter((_, j) => j !== i))}>
            <Trash2 className="w-3.5 h-3.5" />
          </IconBtn>
        </div>
      ))}
      <Button type="button" size="sm" variant="secondary" onClick={() => onChange([...cols, { name: "", type: "text", required: false }])}>
        <Plus className="w-3.5 h-3.5" /> Add column
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------- columns from code
const SAMPLES: Record<string, string> = {
  html: `<form id="contacts">
  <input name="name" required>
  <input type="email" name="email" required>
  <input type="tel" name="phone">
  <textarea name="message"></textarea>
  <button type="submit">Send</button>
</form>`,
  sql: `CREATE TABLE contacts (
  name    VARCHAR(100) NOT NULL,
  email   EMAIL NOT NULL,
  phone   VARCHAR(20),
  message TEXT
);

-- later, in another migration:
-- ALTER TABLE contacts ADD COLUMN company TEXT;
-- ALTER TABLE contacts DROP COLUMN phone;`,
  js: `const [form, setForm] = useState({ name: "", email: "", plan: "free", agree: false });

await fetch(url, { method: "POST", body: JSON.stringify(form) });`,
  json: `[{ "name": "Ann", "email": "ann@example.com", "age": 34, "vip": true }]`,
};

function CodeImportTab({ d, onApplied }: { d: TuSheetDatabase; onApplied: (d: TuSheetDatabase) => void }) {
  const toast = useToast();
  const [code, setCode] = useState("");
  const [tableName, setTableName] = useState("");
  const [detected, setDetected] = useState<TuSheetDetect | null>(null);
  const [plan, setPlan] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSql = detected?.kind === "sql";

  const detect = async () => {
    setBusy(true);
    setError(null);
    setPlan(null);
    try {
      const r = await tuFetch<TuSheetDetect>("/dashboard/sheets/detect", { json: { code, table: tableName.trim() } });
      setDetected(r);
      // Show what would really change in this spreadsheet
      const p = await tuFetch<TuSheetApply>(`/dashboard/sheets/databases/${d.id}/schema`, {
        json: { changes: r.changes, dry_run: true },
      });
      setPlan(p.descriptions);
    } catch (err) {
      setDetected(null);
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const updateTable = (i: number, patch: Partial<{ table: string; columns: TuSheetColumn[] }>) => {
    if (!detected) return;
    setDetected({ ...detected, changes: detected.changes.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
    setPlan(null);
  };

  const review = async () => {
    if (!detected) return;
    setBusy(true);
    setError(null);
    try {
      const p = await tuFetch<TuSheetApply>(`/dashboard/sheets/databases/${d.id}/schema`, { json: { changes: detected.changes, dry_run: true } });
      setPlan(p.descriptions);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const applyNow = async () => {
    if (!detected) return;
    setBusy(true);
    setError(null);
    try {
      const r = await tuFetch<TuSheetApply>(`/dashboard/sheets/databases/${d.id}/schema`, { json: { changes: detected.changes } });
      toast("success", r.steps.length ? `Done: ${r.steps.length} change${r.steps.length > 1 ? "s" : ""} made in Google Sheets.` : "Nothing to change.");
      setDetected(null);
      setPlan(null);
      setCode("");
      onApplied(r.database);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <Card className="p-5 space-y-4">
        <div>
          <h3 className="font-bold text-[#F1F5F9]">Paste your code</h3>
          <p className="text-xs text-[#F1F5F9]/65 mt-1">
            HTML forms, React / Vue / plain JavaScript, SQL migrations (CREATE / ALTER / DROP TABLE), JSON or a CSV header. ThumbsUp only reads it.
            Nothing is run.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Object.keys(SAMPLES).map((k) => (
            <Button key={k} size="sm" variant="ghost" onClick={() => setCode(SAMPLES[k])}>
              Example: {k.toUpperCase()}
            </Button>
          ))}
        </div>
        <TextArea value={code} onChange={(e) => setCode(e.target.value)} rows={14} placeholder="<form> … </form>   or   CREATE TABLE …" spellCheck={false} />
        <Field label="Table name" optional help="For forms and JSON without a name. Default: the form's id, or 'submissions'.">
          <Input value={tableName} onChange={(e) => setTableName(e.target.value)} placeholder="e.g. contacts" maxLength={50} />
        </Field>
        <Button onClick={detect} loading={busy && !detected} disabled={!code.trim()}>
          <Search className="w-4 h-4" /> Find columns
        </Button>
      </Card>

      <Card className="p-5 space-y-4">
        <h3 className="font-bold text-[#F1F5F9]">Check and apply</h3>
        {!detected && !error && <p className="text-sm text-[#F1F5F9]/60">The columns we find show up here. You can fix them before anything changes.</p>}
        {error && <Notice tone="error">{error}</Notice>}
        {detected && (
          <>
            <Tag>{detected.kind.toUpperCase()}</Tag>
            {detected.warnings.length > 0 && (
              <Notice tone="warning">
                {detected.warnings.slice(0, 6).map((w) => (
                  <div key={w}>{w}</div>
                ))}
              </Notice>
            )}
            {!isSql &&
              detected.changes.map((c, i) =>
                c.op === "create_table" ? (
                  <div key={i} className="space-y-2 rounded-xl border border-[#F1F5F9]/12 p-3">
                    <Field label="Table">
                      <Input value={c.table} onChange={(e) => updateTable(i, { table: e.target.value })} maxLength={50} />
                    </Field>
                    <ColumnListEditor cols={c.columns || []} onChange={(cols) => updateTable(i, { columns: cols })} allowEmpty />
                  </div>
                ) : null
              )}
            {!isSql && (
              <Button variant="secondary" size="sm" onClick={review} loading={busy && !plan}>
                Check changes again
              </Button>
            )}
            {plan && (
              <div className="space-y-2">
                <div className="text-xs font-bold text-[#F1F5F9]/85">This will happen in Google Sheets:</div>
                {plan.length === 0 ? (
                  <Notice tone="success">Everything is already there. Nothing to change.</Notice>
                ) : (
                  <ul className="space-y-1.5">
                    {plan.map((p) => (
                      <li key={p} className={cx("text-sm flex gap-2", p.startsWith("Delete") ? "text-red-500" : "text-[#F1F5F9]/85")}>
                        {p.startsWith("Delete") ? <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> : <Plus className="w-4 h-4 shrink-0 mt-0.5 text-[#14B8A6]" />}
                        {p}
                      </li>
                    ))}
                  </ul>
                )}
                {plan.length > 0 && (
                  <Button onClick={applyNow} loading={busy}>
                    <Wand2 className="w-4 h-4" /> Apply to Google Sheets
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- data
function DataTab({ d, config }: { d: TuSheetDatabase; config: TuSheetConfig }) {
  const toast = useToast();
  const [tableId, setTableId] = useState(d.tables[0]?.id || "");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<TuSheetRow | "new" | null>(null);
  const [deleting, setDeleting] = useState<TuSheetRow | null>(null);
  const pageSize = 50;
  const path = tableId
    ? `/dashboard/sheets/tables/${tableId}/rows?limit=${pageSize}&offset=${page * pageSize}${query ? `&search=${encodeURIComponent(query)}` : ""}`
    : null;
  const rows = useTuData<{ rows: TuSheetRow[]; total: number; stale: boolean; table: TuSheetTable }>(path);
  const table = rows.data?.table || d.tables.find((t) => t.id === tableId);

  if (d.tables.length === 0) {
    return <EmptyState icon={<Table2 className="w-6 h-6" />} title="No tables yet" text="Create a table first (Tables & columns, or Columns from code)." />;
  }

  const remove = async () => {
    if (!deleting) return;
    try {
      await tuFetch(`/dashboard/sheets/tables/${tableId}/rows/${deleting.id}`, { method: "DELETE" });
      toast("success", "Row deleted.");
      setDeleting(null);
      rows.reload();
    } catch (err) {
      toast("error", errorText(err));
    }
  };

  const total = rows.data?.total || 0;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 items-center flex-wrap">
          <Select
            value={tableId}
            onChange={(e) => {
              setTableId(e.target.value);
              setPage(0);
            }}
            className="w-auto py-2"
          >
            {d.tables.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPage(0);
              setQuery(search);
            }}
            className="flex gap-2"
          >
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="py-2 w-48" />
          </form>
          {rows.data?.stale && <Tag tone="violet">Showing saved copy (Google is busy)</Tag>}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={rows.reload}>
            <RefreshCw className="w-3.5 h-3.5" /> Reload
          </Button>
          <Button size="sm" onClick={() => setEditing("new")} disabled={!table || table.columns.length === 0 || d.status !== "active"}>
            <Plus className="w-3.5 h-3.5" /> Add row
          </Button>
        </div>
      </div>

      {rows.error && <Notice tone="error">{rows.error}</Notice>}
      {!rows.data ? (
        <Spinner />
      ) : rows.data.rows.length === 0 ? (
        <EmptyState
          icon={<Table2 className="w-6 h-6" />}
          title={query ? "Nothing matches" : "No rows yet"}
          text={query ? "Try another search." : "Rows your app saves show up here (and in the Google Sheet)."}
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-[#F1F5F9]/60 border-b border-[#F1F5F9]/10">
                {table?.columns.map((c) => (
                  <th key={c.name} className="px-3 py-2.5 font-bold whitespace-nowrap">
                    {c.name}
                  </th>
                ))}
                <th className="px-3 py-2.5 font-bold whitespace-nowrap">updated</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.data.rows.map((r) => (
                <tr key={r.id} className="border-b border-[#F1F5F9]/10 hover:bg-[#14B8A6]/5">
                  {table?.columns.map((c) => (
                    <td key={c.name} className="px-3 py-2 text-[#F1F5F9]/85 max-w-[240px] truncate" title={cellText(r[c.name])}>
                      {cellText(r[c.name])}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-[11px] text-[#F1F5F9]/60 whitespace-nowrap">{timeAgo(r.updated_at)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-right">
                    <IconBtn label="Edit" onClick={() => setEditing(r)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </IconBtn>
                    <IconBtn label="Delete" onClick={() => setDeleting(r)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </IconBtn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {total > pageSize && (
        <div className="flex items-center justify-end gap-2 text-xs text-[#F1F5F9]/65">
          {page * pageSize + 1}–{Math.min(total, (page + 1) * pageSize)} of {total}
          <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" variant="secondary" disabled={(page + 1) * pageSize >= total} onClick={() => setPage(page + 1)}>
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {table && (
        <RowModal
          open={editing !== null}
          table={table}
          row={editing === "new" ? null : editing}
          maxLen={config.limits.max_batch}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            rows.reload();
          }}
        />
      )}
      <ConfirmModal open={!!deleting} title="Delete this row?" confirm="Delete row" onClose={() => setDeleting(null)} onConfirm={remove}>
        The row is removed from the Google Sheet too, and the rows below it move up.
      </ConfirmModal>
    </div>
  );
}

function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

type RowModalProps = {
  open: boolean;
  table: TuSheetTable;
  row: TuSheetRow | null;
  maxLen: number;
  onClose: () => void;
  onSaved: () => void;
};

function RowModal(props: RowModalProps) {
  return (
    <Modal open={props.open} onClose={props.onClose} title={props.row ? "Edit row" : `Add a row to ${props.table.name}`} wide>
      <RowForm {...props} />
    </Modal>
  );
}

function RowForm({ table, row, onClose, onSaved }: RowModalProps) {
  const toast = useToast();
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const v: Record<string, unknown> = {};
    table.columns.forEach((c) => (v[c.name] = row ? row[c.name] ?? (c.type === "boolean" ? false : "") : c.type === "boolean" ? false : ""));
    return v;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body: Record<string, unknown> = {};
    table.columns.forEach((c) => {
      const v = values[c.name];
      body[c.name] = v === "" ? null : v;
    });
    try {
      if (row) await tuFetch(`/dashboard/sheets/tables/${table.id}/rows/${row.id}`, { method: "PATCH", json: body });
      else await tuFetch(`/dashboard/sheets/tables/${table.id}/rows`, { json: body });
      toast("success", row ? "Row saved." : "Row added.");
      onSaved();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const inputType: Record<string, string> = { number: "number", email: "email", url: "url", phone: "tel", date: "date", datetime: "datetime-local" };
  return (
      <form onSubmit={save} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          {table.columns.map((c) =>
            c.type === "boolean" ? (
              <div key={c.name} className="pt-5">
                <Toggle checked={!!values[c.name]} onChange={(v) => setValues({ ...values, [c.name]: v })} label={c.name} />
              </div>
            ) : (
              <Field key={c.name} label={`${c.name}${c.required ? " *" : ""}`} help={TYPE_LABEL[c.type]}>
                <Input
                  type={inputType[c.type] || "text"}
                  value={values[c.name] === null || values[c.name] === undefined ? "" : String(values[c.name])}
                  onChange={(e) =>
                    setValues({
                      ...values,
                      [c.name]: c.type === "number" && e.target.value !== "" ? Number(e.target.value) : e.target.value,
                    })
                  }
                  step={c.type === "number" ? "any" : undefined}
                  required={c.required}
                />
              </Field>
            )
          )}
        </div>
        {row && <div className="text-[11px] font-mono text-[#F1F5F9]/50">id: {row.id}</div>}
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            {row ? "Save" : "Add row"}
          </Button>
        </div>
      </form>
  );
}

// ---------------------------------------------------------------- API & code
function ApiTab({ d }: { d: TuSheetDatabase }) {
  const [lang, setLang] = useState<"js" | "python" | "curl" | "form" | "migrate">("js");
  const t = d.tables[0];
  const tname = t ? encodeURIComponent(t.name) : "contacts";
  const sample = t?.columns.length
    ? Object.fromEntries(t.columns.slice(0, 4).map((c) => [c.name, sampleValue(c.type)]))
    : { name: "Ann", email: "ann@example.com" };
  const base = `${THUMBSUP_API_URL}/v1/sheets/${d.id}/${tname}/rows`;
  const json = JSON.stringify(sample, null, 2);

  const code = {
    js: `const KEY = process.env.THUMBSUP_SECRET_KEY; // tu_sk_...  (server only!)
const url = "${base}";
const headers = { Authorization: \`Bearer \${KEY}\`, "Content-Type": "application/json" };

// Add a row
const { row } = await fetch(url, { method: "POST", headers, body: JSON.stringify(${json.replace(/\n/g, "\n  ")}) }).then(r => r.json());

// Read rows (filter, search, sort, pages)
const { rows, total } = await fetch(\`\${url}?limit=50&sort=created_at&order=desc\`, { headers }).then(r => r.json());

// Update / delete one row by its id
await fetch(\`\${url}/\${row.id}\`, { method: "PATCH", headers, body: JSON.stringify({ ${Object.keys(sample)[0] ? `"${Object.keys(sample)[0]}": ${JSON.stringify(sample[Object.keys(sample)[0]])}` : ""} }) });
await fetch(\`\${url}/\${row.id}\`, { method: "DELETE", headers });`,
    python: `import os, requests

KEY = os.environ["THUMBSUP_SECRET_KEY"]  # tu_sk_...
url = "${base}"
h = {"Authorization": f"Bearer {KEY}"}

row = requests.post(url, json=${json.replace(/true/g, "True").replace(/false/g, "False")}, headers=h).json()["row"]
rows = requests.get(url, params={"limit": 50, "search": "ann"}, headers=h).json()["rows"]
requests.patch(f"{url}/{row['id']}", json={"${Object.keys(sample)[0] || "name"}": ${JSON.stringify(sample[Object.keys(sample)[0]] ?? "x")}}, headers=h)
requests.delete(f"{url}/{row['id']}", headers=h)`,
    curl: `curl -X POST "${base}?wait=true" \\
  -H "Authorization: Bearer tu_sk_..." -H "Content-Type: application/json" \\
  -d '${JSON.stringify(sample)}'

curl "${base}?filter[${Object.keys(sample)[0] || "email"}]=…&limit=20" -H "Authorization: Bearer tu_sk_..."`,
    form: `<!-- Turn on "Website forms can add rows" for the table, and create a PUBLIC key
     that lists your website. Forms can only ADD rows. -->
<form action="${t?.submit_url || `${THUMBSUP_API_URL}/v1/sheets/submit/tbl_...`}" method="POST">
  <input type="hidden" name="public_key" value="tu_pk_...">
  <input type="hidden" name="_redirect" value="https://your-site.com/thanks">
${(t?.columns || []).slice(0, 6).map((c) => `  <input name="${c.name}"${c.required ? " required" : ""}>`).join("\n") || '  <input name="email">'}
  <input type="text" name="_gotcha" style="display:none"> <!-- spam trap -->
  <button>Send</button>
</form>`,
    migrate: `// migrations/002_add_company.sql runs ONCE (the name is remembered)
await fetch("${THUMBSUP_API_URL}/v1/sheets/${d.id}/migrate", {
  method: "POST",
  headers: { Authorization: \`Bearer \${KEY}\`, "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "002_add_company",
    sql: "ALTER TABLE contacts ADD COLUMN company TEXT; ALTER TABLE contacts DROP COLUMN fax;",
  }),
});`,
  };

  return (
    <div className="space-y-4">
      <Card className="p-5 grid sm:grid-cols-2 gap-4">
        <Field label="Spreadsheet id (use it in the API)">
          <div className="flex gap-2 items-center">
            <code className="font-mono text-sm text-[#14B8A6] break-all">{d.id}</code>
            <CopyButton value={d.id} />
          </div>
        </Field>
        <Field label="Tables">
          <div className="flex flex-wrap gap-1.5">
            {d.tables.map((x) => (
              <Tag key={x.id}>{x.name}</Tag>
            ))}
            {d.tables.length === 0 && <span className="text-xs text-[#F1F5F9]/60">none yet</span>}
          </div>
        </Field>
      </Card>
      <Notice>
        Use a <b>secret key</b> (API Keys tab) on your server. Writes are saved instantly in ThumbsUp and reach Google Sheets within seconds; add{" "}
        <code className="font-mono">?wait=true</code> to wait until they are in the sheet. Columns are always matched by <b>name</b>, so moving or
        deleting columns never breaks your code.
      </Notice>
      <TabBar
        tabs={[
          { id: "js", label: "JavaScript" },
          { id: "python", label: "Python" },
          { id: "curl", label: "cURL" },
          { id: "form", label: "Website form" },
          { id: "migrate", label: "Migrations" },
        ]}
        value={lang}
        onChange={setLang}
      />
      <CodeBlock language={lang === "form" ? "html" : lang === "migrate" ? "javascript" : lang} code={code[lang]} />
      <Card className="p-5 space-y-2">
        <h4 className="font-bold text-[#F1F5F9] flex items-center gap-2">
          <Link2 className="w-4 h-4 text-[#14B8A6]" /> Endpoints
        </h4>
        {[
          ["GET", "/v1/sheets/{id}/{table}/rows", "limit, offset, sort, order, search, filter[column]="],
          ["POST", "/v1/sheets/{id}/{table}/rows", "one object, or { rows: [...] } (up to 500)"],
          ["GET", "/v1/sheets/{id}/{table}/rows/{row_id}", ""],
          ["PATCH", "/v1/sheets/{id}/{table}/rows/{row_id}", "only the columns you send change"],
          ["DELETE", "/v1/sheets/{id}/{table}/rows/{row_id}", ""],
          ["POST", "/v1/sheets/{id}/migrate", "{ sql, name } runs once per name"],
        ].map(([m, p, note]) => (
          <div key={p + m} className="flex flex-wrap gap-2 items-center text-xs">
            <Tag tone={m === "GET" ? "slate" : m === "DELETE" ? "violet" : "teal"}>{m}</Tag>
            <code className="font-mono text-[#F1F5F9]/85">{p}</code>
            {note && <span className="text-[#F1F5F9]/60">{note}</span>}
          </div>
        ))}
      </Card>
    </div>
  );
}

function sampleValue(t: TuColumnType): unknown {
  return { text: "Ann", number: 42, boolean: true, email: "ann@example.com", url: "https://example.com", phone: "+94 77 123 4567", date: "2026-11-21", datetime: "2026-11-21T10:30:00Z" }[t];
}

// ---------------------------------------------------------------- activity & settings
function ActivityTab({ id }: { id: string }) {
  const events = useTuData<{ events: TuSheetEvent[] }>(`/dashboard/sheets/databases/${id}/events`);
  const migs = useTuData<{ migrations: TuSheetMigration[] }>(`/dashboard/sheets/databases/${id}/migrations`);
  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <Card className="p-5 space-y-3">
        <h3 className="font-bold text-[#F1F5F9]">Activity</h3>
        {!events.data ? (
          <Spinner />
        ) : events.data.events.length === 0 ? (
          <p className="text-sm text-[#F1F5F9]/60">Nothing yet.</p>
        ) : (
          events.data.events.map((e) => (
            <div key={e.id} className="flex gap-3 text-sm">
              {["sync_error", "access_lost"].includes(e.kind) ? (
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              ) : (
                <ArrowLeftRight className="w-4 h-4 text-[#14B8A6] shrink-0 mt-0.5" />
              )}
              <div>
                <div className="text-[#F1F5F9]/85">{e.message}</div>
                <div className="text-[11px] text-[#F1F5F9]/50">{timeAgo(e.created_at)}</div>
              </div>
            </div>
          ))
        )}
      </Card>
      <Card className="p-5 space-y-3">
        <h3 className="font-bold text-[#F1F5F9]">Column changes (migrations)</h3>
        {!migs.data ? (
          <Spinner />
        ) : migs.data.migrations.length === 0 ? (
          <p className="text-sm text-[#F1F5F9]/60">No column changes yet.</p>
        ) : (
          migs.data.migrations.map((m) => (
            <div key={m.id} className="rounded-xl border border-[#F1F5F9]/10 p-3">
              <div className="flex items-center justify-between gap-2">
                <code className="font-mono text-xs text-[#14B8A6]">{m.name}</code>
                <span className="text-[11px] text-[#F1F5F9]/50">{timeAgo(m.created_at)}</span>
              </div>
              <ul className="mt-1.5 space-y-0.5">
                {m.descriptions.map((x, i) => (
                  <li key={i} className="text-xs text-[#F1F5F9]/75">
                    • {x}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}

function SettingsModal({
  open,
  d,
  onClose,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  d: TuSheetDatabase;
  onClose: () => void;
  onSaved: (d: TuSheetDatabase) => void;
  onDeleted: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Sheet settings">
      <SettingsForm d={d} onClose={onClose} onSaved={onSaved} onDeleted={onDeleted} />
    </Modal>
  );
}

function SettingsForm({
  d,
  onClose,
  onSaved,
  onDeleted,
}: {
  d: TuSheetDatabase;
  onClose: () => void;
  onSaved: (d: TuSheetDatabase) => void;
  onDeleted: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(d.name);
  const [confirm, setConfirm] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      onSaved(await tuFetch<TuSheetDatabase>(`/dashboard/sheets/databases/${d.id}`, { method: "PATCH", json: { name } }));
      toast("success", "Saved.");
      onClose();
    } catch (err) {
      toast("error", errorText(err));
    }
  };
  const disconnect = async () => {
    try {
      await tuFetch(`/dashboard/sheets/databases/${d.id}`, { method: "DELETE" });
      toast("success", "Disconnected. The spreadsheet is still in Google Drive.");
      onClose();
      onDeleted();
    } catch (err) {
      toast("error", errorText(err));
    }
  };
  return (
    <>
      <form onSubmit={save} className="space-y-3">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
        </Field>
        <div className="flex justify-end">
          <Button type="submit">Save</Button>
        </div>
      </form>
      <div className="border-t border-[#F1F5F9]/10 pt-4 space-y-2">
        <div className="text-sm font-bold text-[#F1F5F9]">Disconnect</div>
        <p className="text-xs text-[#F1F5F9]/65">
          ThumbsUp stops using this sheet and the API stops working for it. The spreadsheet and its data stay in Google Drive.
        </p>
        {confirm ? (
          <div className="flex gap-2">
            <Button variant="danger" size="sm" onClick={disconnect}>
              Yes, disconnect
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="danger" size="sm" onClick={() => setConfirm(true)}>
            Disconnect sheet
          </Button>
        )}
      </div>
    </>
  );
}
