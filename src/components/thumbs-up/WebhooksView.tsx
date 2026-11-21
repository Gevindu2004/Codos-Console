"use client";

import React, { useState } from "react";
import { CheckCircle2, Eye, Plus, Send, Trash2, Webhook, XCircle } from "lucide-react";
import { tuFetch, TuWebhook, TuWebhookDelivery, timeAgo } from "./api";
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
  Tag,
  errorText,
  useToast,
} from "./ui";

const EVENT_HELP: Record<string, string> = {
  "email.sent": "An email was delivered to the mail server",
  "email.failed": "An email could not be sent",
  "form.received": "Someone submitted one of your website forms",
};

const VERIFY_SNIPPET = `// Node.js (Express): check that a webhook really came from ThumbsUp
import crypto from "crypto";

app.post("/thumbsup-webhook", express.raw({ type: "application/json" }), (req, res) => {
  const ts = req.header("ThumbsUp-Timestamp");
  const sig = req.header("ThumbsUp-Signature"); // "v1=..."
  const expected = "v1=" + crypto
    .createHmac("sha256", process.env.THUMBSUP_WEBHOOK_SECRET)
    .update(ts + "." + req.body)
    .digest("hex");
  if (sig !== expected || Date.now() / 1000 - Number(ts) > 300) return res.sendStatus(401);

  const event = JSON.parse(req.body);
  console.log(event.type, event.data.id); // e.g. "email.sent", "em_..."
  res.sendStatus(200);
});`;

