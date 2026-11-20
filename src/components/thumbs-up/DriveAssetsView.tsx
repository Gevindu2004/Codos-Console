"use client";

// Drive Assets: a client's Google Drive folder becomes stable website file links.

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  ExternalLink,
  File as FileIcon,
  FileText,
  Film,
  FolderOpen,
  HardDrive,
  ImageIcon,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
} from "lucide-react";
import {
  tuFetch,
  TuAssetConfig,
  TuAssetEvent,
  TuAssetFile,
  TuAssetProject,
  TuAssetUsage,
  humanSize,
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
  Spinner,
  TabBar,
  Tag,
  cx,
  errorText,
  useToast,
} from "./ui";

export function DriveAssetsView({ verified }: { verified: boolean }) {
  const config = useTuData<TuAssetConfig>("/dashboard/assets/config");
  const [openId, setOpenId] = useState<string | null>(null);

  if (config.error) return <Notice tone="error">{config.error}</Notice>;
  if (!config.data) return <Spinner />;
  if (!config.data.configured) return <SetupNeeded />;
  if (openId) return <ProjectDetail id={openId} config={config.data} onBack={() => setOpenId(null)} />;
  return <ProjectList config={config.data} onOpen={setOpenId} verified={verified} />;
}

// ---------------------------------------------------------------- not configured yet
function SetupNeeded() {
  return (
    <Card className="p-8 space-y-4 max-w-3xl">
      <div className="flex items-center gap-3">
        <HardDrive className="w-6 h-6 text-amber-500" />
        <h2 className="text-lg font-bold text-[#F1F5F9]">Drive Assets needs one-time setup on the server</h2>
      </div>
      <p className="text-sm text-[#F1F5F9]/75">
        ThumbsUp reads clients&apos; folders with its own Google &quot;robot&quot; account (a service account). The server admin creates it once:
      </p>
      <ol className="text-sm text-[#F1F5F9]/80 space-y-2 list-decimal pl-5">
        <li>
          Open <b>console.cloud.google.com</b>, create a project (e.g. <i>ThumbsUp</i>), then enable the <b>Google Drive API</b>.
        </li>
        <li>
          <b>IAM &amp; Admin → Service accounts → Create</b> (e.g. <i>assets</i>). No roles are needed.
        </li>
        <li>
          Open it → <b>Keys → Add key → JSON</b>. A file downloads.
        </li>
        <li>
          Put the file in <code className="font-mono">thumbsup-api/</code> and add to <code className="font-mono">.env</code>:
        </li>
      </ol>
      <CodeBlock language=".env" code={"GOOGLE_SERVICE_ACCOUNT_FILE=./google-service-account.json"} />
      <p className="text-xs text-[#F1F5F9]/60">Restart the ThumbsUp server, then refresh this page. Keep the JSON file secret: it&apos;s the robot&apos;s password.</p>
    </Card>
  );
}

// ---------------------------------------------------------------- list
const STATUS: Record<TuAssetProject["status"], [string, string]> = {
  syncing: ["Copying files…", "bg-amber-500/15 text-amber-500 border-amber-500/30"],
  needs_verification: ["Needs verification", "bg-amber-500/15 text-amber-500 border-amber-500/30"],
  active: ["Live", "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"],
  no_access: ["Lost access", "bg-red-500/15 text-red-500 border-red-500/30"],
  error: ["Problem", "bg-red-500/15 text-red-500 border-red-500/30"],
};

