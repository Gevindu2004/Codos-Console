"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Loader2, Paperclip, Send, UploadCloud, X, XCircle } from "lucide-react";
import { isFinal, tuFetch, TuEmail, TuTemplate, humanSize, timeAgo } from "./api";
import { useTuData } from "./hooks";
import { Button, Card, Field, Input, Notice, SectionHeader, Select, TabBar, TextArea, errorText } from "./ui";
import type { TuView } from "./ThumbsUpEmailWorkspace";

export function SendTestView({ go }: { go: (v: TuView) => void }) {
  const templates = useTuData<{ data: TuTemplate[] }>("/dashboard/templates");
  const [mode, setMode] = useState<"write" | "template">("write");
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [from, setFrom] = useState("");
  const [subject, setSubject] = useState("Hello from ThumbsUp Email 👋");
  const [body, setBody] = useState("<h2>It works!</h2>\n<p>This test email was sent with <b>ThumbsUp Email</b>.</p>");
  const [templateId, setTemplateId] = useState("");
  const [vars, setVars] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [showMore, setShowMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TuEmail | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const template = useMemo(() => templates.data?.data.find((t) => t.id === templateId), [templates.data, templateId]);

  // Watch the email until the mail server has accepted it (or it fails)
  useEffect(() => {
    if (!result || isFinal(result.status)) return;
    const timer = setTimeout(async () => {
      try {
        const r = await tuFetch<{ data: TuEmail }>(`/dashboard/emails/${result.id}`);
        setResult(r.data);
      } catch {
        /* keep last state */
      }
    }, result.next_attempt_at ? 5000 : 900);
    return () => clearTimeout(timer);
  }, [result]);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)].slice(0, 10));
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    const form = new FormData();
    form.append("to", to);
    if (cc) form.append("cc", cc);
    if (replyTo) form.append("reply_to", replyTo);
    if (from) form.append("from", from);
    if (mode === "template") {
      form.append("template_id", templateId);
      form.append("variables", JSON.stringify(vars));
    } else {
      form.append("subject", subject);
      form.append("html", body);
    }
    files.forEach((f) => form.append("files", f, f.name));
    try {
      const r = await tuFetch<{ data: TuEmail }>("/dashboard/emails/test", { form });
      setResult(r.data);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Send a test email"
        subtitle="Try ThumbsUp right here. It uses exactly the same engine as the API, so if it works here, it works in your app."
      />
      <div className="grid xl:grid-cols-5 gap-5">
        <Card className="p-6 xl:col-span-3">
          <form onSubmit={send} className="space-y-4">
            <Field label="Send to" help="Separate several addresses with commas.">
              <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="friend@example.com" required />
            </Field>

            {!showMore ? (
              <button type="button" onClick={() => setShowMore(true)} className="text-xs font-bold text-[#14B8A6] cursor-pointer">
                + Add CC, reply-to or a custom sender address
              </button>
            ) : (
              <div className="grid sm:grid-cols-3 gap-4">
                <Field label="From" optional help="On a verified domain">
                  <Input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="hello@mycompany.com" />
                </Field>
                <Field label="CC" optional>
                  <Input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="team@example.com" />
                </Field>
                <Field label="Reply-to" optional>
                  <Input value={replyTo} onChange={(e) => setReplyTo(e.target.value)} placeholder="support@example.com" />
                </Field>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-semibold text-[#F1F5F9]/85">Content</span>
              <TabBar
                tabs={[
                  { id: "write", label: "Write my own" },
                  { id: "template", label: "Use a template" },
                ]}
                value={mode}
                onChange={setMode}
              />
            </div>

            {mode === "write" ? (
              <>
                <Field label="Subject">
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} required />
                </Field>
                <Field label="Message (HTML or plain text)">
                  <TextArea rows={8} value={body} onChange={(e) => setBody(e.target.value)} required />
                </Field>
              </>
            ) : templates.data && templates.data.data.length === 0 ? (
              <Notice tone="info">
                You don&apos;t have any templates yet.{" "}
                <button type="button" className="font-bold text-[#14B8A6] cursor-pointer" onClick={() => go("templates")}>
                  Create one →
                </button>
              </Notice>
            ) : (
              <>
                <Field label="Template">
                  <Select
                    value={templateId}
                    onChange={(e) => {
                      setTemplateId(e.target.value);
                      setVars({});
                    }}
                    required
                  >
                    <option value="">Choose a template…</option>
                    {templates.data?.data.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                {template && template.variables.length > 0 && (
                  <div className="rounded-xl border border-[#F1F5F9]/12 p-4 space-y-3">
                    <div className="text-xs font-semibold text-[#F1F5F9]/85">Fill in the placeholders</div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {template.variables.map((v) => (
                        <Field key={v} label={v}>
                          <Input value={vars[v] || ""} onChange={(e) => setVars((p) => ({ ...p, [v]: e.target.value }))} />
                        </Field>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Files */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                addFiles(e.dataTransfer.files);
              }}
              onClick={() => fileInput.current?.click()}
              className="rounded-xl border-2 border-dashed border-[#F1F5F9]/15 hover:border-[#14B8A6] p-5 text-center cursor-pointer transition-colors"
            >
              <UploadCloud className="w-6 h-6 text-[#14B8A6] mx-auto" />
              <div className="text-sm font-semibold text-[#F1F5F9] mt-1.5">Attach files (optional)</div>
              <div className="text-[11px] text-[#F1F5F9]/60">Drag & drop or click. Large files are sent as secure download links automatically.</div>
              <input ref={fileInput} type="file" multiple hidden onChange={(e) => addFiles(e.target.files)} />
            </div>
            {files.length > 0 && (
              <ul className="space-y-1.5">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center justify-between rounded-lg border border-[#F1F5F9]/12 px-3 py-2 text-xs">
                    <span className="flex items-center gap-2 text-[#F1F5F9] min-w-0">
                      <Paperclip className="w-3.5 h-3.5 text-[#14B8A6] shrink-0" />
                      <span className="truncate">{f.name}</span>
                      <span className="text-[#F1F5F9]/60 shrink-0">{humanSize(f.size)}</span>
                    </span>
                    <button type="button" onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} className="p-1 text-[#F1F5F9]/60 cursor-pointer" aria-label="Remove file">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {error && <Notice tone="error">{error}</Notice>}
            <Button type="submit" loading={busy} className="w-full">
              <Send className="w-4 h-4" /> Send email
            </Button>
          </form>
        </Card>

        <div className="xl:col-span-2 space-y-4">
          {result ? (
            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                {!isFinal(result.status) && <Loader2 className="w-7 h-7 text-amber-500 animate-spin" />}
                {(result.status === "sent" || result.status === "delivered") && <CheckCircle2 className="w-7 h-7 text-emerald-500" />}
                {["failed", "bounced", "complained"].includes(result.status) && <XCircle className="w-7 h-7 text-red-500" />}
                <div>
                  <div className="text-base font-bold text-[#F1F5F9]">
                    {!isFinal(result.status) && (result.next_attempt_at ? "Waiting to retry…" : "Sending…")}
                    {result.status === "sent" && "Sent! The mail server accepted it."}
                    {result.status === "delivered" && "Delivered to the inbox server!"}
                    {result.status === "failed" && "Couldn't send this email"}
                    {result.status === "bounced" && "Bounced: the address doesn't accept mail"}
                  </div>
                  <div className="text-xs text-[#F1F5F9]/60 font-mono">{result.id}</div>
                </div>
              </div>
              {result.error && (
                <Notice tone={result.status === "queued" || result.status === "sent" ? "warning" : "error"}>
                  {result.error}
                  {result.next_attempt_at && ` (retrying ${timeAgo(result.next_attempt_at).replace(" ago", "")})`}
                </Notice>
              )}
              {result.suppressed.length > 0 && (
                <Notice tone="warning">Skipped (on your suppression list): {result.suppressed.join(", ")}</Notice>
              )}
              <div className="text-xs text-[#F1F5F9]/75 space-y-1">
                <div>
                  <b>To:</b> {result.to.join(", ")}
                </div>
                <div>
                  <b>Subject:</b> {result.subject}
                </div>
                {result.attachments.length > 0 && (
                  <div>
                    <b>Files:</b> {result.attachments.map((a) => `${a.filename}${a.delivery === "link" ? " (download link)" : ""}`).join(", ")}
                  </div>
                )}
              </div>
              <Button variant="secondary" onClick={() => go("logs")} className="w-full">
                View in Email Logs
              </Button>
            </Card>
          ) : (
            <Card className="p-6">
              <h3 className="text-sm font-bold text-[#F1F5F9]">What happens when you press send?</h3>
              <ol className="mt-3 space-y-2.5 text-xs text-[#F1F5F9]/75 list-decimal pl-4">
                <li>ThumbsUp checks the addresses and builds your email.</li>
                <li>Small files are attached. Big files become secure download links.</li>
                <li>It&apos;s queued safely and delivered by the mail server. Temporary problems are retried automatically.</li>
                <li>Addresses that bounced before are skipped to protect your reputation.</li>
                <li>Any webhooks you set up are notified.</li>
              </ol>
            </Card>
          )}
          <Notice tone="info" title="Not in the inbox?">
            Check the spam folder first. New sender addresses often land there until recipients interact with them. Verifying
            your own domain (Domains tab) improves inbox placement a lot.
          </Notice>
        </div>
      </div>
    </div>
  );
}