export function WebhooksView() {
  const toast = useToast();
  const list = useTuData<{ data: TuWebhook[]; events: string[] }>("/dashboard/webhooks");
  const [adding, setAdding] = useState(false);
  const [revealed, setRevealed] = useState<TuWebhook | null>(null);
  const [historyFor, setHistoryFor] = useState<TuWebhook | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  const test = async (w: TuWebhook) => {
    setTesting(w.id);
    try {
      const r = await tuFetch<{ data: TuWebhookDelivery }>(`/dashboard/webhooks/${w.id}/test`, { method: "POST" });
      if (r.data.success) toast("success", `Your server answered ${r.data.status_code}. Webhook works!`);
      else toast("error", `Test failed: ${r.data.response || `status ${r.data.status_code}`}`);
    } catch (e) {
      toast("error", errorText(e));
    } finally {
      setTesting(null);
    }
  };

  const remove = async (w: TuWebhook) => {
    try {
      await tuFetch(`/dashboard/webhooks/${w.id}`, { method: "DELETE" });
      toast("success", "Webhook removed.");
      list.reload();
    } catch (e) {
      toast("error", errorText(e));
    }
  };

  const toggle = async (w: TuWebhook) => {
    try {
      await tuFetch(`/dashboard/webhooks/${w.id}`, { method: "PUT", json: { url: w.url, events: w.events, enabled: !w.enabled } });
      list.reload();
    } catch (e) {
      toast("error", errorText(e));
    }
  };

  const reveal = async (w: TuWebhook) => {
    try {
      const r = await tuFetch<{ data: TuWebhook }>(`/dashboard/webhooks/${w.id}/secret`);
      setRevealed(r.data);
    } catch (e) {
      toast("error", errorText(e));
    }
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Webhooks"
        subtitle="Get notified on your own server the moment something happens: an email is sent, fails, or a website form is submitted."
        action={
          <Button onClick={() => setAdding(true)}>
            <Plus className="w-4 h-4" /> Add webhook
          </Button>
        }
      />
      {list.error && <Notice tone="error">{list.error}</Notice>}
      {!list.data ? (
        <Spinner />
      ) : list.data.data.length === 0 ? (
        <EmptyState
          icon={<Webhook className="w-6 h-6" />}
          title="No webhooks yet"
          text="Webhooks are optional. Add one if your app needs to react automatically, for example to save form submissions to your database."
          action={
            <Button onClick={() => setAdding(true)}>
              <Plus className="w-4 h-4" /> Add webhook
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3">
          {list.data.data.map((w) => (
            <Card key={w.id} className="p-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${w.enabled ? "bg-emerald-500" : "bg-[#94A3B8]"}`} />
                    <span className="text-sm font-bold text-[#F1F5F9] break-all">{w.url}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {w.events.map((e) => (
                      <Tag key={e} tone="slate">
                        {e}
                      </Tag>
                    ))}
                  </div>
                  <div className="text-[11px] text-[#F1F5F9]/60">
                    Added {timeAgo(w.created_at)} · {w.enabled ? "Active" : "Paused"}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Button variant="secondary" size="sm" loading={testing === w.id} onClick={() => test(w)}>
                    <Send className="w-3.5 h-3.5" /> Send test
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setHistoryFor(w)}>
                    History
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => reveal(w)}>
                    <Eye className="w-3.5 h-3.5" /> Secret
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => toggle(w)}>
                    {w.enabled ? "Pause" : "Resume"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(w)} aria-label="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card className="p-6 space-y-3">
        <h3 className="text-sm font-bold text-[#F1F5F9]">Check that a webhook is really from ThumbsUp</h3>
        <p className="text-xs text-[#F1F5F9]/70">
          Every webhook is signed with your secret. Verify the signature so nobody can fake events.
        </p>
        <CodeBlock language="javascript" code={VERIFY_SNIPPET} />
      </Card>

      <AddWebhookModal
        open={adding}
        events={list.data?.events || Object.keys(EVENT_HELP)}
        onClose={() => setAdding(false)}
        onCreated={(w) => {
          setAdding(false);
          setRevealed(w);
          list.reload();
        }}
      />

      <Modal open={!!revealed} onClose={() => setRevealed(null)} title="Signing secret">
        <Notice tone="info">Use this secret on your server to verify webhook signatures. Keep it private.</Notice>
        <div className="rounded-xl border border-[#F1F5F9]/15 bg-black/40 p-3 font-mono text-xs break-all text-[#F1F5F9]">{revealed?.secret}</div>
        <div className="flex justify-between">
          <CopyButton value={revealed?.secret || ""} label="Copy secret" size="md" />
          <Button onClick={() => setRevealed(null)}>Done</Button>
        </div>
      </Modal>

      {historyFor && <HistoryModal w={historyFor} onClose={() => setHistoryFor(null)} />}
    </div>
  );
}

function AddWebhookModal({
  open,
  events,
  onClose,
  onCreated,
}: {
  open: boolean;
  events: string[];
  onClose: () => void;
  onCreated: (w: TuWebhook) => void;
}) {
  const [url, setUrl] = useState("");
  const [chosen, setChosen] = useState<string[]>(events);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await tuFetch<{ data: TuWebhook }>("/dashboard/webhooks", { json: { url, events: chosen } });
      setUrl("");
      onCreated(r.data);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add a webhook">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Your server URL" help="ThumbsUp will send a POST request with JSON to this address.">
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://myapp.com/thumbsup-webhook" required />
        </Field>
        <div className="space-y-2">
          <div className="text-xs font-semibold text-[#F1F5F9]/85">Which events?</div>
          {events.map((ev) => (
            <label key={ev} className="flex items-start gap-3 rounded-xl border border-[#F1F5F9]/12 p-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 w-4 h-4 accent-[#14B8A6]"
                checked={chosen.includes(ev)}
                onChange={(e) => setChosen((c) => (e.target.checked ? [...c, ev] : c.filter((x) => x !== ev)))}
              />
              <span>
                <span className="block text-sm font-mono font-semibold text-[#F1F5F9]">{ev}</span>
                <span className="block text-xs text-[#F1F5F9]/65">{EVENT_HELP[ev]}</span>
              </span>
            </label>
          ))}
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy} disabled={!chosen.length}>
            Add webhook
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function HistoryModal({ w, onClose }: { w: TuWebhook; onClose: () => void }) {
  const { data } = useTuData<{ data: TuWebhookDelivery[] }>(`/dashboard/webhooks/${w.id}/deliveries`);
  return (
    <Modal open onClose={onClose} title="Recent deliveries" wide>
      {!data ? (
        <Spinner />
      ) : data.data.length === 0 ? (
        <p className="text-sm text-[#F1F5F9]/65 py-6 text-center">Nothing sent to this webhook yet.</p>
      ) : (
        <div className="divide-y divide-[#F1F5F9]/10">
          {data.data.map((d) => (
            <div key={d.id} className="py-3 flex items-start justify-between gap-4">
              <div className="flex items-start gap-2.5 min-w-0">
                {d.success ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5" /> : <XCircle className="w-4 h-4 text-red-500 mt-0.5" />}
                <div className="min-w-0">
                  <div className="text-sm font-mono text-[#F1F5F9]">{d.event}</div>
                  <div className="text-[11px] text-[#F1F5F9]/60 truncate">{d.response || "No response body"}</div>
                </div>
              </div>
              <div className="text-right shrink-0 text-[11px] text-[#F1F5F9]/60">
                <div>{d.status_code ? `HTTP ${d.status_code}` : "No answer"}</div>
                <div>
                  {d.attempts} attempt{d.attempts === 1 ? "" : "s"} · {timeAgo(d.created_at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
