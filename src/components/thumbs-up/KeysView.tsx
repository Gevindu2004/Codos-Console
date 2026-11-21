"use client";

import React, { useState } from "react";
import { Globe, KeyRound, Pencil, Plus, Server, ShieldAlert, Trash2 } from "lucide-react";
import { tuFetch, TuKey, timeAgo } from "./api";
import { useTuData } from "./hooks";
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
  Tag,
  errorText,
  useToast,
} from "./ui";
import type { TuView } from "./ThumbsUpEmailWorkspace";

export function KeysView({ go }: { go: (v: TuView) => void }) {
  const toast = useToast();
  const keys = useTuData<{ data: TuKey[] }>("/dashboard/keys");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<TuKey | null>(null);
  const [revoking, setRevoking] = useState<TuKey | null>(null);
  const [busy, setBusy] = useState(false);

  const revoke = async () => {
    if (!revoking) return;
    setBusy(true);
    try {
      await tuFetch(`/dashboard/keys/${revoking.id}`, { method: "DELETE" });
      toast("success", `"${revoking.name}" was revoked. It stops working immediately.`);
      setRevoking(null);
      keys.reload();
    } catch (e) {
      toast("error", errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="API Keys"
        subtitle="Keys let your apps and websites send emails through your account. Keep secret keys on your server, and use public keys in website code."
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4" /> Create API key
          </Button>
        }
      />

      {keys.error && <Notice tone="error">{keys.error}</Notice>}
      {!keys.data ? (
        <Spinner />
      ) : keys.data.data.length === 0 ? (
        <EmptyState
          icon={<KeyRound className="w-6 h-6" />}
          title="No API keys yet"
          text="Create your first key to start sending. It only takes a few seconds."
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus className="w-4 h-4" /> Create API key
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3">
          {keys.data.data.map((k) => (
            <Card key={k.id} className="p-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#14B8A6]/15 text-[#14B8A6] flex items-center justify-center shrink-0">
                    {k.kind === "secret" ? <Server className="w-5 h-5" /> : <Globe className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-[#F1F5F9]">{k.name}</span>
                      <Tag tone={k.kind === "secret" ? "violet" : "teal"}>{k.kind === "secret" ? "Secret · server" : "Public · website"}</Tag>
                    </div>
                    <div className="font-mono text-xs text-[#F1F5F9]/75 break-all">
                      {k.kind === "public" && k.key ? k.key : `${k.prefix}••••••••••••••••••••`}
                    </div>
                    <div className="text-[11px] text-[#F1F5F9]/60">
                      Created {timeAgo(k.created_at)} · Last used {timeAgo(k.last_used_at)}
                    </div>
                    {k.kind === "public" && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <span className="text-[11px] text-[#F1F5F9]/60">Works only on:</span>
                        {k.allowed_origins.map((o) => (
                          <Tag key={o} tone="slate">
                            {o}
                          </Tag>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {k.kind === "public" && k.key && <CopyButton value={k.key} label="Copy key" />}
                  <Button variant="secondary" size="sm" onClick={() => setEditing(k)}>
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => setRevoking(k)}>
                    <Trash2 className="w-3.5 h-3.5" /> Revoke
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <CreateKeyModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => keys.reload()}
        onDocs={() => {
          setCreating(false);
          go("docs");
        }}
      />
      {editing && (
        <EditKeyModal
          k={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            keys.reload();
          }}
        />
      )}
      <Modal open={!!revoking} onClose={() => setRevoking(null)} title="Revoke this key?">
        <Notice tone="warning">
          Anything using <b>{revoking?.name}</b> will stop sending emails immediately. This can&apos;t be undone.
        </Notice>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setRevoking(null)}>
            Cancel
          </Button>
          <Button variant="danger" loading={busy} onClick={revoke}>
            Yes, revoke key
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function CreateKeyModal({
  open,
  onClose,
  onCreated,
  onDocs,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  onDocs: () => void;
}) {
  const [kind, setKind] = useState<"secret" | "public" | null>(null);
  const [name, setName] = useState("");
  const [origins, setOrigins] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<TuKey | null>(null);
  const [saved, setSaved] = useState(false);

  const reset = () => {
    setKind(null);
    setName("");
    setOrigins("");
    setError(null);
    setCreated(null);
    setSaved(false);
  };
  const close = () => {
    reset();
    onClose();
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await tuFetch<{ data: TuKey }>("/dashboard/keys", {
        json: {
          name: name || (kind === "secret" ? "My server" : "My website"),
          kind,
          allowed_origins: origins.split(/[\s,]+/).filter(Boolean),
        },
      });
      setCreated(res.data);
      onCreated();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={created && created.kind === "secret" && !saved ? () => {} : close} title={created ? "Your new key is ready" : "Create an API key"}>
      {!created && !kind && (
        <div className="space-y-3">
          <p className="text-sm text-[#F1F5F9]/75">Where will you send emails from?</p>
          {[
            {
              id: "public" as const,
              icon: Globe,
              title: "From my website",
              text: "For contact forms, sign-up forms and file uploads on a website. Safe to put in HTML or JavaScript.",
              tag: "Public key",
            },
            {
              id: "secret" as const,
              icon: Server,
              title: "From my server / backend",
              text: "For apps that send welcome emails, receipts, password resets, and more. Never share it.",
              tag: "Secret key",
            },
          ].map((o) => (
            <button
              key={o.id}
              onClick={() => setKind(o.id)}
              className="w-full text-left rounded-xl border border-[#F1F5F9]/15 hover:border-[#14B8A6] p-4 flex gap-3 transition-colors cursor-pointer"
            >
              <span className="w-10 h-10 rounded-xl bg-[#14B8A6]/15 text-[#14B8A6] flex items-center justify-center shrink-0">
                <o.icon className="w-5 h-5" />
              </span>
              <span>
                <span className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[#F1F5F9]">{o.title}</span>
                  <Tag tone={o.id === "secret" ? "violet" : "teal"}>{o.tag}</Tag>
                </span>
                <span className="block text-xs text-[#F1F5F9]/65 mt-1">{o.text}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {!created && kind && (
        <form onSubmit={create} className="space-y-4">
          <Field label="Key name" help="Just for you, so you remember what it's for.">
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === "secret" ? "e.g. Production server" : "e.g. Company website"} />
          </Field>
          {kind === "public" && (
            <Field
              label="Which websites can use this key?"
              help="Only these websites can send with this key. Others are blocked, even if they copy it. Separate several with commas."
            >
              <Input value={origins} onChange={(e) => setOrigins(e.target.value)} placeholder="https://mywebsite.com, http://localhost:5500" required />
            </Field>
          )}
          {error && <Notice tone="error">{error}</Notice>}
          <div className="flex justify-between gap-2">
            <Button type="button" variant="ghost" onClick={() => setKind(null)}>
              ← Back
            </Button>
            <Button type="submit" loading={busy}>
              Create key
            </Button>
          </div>
        </form>
      )}

      {created && (
        <div className="space-y-4">
          {created.kind === "secret" ? (
            <Notice tone="warning" title="Copy this key now">
              For your security we only show the full secret key once. Store it somewhere safe, such as your server&apos;s environment variables.
            </Notice>
          ) : (
            <Notice tone="success" title="Public key created">
              You can paste this key into your website code. It only works on the websites you listed.
            </Notice>
          )}
          <div className="rounded-xl border border-[#F1F5F9]/15 bg-black/40 p-3 font-mono text-xs break-all text-[#F1F5F9]">{created.key}</div>
          <div className="flex flex-wrap gap-2 justify-between items-center">
            <CopyButton value={created.key || ""} label="Copy key" size="md" />
            {created.kind === "secret" && (
              <label className="flex items-center gap-2 text-xs text-[#F1F5F9]/80 cursor-pointer">
                <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="accent-[#14B8A6] w-4 h-4" />
                I&apos;ve saved my key
              </label>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onDocs} disabled={created.kind === "secret" && !saved}>
              See how to use it
            </Button>
            <Button onClick={close} disabled={created.kind === "secret" && !saved}>
              Done
            </Button>
          </div>
          {created.kind === "secret" && (
            <p className="text-[11px] text-[#F1F5F9]/60 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" /> Never put secret keys in website or mobile app code.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}

function EditKeyModal({ k, onClose, onSaved }: { k: TuKey; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(k.name);
  const [origins, setOrigins] = useState(k.allowed_origins.join(", "));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await tuFetch(`/dashboard/keys/${k.id}`, {
        method: "PATCH",
        json: k.kind === "public" ? { name, allowed_origins: origins.split(/[\s,]+/).filter(Boolean) } : { name },
      });
      toast("success", "Key updated.");
      onSaved();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Edit "${k.name}"`}>
      <form onSubmit={save} className="space-y-4">
        <Field label="Key name">
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        {k.kind === "public" && (
          <Field label="Allowed websites" help="Separate several with commas.">
            <Input value={origins} onChange={(e) => setOrigins(e.target.value)} required />
          </Field>
        )}
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Save changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}
