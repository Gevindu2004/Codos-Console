"use client";

import React, { useMemo, useState } from "react";
import { ArrowLeft, FileText, Globe, Pencil, Plus, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { tuFetch, TuTemplate, timeAgo } from "./api";
import { useTuData } from "./hooks";
import { STARTER_TEMPLATES, StarterTemplate, extractVariables, renderLocal } from "./starterTemplates";
import {
  Button,
  Card,
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
  TextArea,
  Toggle,
  errorText,
  useToast,
} from "./ui";

type Draft = Omit<TuTemplate, "id" | "variables" | "created_at" | "updated_at"> & { id?: string };

const BLANK: Draft = {
  name: "",
  subject: "",
  html: "",
  text: "",
  to_emails: [],
  from_name: "",
  from_email: "",
  allow_public: false,
  auto_reply: false,
  auto_reply_subject: "",
  auto_reply_text: "",
};

export function TemplatesView() {
  const toast = useToast();
  const list = useTuData<{ data: TuTemplate[] }>("/dashboard/templates");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [sample, setSample] = useState<Record<string, string>>({});
  const [picking, setPicking] = useState(false);
  const [deleting, setDeleting] = useState<TuTemplate | null>(null);

  const openStarter = (s: StarterTemplate | null) => {
    setPicking(false);
    if (!s) {
      setDraft({ ...BLANK });
      setSample({});
      return;
    }
    setDraft({
      ...BLANK,
      name: s.name,
      subject: s.subject,
      html: s.html,
      allow_public: s.allow_public,
      auto_reply: !!s.auto_reply,
      auto_reply_subject: s.auto_reply_subject || "",
      auto_reply_text: s.auto_reply_text || "",
    });
    setSample(s.sample);
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await tuFetch(`/dashboard/templates/${deleting.id}`, { method: "DELETE" });
      toast("success", "Template deleted.");
      setDeleting(null);
      list.reload();
    } catch (e) {
      toast("error", errorText(e));
    }
  };

  if (draft) {
    return (
      <TemplateEditor
        initial={draft}
        initialSample={sample}
        onBack={() => setDraft(null)}
        onSaved={() => {
          setDraft(null);
          list.reload();
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Email templates"
        subtitle="Design an email once, then reuse it everywhere. Use {{name}}-style placeholders and ThumbsUp fills them in for every email."
        action={
          <Button onClick={() => setPicking(true)}>
            <Plus className="w-4 h-4" /> New template
          </Button>
        }
      />
      {list.error && <Notice tone="error">{list.error}</Notice>}
      {!list.data ? (
        <Spinner />
      ) : list.data.data.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-6 h-6" />}
          title="No templates yet"
          text="Pick a ready-made design (contact form, welcome email, verification code…) and adjust it in a minute."
          action={
            <Button onClick={() => setPicking(true)}>
              <Sparkles className="w-4 h-4" /> Choose a starter design
            </Button>
          }
        />
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {list.data.data.map((t) => (
            <Card key={t.id} className="p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-[#F1F5F9] truncate">{t.name}</div>
                  <div className="text-xs text-[#F1F5F9]/65 truncate mt-0.5">{t.subject}</div>
                </div>
                {t.allow_public && (
                  <Tag>
                    <Globe className="w-3 h-3 mr-1" /> Website form
                  </Tag>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {t.variables.slice(0, 6).map((v) => (
                  <Tag key={v} tone="slate">{`{{${v}}}`}</Tag>
                ))}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-[#F1F5F9]/60">
                <span className="font-mono">{t.id}</span>
              </div>
              <div className="flex items-center justify-between mt-auto pt-1">
                <span className="text-[11px] text-[#F1F5F9]/60">Edited {timeAgo(t.updated_at)}</span>
                <div className="flex gap-1.5">
                  <CopyButton value={t.id} label="ID" />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setDraft({ ...t });
                      setSample(Object.fromEntries(t.variables.map((v) => [v, ""])));
                    }}
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleting(t)} aria-label="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={picking} onClose={() => setPicking(false)} title="Start a new template" wide>
        <div className="grid sm:grid-cols-2 gap-3">
          {STARTER_TEMPLATES.map((s) => (
            <button
              key={s.id}
              onClick={() => openStarter(s)}
              className="text-left rounded-xl border border-[#F1F5F9]/15 hover:border-[#14B8A6] p-4 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[#F1F5F9]">{s.name}</span>
                {s.allow_public && <Tag>Website form</Tag>}
              </div>
              <p className="text-xs text-[#F1F5F9]/65 mt-1">{s.description}</p>
            </button>
          ))}
          <button
            onClick={() => openStarter(null)}
            className="text-left rounded-xl border border-dashed border-[#F1F5F9]/15 hover:border-[#14B8A6] p-4 transition-colors cursor-pointer"
          >
            <span className="text-sm font-bold text-[#F1F5F9]">Blank template</span>
            <p className="text-xs text-[#F1F5F9]/65 mt-1">Start from an empty page and write your own HTML.</p>
          </button>
        </div>
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete template?">
        <Notice tone="warning">
          Apps or website forms that use <b>{deleting?.name}</b> will stop working. Already sent emails stay in your logs.
        </Notice>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={remove}>
            Delete template
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function TemplateEditor({
  initial,
  initialSample,
  onBack,
  onSaved,
}: {
  initial: Draft;
  initialSample: Record<string, string>;
  onBack: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [d, setD] = useState<Draft>(initial);
  const [recipients, setRecipients] = useState(initial.to_emails.join(", "));
  const [sample, setSample] = useState<Record<string, string>>(initialSample);
  const [bodyTab, setBodyTab] = useState<"html" | "text">(initial.html || !initial.text ? "html" : "text");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const variables = useMemo(() => extractVariables(d.subject, d.html, d.text), [d.subject, d.html, d.text]);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));

  const previewSubject = renderLocal(d.subject, sample, false);
  const previewHtml = d.html
    ? renderLocal(d.html, sample, true)
    : `<pre style="font-family:Arial,sans-serif;white-space:pre-wrap;padding:16px">${renderLocal(d.text, sample, true)}</pre>`;

  const save = async () => {
    setBusy(true);
    setError(null);
    const body = { ...d, to_emails: recipients.split(/[\s,;]+/).filter(Boolean) };
    delete body.id;
    try {
      if (d.id) await tuFetch(`/dashboard/templates/${d.id}`, { method: "PUT", json: body });
      else await tuFetch("/dashboard/templates", { json: body });
      toast("success", d.id ? "Template saved." : "Template created. You can use it now!");
      onSaved();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" /> All templates
        </Button>
        <div className="flex gap-2">
          {d.id && <CopyButton value={d.id} label="Copy template ID" size="md" />}
          <Button onClick={save} loading={busy}>
            {d.id ? "Save changes" : "Create template"}
          </Button>
        </div>
      </div>
      {error && <Notice tone="error">{error}</Notice>}

      <div className="grid xl:grid-cols-2 gap-5">
        {/* LEFT: settings */}
        <div className="space-y-4">
          <Card className="p-5 space-y-4">
            <Field label="Template name">
              <Input value={d.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Contact form" />
            </Field>
            <Field label="Subject line" help="Tip: add placeholders like {{name}} to personalise it.">
              <Input value={d.subject} onChange={(e) => set("subject", e.target.value)} placeholder="New message from {{name}}" />
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Sender name" optional help="The name people see in their inbox.">
                <Input value={d.from_name} onChange={(e) => set("from_name", e.target.value)} placeholder="Via Codos" />
              </Field>
              <Field label="Sender address" optional help="Must be on a domain you verified under Domains. Empty = default address.">
                <Input value={d.from_email} onChange={(e) => set("from_email", e.target.value)} placeholder="hello@mycompany.com" />
              </Field>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#F1F5F9]/85">Email body</span>
                <TabBar
                  tabs={[
                    { id: "html", label: "Design (HTML)" },
                    { id: "text", label: "Plain text" },
                  ]}
                  value={bodyTab}
                  onChange={setBodyTab}
                />
              </div>
              {bodyTab === "html" ? (
                <TextArea rows={14} value={d.html} onChange={(e) => set("html", e.target.value)} placeholder="<h1>Hello {{name}}</h1>" />
              ) : (
                <TextArea
                  rows={14}
                  value={d.text}
                  onChange={(e) => set("text", e.target.value)}
                  placeholder={"Hello {{name}},\n\nThanks for your message!"}
                />
              )}
              <p className="text-[11px] text-[#F1F5F9]/60">
                {bodyTab === "html"
                  ? "No plain-text version? We create one automatically from your design."
                  : "Optional if you have an HTML design: used by email apps that don't show HTML."}
              </p>
            </div>
          </Card>

          <Card className="p-5 space-y-4">
            <Toggle
              checked={d.allow_public}
              onChange={(v) => set("allow_public", v)}
              label="Use with website forms"
              help="Lets a public key send this template from your website. Emails always go to the address below, never to an address the visitor types."
            />
            {d.allow_public && (
              <>
                <Field label="Send form messages to" help="Your email address (or several, separated by commas).">
                  <Input value={recipients} onChange={(e) => setRecipients(e.target.value)} placeholder="you@company.com" />
                </Field>
                <Toggle
                  checked={d.auto_reply}
                  onChange={(v) => set("auto_reply", v)}
                  label="Send an automatic “thank you” reply"
                  help="If the form has an 'email' field, the visitor gets this reply instantly."
                />
                {d.auto_reply && (
                  <div className="space-y-3 pl-1">
                    <Field label="Reply subject">
                      <Input value={d.auto_reply_subject} onChange={(e) => set("auto_reply_subject", e.target.value)} placeholder="Thanks, {{name}}!" />
                    </Field>
                    <Field label="Reply message">
                      <TextArea rows={5} value={d.auto_reply_text} onChange={(e) => set("auto_reply_text", e.target.value)} />
                    </Field>
                  </div>
                )}
              </>
            )}
          </Card>
        </div>

        {/* RIGHT: live preview */}
        <div className="space-y-4">
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#F1F5F9]">Live preview</h3>
              <span className="text-[11px] text-[#F1F5F9]/60">Updates as you type</span>
            </div>
            {variables.length > 0 && (
              <div className="grid sm:grid-cols-2 gap-2">
                {variables.map((v) => (
                  <Field key={v} label={`{{${v}}}`}>
                    <Input value={sample[v] || ""} onChange={(e) => setSample((s) => ({ ...s, [v]: e.target.value }))} placeholder={`Example ${v}`} />
                  </Field>
                ))}
              </div>
            )}
            <div className="rounded-xl overflow-hidden border border-[#F1F5F9]/12">
              <div className="bg-white px-4 py-2.5 border-b border-slate-200">
                <div className="text-[11px] text-slate-500">Subject</div>
                <div className="text-sm font-semibold text-slate-900 truncate">{previewSubject || "—"}</div>
              </div>
              <iframe title="Email preview" sandbox="" srcDoc={previewHtml} className="w-full h-[460px] bg-white" />
            </div>
            <p className="text-[11px] text-[#F1F5F9]/60 flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3" /> Values people type are made safe automatically, so nobody can inject code into your emails.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
