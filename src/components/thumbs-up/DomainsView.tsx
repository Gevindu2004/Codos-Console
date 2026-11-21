"use client";

import React, { useState } from "react";
import { Ban, CheckCircle2, Clock, Globe2, Plus, RefreshCw, Search, Trash2, XCircle } from "lucide-react";
import { tuFetch, TuDomain, TuSuppression, timeAgo } from "./api";
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

export function DomainsView({ verified }: { verified: boolean }) {
  return (
    <div className="space-y-10">
      <DomainsSection verified={verified} />
      <SuppressionsSection />
    </div>
  );
}

// ---------------------------------------------------------------- domains
function DomainsSection({ verified }: { verified: boolean }) {
  const toast = useToast();
  const list = useTuData<{ data: TuDomain[]; provider: string; default_from: string }>("/dashboard/domains");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const sesReady = list.data?.provider === "ses";

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await tuFetch<{ data: TuDomain }>("/dashboard/domains", { json: { name } });
      setAdding(false);
      setName("");
      setOpen(r.data.id);
      list.reload();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const check = async (d: TuDomain) => {
    setChecking(d.id);
    try {
      const r = await tuFetch<{ data: TuDomain }>(`/dashboard/domains/${d.id}/check`, { method: "POST" });
      if (r.data.status === "verified") toast("success", `${d.name} is verified! You can now send from any address @${d.name}.`);
      else if (r.data.status === "failed") toast("error", "Verification failed. Check the DNS records and try again.");
      else toast("error", "Not verified yet. DNS changes can take up to an hour (sometimes longer).");
      list.reload();
    } catch (e) {
      toast("error", errorText(e));
    } finally {
      setChecking(null);
    }
  };

  const remove = async (d: TuDomain) => {
    try {
      await tuFetch(`/dashboard/domains/${d.id}`, { method: "DELETE" });
      toast("success", `${d.name} removed.`);
      list.reload();
    } catch (e) {
      toast("error", errorText(e));
    }
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Sending domains"
        subtitle="Send as you@yourcompany.com instead of the default address. Prove you own the domain by adding a few DNS records once."
        action={
          sesReady && (
            <Button onClick={() => setAdding(true)} disabled={!verified}>
              <Plus className="w-4 h-4" /> Add domain
            </Button>
          )
        }
      />
      {list.error && <Notice tone="error">{list.error}</Notice>}
      {!list.data ? (
        <Spinner />
      ) : !sesReady ? (
        <Notice tone="info" title="Sending from your own domain isn't switched on yet">
          Your emails are sent from <b className="font-mono">{list.data.default_from}</b>. Set a <b>Reply-To</b> address in your template,
          so when people answer, the reply comes straight to you.
        </Notice>
      ) : list.data.data.length === 0 ? (
        <EmptyState
          icon={<Globe2 className="w-6 h-6" />}
          title="No domains yet"
          text={`Emails are sent from ${list.data.default_from} until you verify your own domain.`}
          action={
            <Button onClick={() => setAdding(true)} disabled={!verified}>
              <Plus className="w-4 h-4" /> Add domain
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3">
          {list.data.data.map((d) => {
            const showing = open === d.id || (d.status !== "verified" && open !== `hide-${d.id}`);
            return (
            <Card key={d.id} className="p-5 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {d.status === "verified" ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                  ) : d.status === "failed" ? (
                    <XCircle className="w-6 h-6 text-red-500" />
                  ) : (
                    <Clock className="w-6 h-6 text-amber-500" />
                  )}
                  <div>
                    <div className="text-base font-bold text-[#F1F5F9]">{d.name}</div>
                    <div className="text-[11px] text-[#F1F5F9]/60">
                      {d.status === "verified"
                        ? `Verified ${timeAgo(d.verified_at)}. Send from any address @${d.name}`
                        : d.status === "failed"
                          ? "Verification failed: check your DNS records"
                          : `Waiting for DNS records${d.last_checked_at ? ` · last checked ${timeAgo(d.last_checked_at)}` : ""}`}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setOpen(showing ? `hide-${d.id}` : d.id)}>
                    {showing ? "Hide DNS records" : "DNS records"}
                  </Button>
                  {d.status !== "verified" && (
                    <Button size="sm" loading={checking === d.id} onClick={() => check(d)}>
                      <RefreshCw className="w-3.5 h-3.5" /> Check now
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => remove(d)} aria-label="Remove domain">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              {showing && (
                <div className="space-y-2">
                  <p className="text-xs text-[#F1F5F9]/70">
                    Add these records at your domain provider (GoDaddy, Cloudflare, Namecheap, …), then press <b>Check now</b>.
                  </p>
                  <div className="overflow-x-auto rounded-xl border border-[#F1F5F9]/12">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-[#F1F5F9]/60 border-b border-[#F1F5F9]/10">
                          <th className="px-3 py-2">Type</th>
                          <th className="px-3 py-2">Name / Host</th>
                          <th className="px-3 py-2">Value</th>
                          <th className="px-3 py-2">Why</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F1F5F9]/10">
                        {d.records.map((r) => (
                          <tr key={r.name + r.value}>
                            <td className="px-3 py-2 font-mono font-bold text-[#14B8A6]">{r.type}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[#F1F5F9] break-all">{r.name}</span>
                                <CopyButton value={r.name} label="" />
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[#F1F5F9] break-all">{r.value}</span>
                                <CopyButton value={r.value} label="" />
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <Tag tone={r.required ? "teal" : "slate"}>{r.purpose}</Tag>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </Card>
            );
          })}
        </div>
      )}
      {!verified && sesReady && <Notice tone="warning">Verify your account email first to add domains.</Notice>}

      <Modal open={adding} onClose={() => setAdding(false)} title="Add a sending domain">
        <form onSubmit={add} className="space-y-4">
          <Field label="Your domain" help="The part after @ in the address you want to send from.">
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="mycompany.com" required />
          </Field>
          {error && <Notice tone="error">{error}</Notice>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Add domain
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------- suppression list
const REASON: Record<string, [string, "teal" | "slate" | "violet"]> = {
  bounce: ["Bounced", "violet"],
  complaint: ["Marked as spam", "violet"],
  manual: ["Added by you", "slate"],
};

function SuppressionsSection() {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const list = useTuData<{ data: TuSuppression[]; total: number }>(
    `/dashboard/suppressions${search ? `?q=${encodeURIComponent(search)}` : ""}`
  );
  const [adding, setAdding] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await tuFetch("/dashboard/suppressions", { json: { email } });
      setAdding(false);
      setEmail("");
      list.reload();
    } catch (err) {
      setError(errorText(err));
    }
  };

  const remove = async (s: TuSuppression) => {
    try {
      await tuFetch(`/dashboard/suppressions/${s.id}`, { method: "DELETE" });
      toast("success", `${s.email} can receive your emails again.`);
      list.reload();
    } catch (e) {
      toast("error", errorText(e));
    }
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Suppression list"
        subtitle="Addresses that bounced or reported you as spam are skipped automatically, which protects your sender reputation. Remove an address only if you're sure it works again."
        action={
          <Button variant="secondary" onClick={() => setAdding(true)}>
            <Ban className="w-4 h-4" /> Block an address
          </Button>
        }
      />
      <form
        className="relative max-w-md"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(query);
        }}
      >
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#F1F5F9]/50" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search an address, then press Enter" className="pl-9" />
      </form>
      {!list.data ? (
        <Spinner />
      ) : list.data.data.length === 0 ? (
        <Card className="p-8 text-center text-sm text-[#F1F5F9]/65">
          {search ? "No blocked address matches your search." : "Nothing here. That's good news: no bounces or spam reports."}
        </Card>
      ) : (
        <Card className="divide-y divide-[#F1F5F9]/10">
          {list.data.data.map((s) => (
            <div key={s.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-5 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#F1F5F9] break-all">{s.email}</span>
                  <Tag tone={REASON[s.reason][1]}>{REASON[s.reason][0]}</Tag>
                </div>
                <div className="text-[11px] text-[#F1F5F9]/60 truncate">
                  {s.detail || "—"} · {timeAgo(s.created_at)}
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={() => remove(s)}>
                Remove
              </Button>
            </div>
          ))}
        </Card>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Block an address">
        <form onSubmit={add} className="space-y-4">
          <Field label="Email address" help="ThumbsUp will never send to this address from your account.">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="someone@example.com" required />
          </Field>
          {error && <Notice tone="error">{error}</Notice>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button type="submit">Block address</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