function ProjectStatus({ p }: { p: TuAssetProject }) {
  const [label, cls] = STATUS[p.status];
  return (
    <span className={cx("inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold", cls)}>
      {p.syncing && p.status !== "syncing" ? <Loader2 className="w-3 h-3 animate-spin" /> : <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {label}
    </span>
  );
}

function ProjectList({ config, onOpen, verified }: { config: TuAssetConfig; onOpen: (id: string) => void; verified: boolean }) {
  const list = useTuData<{ data: TuAssetProject[] }>("/dashboard/assets/projects");
  const [connecting, setConnecting] = useState(false);

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Drive Assets"
        subtitle="Clients keep website images, videos and documents in Google Drive. You get links that never change. When they replace a file with the same name, the website updates by itself."
        action={
          <Button onClick={() => setConnecting(true)}>
            <Plus className="w-4 h-4" /> Connect a Drive folder
          </Button>
        }
      />
      {list.error && <Notice tone="error">{list.error}</Notice>}
      {!list.data ? (
        <Spinner />
      ) : list.data.data.length === 0 ? (
        <>
          <HowItWorks />
          <EmptyState
            icon={<FolderOpen className="w-6 h-6" />}
            title="No folders connected yet"
            text="Connect your client's Google Drive folder. It takes about 2 minutes."
            action={
              <Button onClick={() => setConnecting(true)}>
                <Plus className="w-4 h-4" /> Connect a Drive folder
              </Button>
            }
          />
        </>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {list.data.data.map((p) => (
            <button key={p.id} onClick={() => onOpen(p.id)} className="text-left cursor-pointer">
              <Card className="p-5 space-y-3 hover:border-[#14B8A6]/60 transition-colors h-full">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-9 h-9 rounded-xl bg-[#14B8A6]/15 text-[#14B8A6] flex items-center justify-center shrink-0">
                      <FolderOpen className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-[#F1F5F9] truncate">{p.name}</div>
                      <div className="text-[11px] font-mono text-[#F1F5F9]/60 truncate">/a/{p.slug}/</div>
                    </div>
                  </div>
                  <ProjectStatus p={p} />
                </div>
                <div className="flex gap-4 text-xs text-[#F1F5F9]/70">
                  <span>
                    <b className="text-[#F1F5F9]">{p.file_count}</b> files
                  </span>
                  <span>{humanSize(p.total_bytes || 0)}</span>
                  <span>Checked {timeAgo(p.last_synced_at)}</span>
                </div>
              </Card>
            </button>
          ))}
        </div>
      )}
      <ConnectWizard
        open={connecting}
        config={config}
        verified={verified}
        onClose={() => setConnecting(false)}
        onCreated={(p) => {
          setConnecting(false);
          onOpen(p.id);
        }}
      />
    </div>
  );
}

function HowItWorks() {
  const steps = [
    ["Client shares a folder", "with the ThumbsUp robot email, and adds your verification file"],
    ["You paste the folder link", "ThumbsUp keeps a fast copy of every file"],
    ["Use the file links", "e.g. …/a/acme/hero.jpg in the website"],
    ["Client replaces files in Drive", "same name → the website updates in seconds"],
  ];
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {steps.map(([t, d], i) => (
        <Card key={t} className="p-4">
          <div className="text-[11px] font-bold text-[#14B8A6]">STEP {i + 1}</div>
          <div className="text-sm font-bold text-[#F1F5F9] mt-1">{t}</div>
          <div className="text-xs text-[#F1F5F9]/65 mt-0.5">{d}</div>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- connect wizard
function ConnectWizard({
  open,
  config,
  verified,
  onClose,
  onCreated,
}: {
  open: boolean;
  config: TuAssetConfig;
  verified: boolean;
  onClose: () => void;
  onCreated: (p: TuAssetProject) => void;
}) {
  const [step, setStep] = useState(1);
  const [link, setLink] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; hint?: string } | null>(null);

  const close = () => {
    setStep(1);
    setLink("");
    setName("");
    setSlug("");
    setError(null);
    onClose();
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await tuFetch<{ data: TuAssetProject }>("/dashboard/assets/projects", {
        json: { folder_link: link, name, slug: slug.trim().toLowerCase() },
      });
      close();
      onCreated(r.data);
    } catch (err) {
      const e2 = err as { message: string; hint?: string };
      setError({ text: e2.message || errorText(err), hint: e2.hint });
      if ((err as { code?: string }).code === "folder_not_shared") setStep(1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title="Connect a Google Drive folder" wide>
      <div className="flex gap-2 text-[11px] font-bold">
        {["Share the folder", "Paste the link", "Name it"].map((s, i) => (
          <span
            key={s}
            className={cx(
              "flex-1 text-center py-1.5 rounded-lg border",
              step === i + 1 ? "border-[#14B8A6] text-[#14B8A6] bg-[#14B8A6]/10" : step > i + 1 ? "border-emerald-500/40 text-emerald-500" : "border-[#F1F5F9]/12 text-[#F1F5F9]/50"
            )}
          >
            {i + 1}. {s}
          </span>
        ))}
      </div>

      {error && (
        <Notice tone="error" title={error.text}>
          {error.hint}
        </Notice>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm text-[#F1F5F9]/80">
            In Google Drive, the client (or you) right-clicks the folder → <b>Share</b>, and adds this email as a <b>Viewer</b>:
          </p>
          <div className="flex items-center gap-2 rounded-xl border border-[#14B8A6]/40 bg-[#14B8A6]/10 p-3">
            <span className="font-mono text-sm text-[#F1F5F9] break-all flex-1">{config.robot_email}</span>
            <CopyButton value={config.robot_email || ""} label="Copy email" />
          </div>
          <p className="text-sm text-[#F1F5F9]/80">
            Then add an <b>empty file</b> with this exact name to the folder (a blank Google Doc works: <i>New → Google Docs</i>, then rename it):
          </p>
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
            <span className="font-mono text-sm text-[#F1F5F9] break-all flex-1">{config.verification_file}</span>
            <CopyButton value={config.verification_file} label="Copy name" />
          </div>
          <ul className="text-xs text-[#F1F5F9]/70 space-y-1.5 list-disc pl-5">
            <li>
              The file proves the folder is yours: only people who can add files to it can create it. Nothing is public until ThumbsUp
              sees it. You can delete it afterwards.
            </li>
            <li>The name is the same for all your folders, so you can reuse it.</li>
            <li>ThumbsUp can only see this one folder, nothing else in the Drive.</li>
            <li>The folder doesn&apos;t need to be public.</li>
            <li>Subfolders are included. A file in &quot;images/hero.jpg&quot; gets the link …/images/hero.jpg.</li>
          </ul>
          <div className="flex justify-end">
            <Button onClick={() => setStep(2)}>Done, next →</Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            setStep(3);
          }}
        >
          <Field label="Folder link" help="Open the folder in Google Drive and copy the address from the browser, or use Share → Copy link.">
            <Input autoFocus value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://drive.google.com/drive/folders/1AbC…" required />
          </Field>
          <div className="flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep(1)}>
              ← Back
            </Button>
            <Button type="submit" disabled={link.trim().length < 10}>
              Next →
            </Button>
          </div>
        </form>
      )}

      {step === 3 && (
        <form className="space-y-4" onSubmit={create}>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Project name" optional help="Leave empty to use the folder's name.">
              <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme website" />
            </Field>
            <Field label="Link address" optional help="Part of every file link. Lowercase letters, numbers and dashes.">
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="acme-shop" />
            </Field>
          </div>
          <div className="rounded-xl border border-[#F1F5F9]/12 p-3 text-xs text-[#F1F5F9]/75">
            Your links will look like:{" "}
            <span className="font-mono text-[#14B8A6] break-all">
              {config.assets_base_url}/a/{slug.trim().toLowerCase() || "your-project"}/hero.jpg
            </span>
          </div>
          {!verified && <Notice tone="warning">Verify your account email first (see the banner above).</Notice>}
          <div className="flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep(2)}>
              ← Back
            </Button>
            <Button type="submit" loading={busy}>
              Connect folder
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------- project detail
function ProjectDetail({ id, config, onBack }: { id: string; config: TuAssetConfig; onBack: () => void }) {
  const toast = useToast();
  const project = useTuData<{ data: TuAssetProject }>(`/dashboard/assets/projects/${id}`);
  const files = useTuData<{ data: TuAssetFile[]; duplicates: string[] }>(`/dashboard/assets/projects/${id}/files`);
  const [tab, setTab] = useState<"files" | "activity" | "usage" | "code">("files");
  const [settings, setSettings] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { reload: reloadProject } = project;
  const { reload: reloadFiles } = files;
  const p = project.data?.data;

  // While copying or waiting for verification, check again regularly
  useEffect(() => {
    if (!p || !(p.syncing || p.status === "syncing" || p.status === "needs_verification")) return;
    const t = setTimeout(() => {
      reloadProject();
      reloadFiles();
    }, p.status === "needs_verification" && !p.syncing ? 5000 : 2000);
    return () => clearTimeout(t);
  }, [p, reloadProject, reloadFiles]);

  const syncNow = async () => {
    try {
      await tuFetch(`/dashboard/assets/projects/${id}/sync`, { method: "POST" });
      toast("success", "Checking the Drive folder for changes…");
      reloadProject();
    } catch (e) {
      toast("error", errorText(e));
    }
  };

  const remove = async () => {
    try {
      await tuFetch(`/dashboard/assets/projects/${id}`, { method: "DELETE" });
      toast("success", "Project deleted. Its links stopped working.");
      onBack();
    } catch (e) {
      toast("error", errorText(e));
    }
  };

  if (project.error) return <Notice tone="error">{project.error}</Notice>;
  if (!p) return <Spinner />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" /> All projects
        </Button>
        <div className="flex gap-2 flex-wrap">
          <a href={p.folder_link} target="_blank" rel="noreferrer">
            <Button variant="secondary" size="sm">
              <ExternalLink className="w-3.5 h-3.5" /> Open in Drive
            </Button>
          </a>
          <Button variant="secondary" size="sm" onClick={syncNow} loading={p.syncing}>
            <RefreshCw className="w-3.5 h-3.5" /> Check for changes
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setSettings(true)}>
            <Settings2 className="w-3.5 h-3.5" /> Settings
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDeleting(true)} aria-label="Delete project">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-xl font-bold text-[#F1F5F9]">{p.name}</h2>
          <ProjectStatus p={p} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[#F1F5F9]/60">Base link:</span>
          <span className="font-mono text-sm text-[#14B8A6] break-all">{p.base_url}</span>
          <CopyButton value={p.base_url} />
        </div>
        <div className="flex gap-5 text-xs text-[#F1F5F9]/70 flex-wrap">
          <span>
            Drive folder: <b className="text-[#F1F5F9]">{p.folder_name || "—"}</b>
          </span>
          <span>
            <b className="text-[#F1F5F9]">{p.file_count}</b> files · {humanSize(p.total_bytes || 0)}
          </span>
          <span>Last checked {timeAgo(p.last_synced_at)}</span>
        </div>
        {p.status === "no_access" && (
          <Notice tone="error" title="ThumbsUp can't open the Drive folder anymore">
            The website keeps working with the last copies, but changes won&apos;t show up. Share the folder again with{" "}
            <b className="font-mono">{config.robot_email}</b> (Viewer), then press <b>Check for changes</b>.
          </Notice>
        )}
        {p.status === "needs_verification" && (
          <Notice tone="warning" title="One more step: prove this folder is yours">
            <div className="space-y-2">
              <div>
                Add an empty file (a blank Google Doc is fine) named exactly this to the top of the Drive folder. Files go live as soon as
                ThumbsUp sees it, usually within 15 seconds:
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-[#F1F5F9] break-all">{p.verification_file}</span>
                <CopyButton value={p.verification_file} label="Copy name" />
              </div>
              <div className="text-[11px]">This stops anyone who only knows a folder&apos;s link from publishing its files.</div>
            </div>
          </Notice>
        )}
        {p.status === "error" && p.last_error && <Notice tone="error">{p.last_error}</Notice>}
        {p.status === "syncing" && <Notice tone="info">Copying files from Drive. Big videos can take a minute.</Notice>}
      </Card>

      {files.data && files.data.duplicates.length > 0 && (
        <Notice tone="warning" title="Some files have the same name">
          {files.data.duplicates.join(", ")}: the newest one is shown on the website. Delete or rename the older copies in Drive.
        </Notice>
      )}

      <TabBar
        tabs={[
          { id: "files", label: `Files${files.data ? ` (${files.data.data.length})` : ""}` },
          { id: "activity", label: "Activity" },
          { id: "usage", label: "Usage" },
          { id: "code", label: "How to use" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "files" && <FilesTab files={files.data?.data} config={config} isPublic={p.verified} />}
      {tab === "activity" && <ActivityTab id={id} />}
      {tab === "usage" && <UsageTab id={id} />}
      {tab === "code" && <CodeTab project={p} files={files.data?.data || []} />}

      {settings && (
        <SettingsModal
          p={p}
          onClose={() => setSettings(false)}
          onSaved={() => {
            setSettings(false);
            reloadProject();
            reloadFiles();
          }}
        />
      )}
      <Modal open={deleting} onClose={() => setDeleting(false)} title="Delete this project?">
        <Notice tone="warning">
          Every link under <b className="font-mono">{p.base_url}</b> stops working immediately, so websites using them will show broken
          images. The files in Google Drive are not touched.
        </Notice>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleting(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={remove}>
            Delete project
          </Button>
        </div>
      </Modal>
    </div>
  );
}

const FILE_STATUS: Record<TuAssetFile["status"], [string, string]> = {
  active: ["Live", "text-emerald-500 bg-emerald-500/15"],
  removed: ["Deleted in Drive", "text-amber-500 bg-amber-500/15"],
  too_large: ["Too large", "text-red-500 bg-red-500/15"],
  blocked: ["Not allowed", "text-red-500 bg-red-500/15"],
  error: ["Error", "text-red-500 bg-red-500/15"],
};

function fileIcon(f: TuAssetFile) {
  if (f.mime_type.startsWith("video/")) return <Film className="w-4 h-4" />;
  if (f.mime_type.startsWith("image/")) return <ImageIcon className="w-4 h-4" />;
  if (f.is_google_doc || f.mime_type === "application/pdf") return <FileText className="w-4 h-4" />;
  return <FileIcon className="w-4 h-4" />;
}

function FilesTab({ files, config, isPublic }: { files?: TuAssetFile[]; config: TuAssetConfig; isPublic: boolean }) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => (files || []).filter((f) => f.path.toLowerCase().includes(q.trim().toLowerCase())), [files, q]);
  if (!files) return <Spinner />;
  if (files.length === 0)
    return (
      <EmptyState
        icon={<FolderOpen className="w-6 h-6" />}
        title="The folder is empty"
        text="Add images, videos or documents to the Drive folder. They appear here automatically."
      />
    );
  return (
    <div className="space-y-3">
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#F1F5F9]/50" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a file" className="pl-9" />
      </div>
      <Card className="divide-y divide-[#F1F5F9]/10 overflow-hidden">
        {shown.map((f) => {
          const [label, cls] =
            !isPublic && f.status === "active" ? ["Not public yet", "text-amber-500 bg-amber-500/15"] : FILE_STATUS[f.status];
          const servable = isPublic && (f.status === "active" || f.status === "removed");
          return (
            <div key={f.id} className="flex flex-col md:flex-row md:items-center gap-3 px-4 py-3">
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#94A3B8]/15 flex items-center justify-center shrink-0 text-[#F1F5F9]/60">
                {f.is_image && servable ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`${f.url}?w=100&h=100&format=webp`} alt="" className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  fileIcon(f)
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-[#F1F5F9] break-all">{f.path}</span>
                  <span className={cx("px-2 py-0.5 rounded-md text-[10px] font-bold", cls)}>{label}</span>
                  {f.is_google_doc && <Tag tone="slate">Google Doc → PDF</Tag>}
                </div>
                <div className="text-[11px] text-[#F1F5F9]/60">
                  {f.mime_type} · {humanSize(f.size)} · updated {timeAgo(f.modified_at || f.synced_at)}
                  {f.status === "removed" && f.grace_ends_at && ` · still served until ${new Date(f.grace_ends_at).toLocaleTimeString()} (time to upload a replacement)`}
                  {f.status === "too_large" && ` · limit is ${config.max_file_mb} MB`}
                  {f.error && f.status !== "too_large" && ` · ${f.error}`}
                </div>
              </div>
              {servable && (
                <div className="flex gap-1.5 shrink-0">
                  <CopyButton value={f.url} label="Copy link" />
                  <a href={f.url} target="_blank" rel="noreferrer">
                    <Button variant="ghost" size="sm" aria-label="Open">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </a>
                </div>
              )}
            </div>
          );
        })}
        {shown.length === 0 && <p className="text-sm text-[#F1F5F9]/60 p-6 text-center">No file matches “{q}”.</p>}
      </Card>
    </div>
  );
}

const EVENT_STYLE: Record<string, [string, React.ReactNode]> = {
  added: ["New file", <CheckCircle2 key="a" className="w-4 h-4 text-emerald-500" />],
  verified: ["Folder verified", <CheckCircle2 key="v" className="w-4 h-4 text-emerald-500" />],
  needs_verification: ["Waiting for verification", <AlertTriangle key="nv" className="w-4 h-4 text-amber-500" />],
  replaced: ["Replaced", <RefreshCw key="r" className="w-4 h-4 text-[#14B8A6]" />],
  updated: ["New version", <RefreshCw key="u" className="w-4 h-4 text-[#14B8A6]" />],
  renamed: ["Renamed", <Copy key="n" className="w-4 h-4 text-violet-500" />],
  restored: ["Restored", <CheckCircle2 key="s" className="w-4 h-4 text-emerald-500" />],
  removed: ["Deleted", <Trash2 key="d" className="w-4 h-4 text-amber-500" />],
  conflict: ["Same name twice", <AlertTriangle key="c" className="w-4 h-4 text-amber-500" />],
  hint: ["Tip", <AlertTriangle key="h" className="w-4 h-4 text-amber-500" />],
  blocked: ["Not allowed", <AlertTriangle key="b" className="w-4 h-4 text-red-500" />],
  too_large: ["Too large", <AlertTriangle key="t" className="w-4 h-4 text-red-500" />],
  error: ["Problem", <AlertTriangle key="e" className="w-4 h-4 text-red-500" />],
  access_lost: ["Lost access", <AlertTriangle key="l" className="w-4 h-4 text-red-500" />],
  access_restored: ["Access back", <CheckCircle2 key="k" className="w-4 h-4 text-emerald-500" />],
};

function ActivityTab({ id }: { id: string }) {
  const { data } = useTuData<{ data: TuAssetEvent[] }>(`/dashboard/assets/projects/${id}/events`);
  if (!data) return <Spinner />;
  if (data.data.length === 0) return <Card className="p-8 text-center text-sm text-[#F1F5F9]/65">Nothing has happened yet.</Card>;
  return (
    <Card className="divide-y divide-[#F1F5F9]/10">
      {data.data.map((e) => {
        const [label, icon] = EVENT_STYLE[e.kind] || [e.kind, <FileIcon key="x" className="w-4 h-4" />];
        return (
          <div key={e.id} className="flex items-start gap-3 px-5 py-3">
            <div className="mt-0.5">{icon}</div>
            <div className="min-w-0 flex-1">
              <div className="text-sm text-[#F1F5F9]">
                <b>{label}</b>
                {e.path && <span className="font-mono text-[#F1F5F9]/80"> · {e.path}</span>}
              </div>
              <div className="text-xs text-[#F1F5F9]/65">{e.message}</div>
            </div>
            <div className="text-[11px] text-[#F1F5F9]/60 shrink-0">{timeAgo(e.created_at)}</div>
          </div>
        );
      })}
    </Card>
  );
}

function UsageTab({ id }: { id: string }) {
  const { data } = useTuData<TuAssetUsage>(`/dashboard/assets/projects/${id}/usage`);
  if (!data) return <Spinner />;
  const max = Math.max(1, ...data.daily.map((d) => d.hits));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 max-w-lg">
        <Card className="p-5">
          <div className="text-xs text-[#F1F5F9]/65">Files loaded (30 days)</div>
          <div className="text-3xl font-bold text-[#F1F5F9]">{data.last_30_days.hits.toLocaleString()}</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs text-[#F1F5F9]/65">Data served (30 days)</div>
          <div className="text-3xl font-bold text-[#14B8A6]">{humanSize(data.last_30_days.bytes)}</div>
        </Card>
      </div>
      <Card className="p-6">
        <div className="text-sm font-bold text-[#F1F5F9] mb-4">Loads per day (last 14 days)</div>
        <div className="flex items-end gap-1.5 h-32">
          {data.daily.map((d) => (
            <div key={d.date} className="flex-1 h-full flex items-end" title={`${d.date}: ${d.hits} loads, ${humanSize(d.bytes)}`}>
              <div className="w-full rounded-t-md bg-[#14B8A6]" style={{ height: `${Math.max((d.hits / max) * 100, 2)}%` }} />
            </div>
          ))}
        </div>
        <p className="text-[11px] text-[#F1F5F9]/60 mt-3">Counts visits that reach ThumbsUp. Browsers keep files for a while, so repeat visits may not show here.</p>
      </Card>
    </div>
  );
}

function CodeTab({ project, files }: { project: TuAssetProject; files: TuAssetFile[] }) {
  const [lang, setLang] = useState<"html" | "react" | "css" | "api">("html");
  const live = files.filter((f) => f.status === "active");
  const img = live.find((f) => f.is_image)?.url || `${project.base_url}hero.jpg`;
  const video = live.find((f) => f.mime_type.startsWith("video/"))?.url || `${project.base_url}intro.mp4`;
  const doc = live.find((f) => f.is_google_doc || f.mime_type === "application/pdf")?.url || `${project.base_url}menu.pdf`;
  const host = new URL(project.base_url).host;
  const code: Record<typeof lang, [string, string]> = {
    html: [
      "html",
      `<!-- Image: always shows the current file with this name -->
<img src="${img}" alt="Hero">

<!-- Fast on phones: resized + WebP/AVIF automatically -->
<img
  src="${img}?w=1200&format=auto"
  srcset="${img}?w=640&format=auto 640w,
          ${img}?w=1200&format=auto 1200w,
          ${img}?w=1920&format=auto 1920w"
  sizes="100vw" alt="Hero" loading="lazy">

<!-- Video -->
<video src="${video}" controls playsinline></video>

<!-- Document (Google Docs are served as PDF) -->
<a href="${doc}" target="_blank">Download</a>`,
    ],
    react: [
      "tsx",
      `// next.config.ts: allow the image host once
images: { remotePatterns: [{ protocol: "${project.base_url.split(":")[0]}", hostname: "${host}", pathname: "/a/${project.slug}/**" }] }

// Anywhere in your app
const asset = (name: string) => \`${project.base_url}\${name}\`;

<Image src={asset("${img.split("/a/" + project.slug + "/")[1] || "hero.jpg"}")} alt="Hero" width={1920} height={1080} />`,
    ],
    css: [
      "css",
      `.hero {
  background-image: url("${img}?w=1920&format=webp");
  background-size: cover;
}`,
    ],
    api: [
      "bash",
      `# List every file in this project (secret API key from the API Keys tab)
curl ${project.base_url.split("/a/")[0]}/v1/assets/projects/${project.slug}/files \\
  -H "Authorization: Bearer $THUMBSUP_SECRET_KEY"

# Re-check the Drive folder right now (normally automatic)
curl -X POST ${project.base_url.split("/a/")[0]}/v1/assets/projects/${project.slug}/sync \\
  -H "Authorization: Bearer $THUMBSUP_SECRET_KEY"`,
    ],
  };
  return (
    <div className="space-y-4">
      <TabBar
        tabs={[
          { id: "html", label: "HTML" },
          { id: "react", label: "React / Next.js" },
          { id: "css", label: "CSS" },
          { id: "api", label: "API" },
        ]}
        value={lang}
        onChange={setLang}
      />
      <CodeBlock language={code[lang][0]} code={code[lang][1]} />
      <Card className="p-5">
        <div className="text-sm font-bold text-[#F1F5F9] mb-2">Rules worth telling your client</div>
        <ul className="text-xs text-[#F1F5F9]/75 space-y-1.5 list-disc pl-5">
          <li>
            To change a file, upload the new one with <b>exactly the same name</b>. The website updates within about a minute.
          </li>
          <li>Upper/lower case doesn&apos;t matter, and the extension is optional (…/hero works for hero.jpg).</li>
          <li>Deleting first is fine: the old file keeps showing for a while, so the website never breaks.</li>
          <li>If Drive renames the upload to “hero (1).jpg”, rename it back to “hero.jpg”.</li>
          <li>Image options: ?w=800 (width), ?h=600 (height), &amp;fit=cover|contain|inside, &amp;format=webp|avif|auto, &amp;q=80.</li>
        </ul>
      </Card>
    </div>
  );
}

function SettingsModal({ p, onClose, onSaved }: { p: TuAssetProject; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(p.name);
  const [slug, setSlug] = useState(p.slug);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await tuFetch(`/dashboard/assets/projects/${p.id}`, { method: "PATCH", json: { name, slug: slug.trim().toLowerCase() } });
      onSaved();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title="Project settings">
      <form onSubmit={save} className="space-y-4">
        <Field label="Project name">
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Link address">
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} required />
        </Field>
        {slug.trim().toLowerCase() !== p.slug && (
          <Notice tone="warning">Changing the address breaks every link already used in websites. Only do this before going live.</Notice>
        )}
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}
