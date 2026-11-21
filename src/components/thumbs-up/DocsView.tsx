"use client";

import React, { useState } from "react";
import { Globe, Server } from "lucide-react";
import { THUMBSUP_API_URL, TuKey, TuTemplate } from "./api";
import { useTuData } from "./hooks";
import { Card, CodeBlock, Field, Notice, SectionHeader, Select, TabBar } from "./ui";
import type { TuView } from "./ThumbsUpEmailWorkspace";

type WebLang = "html" | "react" | "fetch";
type ServerLang = "node" | "python" | "curl" | "php";

export function DocsView({ go }: { go: (v: TuView) => void }) {
  const keys = useTuData<{ data: TuKey[] }>("/dashboard/keys");
  const templates = useTuData<{ data: TuTemplate[] }>("/dashboard/templates");
  const [webLang, setWebLang] = useState<WebLang>("html");
  const [serverLang, setServerLang] = useState<ServerLang>("node");
  const [pkId, setPkId] = useState("");
  const [tplId, setTplId] = useState("");

  const publicKeys = (keys.data?.data || []).filter((k) => k.kind === "public");
  const formTemplates = (templates.data?.data || []).filter((t) => t.allow_public);
  const pk = publicKeys.find((k) => k.id === pkId) || publicKeys[0];
  const tpl = formTemplates.find((t) => t.id === tplId) || formTemplates[0];
  const PK = pk?.key || "tu_pk_YOUR_PUBLIC_KEY";
  const TPL = tpl?.id || "tpl_YOUR_TEMPLATE_ID";
  const API = THUMBSUP_API_URL;

  const web: Record<WebLang, [string, string]> = {
    html: [
      "html",
      `<!-- 1. Your form: any field names you like ({{name}} in the template = name="name") -->
<form id="contact-form" enctype="multipart/form-data">
  <input type="hidden" name="public_key" value="${PK}">
  <input type="hidden" name="template_id" value="${TPL}">

  <input name="name" placeholder="Your name" required>
  <input name="email" type="email" placeholder="Your email" required>
  <textarea name="message" placeholder="Message"></textarea>
  <input name="attachment" type="file">            <!-- optional file upload -->

  <!-- Anti-spam trap: hidden from people, bots fill it -->
  <input name="_honey" style="display:none" tabindex="-1" autocomplete="off">

  <button type="submit">Send</button>
  <p id="form-status"></p>
</form>

<!-- 2. Send it with ThumbsUp -->
<script>
document.getElementById("contact-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const status = document.getElementById("form-status");
  status.textContent = "Sending...";
  const res = await fetch("${API}/v1/forms/send", { method: "POST", body: new FormData(e.target) });
  const data = await res.json();
  status.textContent = res.ok ? "Thanks! Your message was sent." : data.error.message;
  if (res.ok) e.target.reset();
});
</script>`,
    ],
    react: [
      "tsx",
      `export function ContactForm() {
  const [status, setStatus] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("Sending...");
    const form = new FormData(e.currentTarget);
    form.append("public_key", "${PK}");
    form.append("template_id", "${TPL}");
    const res = await fetch("${API}/v1/forms/send", { method: "POST", body: form });
    const data = await res.json();
    setStatus(res.ok ? "Thanks! Your message was sent." : data.error.message);
  }

  return (
    <form onSubmit={onSubmit}>
      <input name="name" placeholder="Your name" required />
      <input name="email" type="email" placeholder="Your email" required />
      <textarea name="message" />
      <input name="attachment" type="file" />
      <input name="_honey" style={{ display: "none" }} tabIndex={-1} autoComplete="off" />
      <button type="submit">Send</button>
      <p>{status}</p>
    </form>
  );
}`,
    ],
    fetch: [
      "javascript",
      `// Without a <form>: send JSON from any JavaScript code
const res = await fetch("${API}/v1/forms/send", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    public_key: "${PK}",
    template_id: "${TPL}",
    name: "Nimal",
    email: "nimal@example.com",
    message: "Hello!",
  }),
});
console.log(await res.json()); // { id: "em_...", status: "queued" }`,
    ],
  };

  const server: Record<ServerLang, [string, string]> = {
    node: [
      "javascript",
      `// Node.js 18+ (no extra packages needed)
const res = await fetch("${API}/v1/emails", {
  method: "POST",
  headers: {
    "Authorization": \`Bearer \${process.env.THUMBSUP_SECRET_KEY}\`,
    "Content-Type": "application/json",
    "Idempotency-Key": "welcome-user-42",   // optional: never send the same email twice
  },
  body: JSON.stringify({
    from: "Acme <hello@acme.com>",          // optional: needs a verified domain
    to: "customer@example.com",
    subject: "Welcome to our app!",
    html: "<h1>Welcome!</h1><p>Your account is ready.</p>",
    // or use a template instead:
    // template_id: "tpl_...", variables: { name: "Oshan" },
    attachments: [
      { filename: "guide.pdf", content: fs.readFileSync("guide.pdf").toString("base64") },
    ],
  }),
});
const data = await res.json();
if (!res.ok) throw new Error(data.error.message);
console.log("Queued:", data.id);`,
    ],
    python: [
      "python",
      `import base64, os, requests

res = requests.post(
    "${API}/v1/emails",
    headers={"Authorization": f"Bearer {os.environ['THUMBSUP_SECRET_KEY']}"},
    json={
        "to": "customer@example.com",
        "template_id": "tpl_...",            # or "subject" + "html"
        "variables": {"name": "Oshan", "code": "482915"},
        "attachments": [{
            "filename": "invoice.pdf",
            "content": base64.b64encode(open("invoice.pdf", "rb").read()).decode(),
        }],
    },
    timeout=30,
)
res.raise_for_status()
print(res.json())  # {"id": "em_...", "status": "queued"}`,
    ],
    curl: [
      "bash",
      `curl -X POST ${API}/v1/emails \\
  -H "Authorization: Bearer $THUMBSUP_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": ["customer@example.com"],
    "subject": "Your order is confirmed",
    "text": "Thanks for your order!"
  }'

# Check the status later
curl ${API}/v1/emails/em_... -H "Authorization: Bearer $THUMBSUP_SECRET_KEY"`,
    ],
    php: [
      "php",
      `<?php
$ch = curl_init("${API}/v1/emails");
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => [
    "Authorization: Bearer " . getenv("THUMBSUP_SECRET_KEY"),
    "Content-Type: application/json",
  ],
  CURLOPT_POSTFIELDS => json_encode([
    "to" => "customer@example.com",
    "subject" => "Welcome!",
    "html" => "<h1>Welcome!</h1>",
  ]),
]);
echo curl_exec($ch);`,
    ],
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Docs & code"
        subtitle="Copy, paste, done. The examples below already include your keys and templates where possible."
      />

      {/* Website */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-[#14B8A6]/15 text-[#14B8A6] flex items-center justify-center">
            <Globe className="w-5 h-5" />
          </span>
          <div>
            <h3 className="text-base font-bold text-[#F1F5F9]">Send from a website (no backend needed)</h3>
            <p className="text-xs text-[#F1F5F9]/65">Like EmailJS, but your key only works on your websites and spam is blocked automatically.</p>
          </div>
        </div>
        {(publicKeys.length === 0 || formTemplates.length === 0) && (
          <Notice tone="info" title="You'll need two things first">
            {publicKeys.length === 0 && (
              <div>
                • A <b>public key</b>.{" "}
                <button className="font-bold text-[#14B8A6] cursor-pointer" onClick={() => go("keys")}>
                  Create one →
                </button>
              </div>
            )}
            {formTemplates.length === 0 && (
              <div>
                • A template with <b>“Use with website forms”</b> turned on.{" "}
                <button className="font-bold text-[#14B8A6] cursor-pointer" onClick={() => go("templates")}>
                  Create one →
                </button>
              </div>
            )}
          </Notice>
        )}
        {publicKeys.length > 0 && formTemplates.length > 0 && (
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Public key">
              <Select value={pk?.id} onChange={(e) => setPkId(e.target.value)}>
                {publicKeys.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name} ({k.allowed_origins.join(", ")})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Template">
              <Select value={tpl?.id} onChange={(e) => setTplId(e.target.value)}>
                {formTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}
        <TabBar
          tabs={[
            { id: "html", label: "HTML" },
            { id: "react", label: "React / Next.js" },
            { id: "fetch", label: "JavaScript (JSON)" },
          ]}
          value={webLang}
          onChange={setWebLang}
        />
        <CodeBlock language={web[webLang][0]} code={web[webLang][1]} />
        <ul className="text-xs text-[#F1F5F9]/70 space-y-1 list-disc pl-5">
          <li>Every form field becomes a placeholder: a field named <code className="font-mono">phone</code> fills <code className="font-mono">{"{{phone}}"}</code>.</li>
          <li>If the template body is empty, all fields are listed in the email automatically.</li>
          <li>A field named <code className="font-mono">email</code> becomes the reply-to address, so you can answer with one click.</li>
          <li>Up to 5 files per form submission. Big files arrive as secure download links.</li>
        </ul>
      </Card>

      {/* Server */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-violet-500/15 text-violet-500 flex items-center justify-center">
            <Server className="w-5 h-5" />
          </span>
          <div>
            <h3 className="text-base font-bold text-[#F1F5F9]">Send from your server</h3>
            <p className="text-xs text-[#F1F5F9]/65">
              Use a <b>secret key</b>. Store it in an environment variable (<code className="font-mono">THUMBSUP_SECRET_KEY</code>), never in website code.
            </p>
          </div>
        </div>
        <TabBar
          tabs={[
            { id: "node", label: "Node.js" },
            { id: "python", label: "Python" },
            { id: "php", label: "PHP" },
            { id: "curl", label: "cURL" },
          ]}
          value={serverLang}
          onChange={setServerLang}
        />
        <CodeBlock language={server[serverLang][0]} code={server[serverLang][1]} />
      </Card>

      {/* Reference */}
      <Card className="p-6 space-y-4">
        <h3 className="text-base font-bold text-[#F1F5F9]">Quick reference</h3>
        <div className="grid md:grid-cols-2 gap-4 text-xs">
          <div className="space-y-2">
            <div className="font-bold text-[#F1F5F9]">Endpoints</div>
            {[
              ["POST", "/v1/emails", "Send an email (secret key)"],
              ["GET", "/v1/emails/{id}", "Check an email's status (secret key)"],
              ["POST", "/v1/forms/send", "Send from a website form (public key)"],
              ["", "Webhooks", "email.sent · delivered · bounced · complained · failed · form.received"],
            ].map(([m, p, d]) => (
              <div key={p} className="flex gap-2 items-baseline">
                <span className="font-mono font-bold text-[#14B8A6] w-10">{m}</span>
                <span className="font-mono text-[#F1F5F9]">{p}</span>
                <span className="text-[#F1F5F9]/60">· {d}</span>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <div className="font-bold text-[#F1F5F9]">Fields for /v1/emails</div>
            <p className="text-[#F1F5F9]/70 leading-relaxed">
              <code className="font-mono">from</code> (verified domain), <code className="font-mono">to</code>, <code className="font-mono">cc</code>, <code className="font-mono">bcc</code>,{" "}
              <code className="font-mono">reply_to</code>, <code className="font-mono">subject</code>, <code className="font-mono">html</code>,{" "}
              <code className="font-mono">text</code>, <code className="font-mono">template_id</code>, <code className="font-mono">variables</code>,{" "}
              <code className="font-mono">from_name</code>, <code className="font-mono">attachments</code> (filename + base64 content),{" "}
              <code className="font-mono">tags</code>. Header <code className="font-mono">Idempotency-Key</code> prevents duplicates.
            </p>
          </div>
          <div className="space-y-2 md:col-span-2">
            <div className="font-bold text-[#F1F5F9]">Errors are always easy to read</div>
            <CodeBlock
              language="json"
              code={`{ "error": { "code": "origin_not_allowed", "message": "The website 'https://other.com' is not allowed to use this public key.", "hint": "Add your website address to the key's allowed websites in the ThumbsUp dashboard." } }`}
            />
          </div>
        </div>
        <p className="text-xs text-[#F1F5F9]/60">
          Full interactive API reference:{" "}
          <a href={`${API}/docs`} target="_blank" rel="noreferrer" className="font-bold text-[#14B8A6]">
            {API}/docs
          </a>
        </p>
      </Card>
    </div>
  );
}
