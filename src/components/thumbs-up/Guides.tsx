"use client";

// Step-by-step guides for people who have never used an API.
// One per product: how to get a key, and how to use it.

import React, { useState } from "react";
import { ArrowRight, CheckCircle2, Lightbulb } from "lucide-react";
import { THUMBSUP_API_URL, TuAssetConfig, TuSheetConfig } from "./api";
import { useTuData } from "./hooks";
import { Button, Card, CodeBlock, CopyButton, Notice, TabBar } from "./ui";

type Step = {
  title: string;
  body: React.ReactNode;
  action?: { label: string; onClick: () => void };
  code?: { language: string; code: string };
};

function Steps({ steps }: { steps: Step[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((s, i) => (
        <li key={s.title}>
          <Card className="p-5">
            <div className="flex gap-4">
              <div className="w-9 h-9 shrink-0 rounded-full bg-[#14B8A6] text-[#0F172A] font-bold flex items-center justify-center codos-cta-btn">
                {i + 1}
              </div>
              <div className="min-w-0 flex-1 space-y-2.5">
                <h3 className="font-bold text-[#F1F5F9] text-base">{s.title}</h3>
                <div className="text-sm text-[#F1F5F9]/80 leading-relaxed space-y-2">{s.body}</div>
                {s.code && <CodeBlock language={s.code.language} code={s.code.code} />}
                {s.action && (
                  <Button size="sm" onClick={s.action.onClick}>
                    {s.action.label} <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </li>
      ))}
    </ol>
  );
}

function GuideHeader({ title, intro }: { title: string; intro: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h2 className="text-xl font-bold text-[#F1F5F9]">{title}</h2>
      <p className="text-sm text-[#F1F5F9]/75 max-w-3xl leading-relaxed">{intro}</p>
    </div>
  );
}

function Words({ items }: { items: [string, string][] }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 font-bold text-[#F1F5F9] mb-3">
        <Lightbulb className="w-4 h-4 text-[#14B8A6]" /> Words you&apos;ll see
      </div>
      <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
        {items.map(([word, meaning]) => (
          <div key={word}>
            <dt className="text-sm font-bold text-[#F1F5F9]">{word}</dt>
            <dd className="text-xs text-[#F1F5F9]/70 leading-relaxed">{meaning}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

// ====================================================================== Email
export function EmailGuide({ go }: { go: (view: "keys" | "templates" | "send" | "logs" | "domains" | "docs") => void }) {
  const [path, setPath] = useState<"website" | "app">("website");
  const site: Step[] = [
    {
      title: "Make the email (a template)",
      body: (
        <>
          <p>
            A template is what the email looks like: the subject and the message. Write <b>{"{{name}}"}</b> where you want the
            visitor&apos;s answer to appear.
          </p>
          <p>
            Turn on <b>Use with website forms</b> and type <b>where the emails should go</b> (for example your own inbox). Website
            forms can only send to these addresses, so nobody can misuse your form to spam people.
          </p>
        </>
      ),
      action: { label: "Open Templates", onClick: () => go("templates") },
    },
    {
      title: "Get a public key",
      body: (
        <>
          <p>
            Go to <b>API Keys → Create API key → From my website</b>. Type your website&apos;s address, for example <b>https://myshop.com</b>. While
            you build the site on your computer, add <b>http://localhost:3000</b> too.
          </p>
          <p>A public key is safe to put in website code: it only works on the websites you listed.</p>
        </>
      ),
      action: { label: "Open API Keys", onClick: () => go("keys") },
    },
    {
      title: "Paste this form into your website",
      body: <p>Replace the two values in CAPITALS with your public key and your template&apos;s ID (both have a Copy button).</p>,
      code: {
        language: "html",
        code: `<form action="${THUMBSUP_API_URL}/v1/forms/send" method="POST">
  <input type="hidden" name="public_key" value="YOUR_PUBLIC_KEY">
  <input type="hidden" name="template_id" value="YOUR_TEMPLATE_ID">
  <input name="name" placeholder="Your name" required>
  <input name="email" type="email" placeholder="Your email" required>
  <textarea name="message" placeholder="Message"></textarea>
  <input type="text" name="_gotcha" style="display:none"> <!-- stops spam robots -->
  <button>Send</button>
</form>`,
      },
    },
    {
      title: "Try it and check it worked",
      body: <p>Fill in your form once. Then open <b>Email Logs</b>: you&apos;ll see the email and whether it was delivered.</p>,
      action: { label: "Open Email Logs", onClick: () => go("logs") },
    },
  ];
  const app: Step[] = [
    {
      title: "Get a secret key",
      body: (
        <>
          <p>
            Go to <b>API Keys → Create API key → From my server / backend</b> and copy it. It&apos;s shown <b>only once</b>.
          </p>
          <p>
            A secret key is like a password: keep it on your server (in a <b>.env</b> file), never in website code or in GitHub.
          </p>
        </>
      ),
      action: { label: "Open API Keys", onClick: () => go("keys") },
    },
    {
      title: "Send an email from your code",
      body: <p>Any language that can send a web request works. JavaScript (Node.js) example:</p>,
      code: {
        language: "javascript",
        code: `await fetch("${THUMBSUP_API_URL}/v1/emails", {
  method: "POST",
  headers: {
    Authorization: "Bearer " + process.env.THUMBSUP_SECRET_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    to: "customer@example.com",
    subject: "Your order is ready",
    html: "<p>Thanks for your order!</p>",
  }),
});`,
      },
    },
    {
      title: "Check it worked",
      body: (
        <p>
          The answer says <b>queued</b>: ThumbsUp now delivers it (and tries again if the mail server is busy). Open <b>Email Logs</b> to
          see <b>Delivered</b>.
        </p>
      ),
      action: { label: "Open Email Logs", onClick: () => go("logs") },
    },
    {
      title: "More (when you need it)",
      body: (
        <p>
          Files, templates with {"{{variables}}"}, CC/BCC and more examples (Python, PHP, cURL) are in <b>Docs &amp; Code</b>.
        </p>
      ),
      action: { label: "Open Docs & Code", onClick: () => go("docs") },
    },
  ];
  return (
    <div className="space-y-5 max-w-4xl">
      <GuideHeader
        title="How to use ThumbsUp Email"
        intro="Send emails from a website form or from your own app, without running a mail server. Pick how you'll use it:"
      />
      <TabBar
        tabs={[
          { id: "website", label: "From a website form (no coding needed)" },
          { id: "app", label: "From my app or server" },
        ]}
        value={path}
        onChange={setPath}
      />
      <Steps steps={path === "website" ? site : app} />
      <Words
        items={[
          ["API", "A way for one program to ask another to do something. Here: your website asks ThumbsUp to send an email."],
          ["API key", "A long password that tells ThumbsUp the request is yours."],
          ["Public key (tu_pk_…)", "Safe in website code. Works only on the websites you list, only for website forms."],
          ["Secret key (tu_sk_…)", "Full access. Keep it on a server only, like a password."],
          ["Template", "A saved email design you reuse, with blanks like {{name}} filled in for each email."],
          ["Bounced", "The address doesn't exist. ThumbsUp stops sending to it to protect your reputation."],
        ]}
      />
    </div>
  );
}

// ====================================================================== Drive Assets
export function DriveGuide({ goProjects, goKeys }: { goProjects: () => void; goKeys: () => void }) {
  const config = useTuData<TuAssetConfig>("/dashboard/assets/config");
  const robot = config.data?.robot_email || "the ThumbsUp robot email (shown when you connect)";
  const verify = config.data?.verification_file || "thumbsup-verify-…";
  const steps: Step[] = [
    {
      title: "Put the website files in one Google Drive folder",
      body: (
        <p>
          Create a folder in Google Drive (for example <b>My Shop Website</b>) and put the pictures, videos and PDFs in it. Sub-folders are fine.
          Give files clear names, like <b>hero.jpg</b> or <b>menu.pdf</b>.
        </p>
      ),
    },
    {
      title: "Share the folder with the ThumbsUp robot",
      body: (
        <>
          <p>
            Right-click the folder → <b>Share</b> → add this email as <b>Viewer</b>:
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <code className="font-mono text-[#14B8A6] text-xs break-all">{robot}</code>
            {config.data?.robot_email && <CopyButton value={config.data.robot_email} />}
          </div>
          <p>The robot can only look at this folder. It can never change or delete anything.</p>
        </>
      ),
    },
    {
      title: "Prove the folder is yours",
      body: (
        <>
          <p>
            In the folder, create an empty file with exactly this name (New → Google Docs is fine, then rename it):
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <code className="font-mono text-[#14B8A6] text-xs">{verify}</code>
            {config.data?.verification_file && <CopyButton value={config.data.verification_file} />}
          </div>
          <p>Only someone who can edit the folder can add it, so nobody else can connect your folder.</p>
        </>
      ),
    },
    {
      title: "Connect the folder",
      body: (
        <p>
          Copy the folder&apos;s link from your browser&apos;s address bar, then <b>Projects → Connect a Drive folder</b>, paste it, and press Connect.
          After about a minute the files show as <b>Live</b>.
        </p>
      ),
      action: { label: "Open Projects", onClick: goProjects },
    },
    {
      title: "Use the links on your website",
      body: (
        <p>
          Every file gets a link that never changes. Copy it from the project&apos;s Files tab and use it in the website, for example:
        </p>
      ),
      code: {
        language: "html",
        code: `<img src="${config.data?.assets_base_url || THUMBSUP_API_URL}/a/my-shop/hero.jpg" alt="Our shop">

<!-- smaller, faster version of a big photo: -->
<img src="${config.data?.assets_base_url || THUMBSUP_API_URL}/a/my-shop/hero.jpg?w=800&format=webp">`,
      },
    },
    {
      title: "Change a picture any time, no developer needed",
      body: (
        <p>
          Upload a new file with <b>the same name</b> to the same folder (or use Drive&apos;s <b>Manage versions → Upload new version</b>). The
          website shows the new one within about a minute. Deleted something by mistake? The old file keeps working for{" "}
          {config.data?.grace_minutes || 30} minutes, so you have time to upload the replacement.
        </p>
      ),
    },
    {
      title: "API key: only for developers",
      body: (
        <p>
          The links above work without any key. A <b>secret key</b> is only needed if a developer wants to list the files or start a refresh from
          their own code (see the project&apos;s How to use tab).
        </p>
      ),
      action: { label: "Open API Keys", onClick: goKeys },
    },
  ];
  return (
    <div className="space-y-5 max-w-4xl">
      <GuideHeader
        title="How to use Drive Assets"
        intro="Your client keeps website pictures, videos and documents in Google Drive. The website shows them from links that never change. Replace a file with the same name and the website updates by itself."
      />
      <Steps steps={steps} />
      <Words
        items={[
          ["Folder link", "The address of the Drive folder, copied from the browser (https://drive.google.com/drive/folders/…)."],
          ["Robot", "A Google account owned by ThumbsUp. It only reads folders you share with it."],
          ["Verification file", "An empty file whose name proves you can edit the folder."],
          ["Live", "The file is copied and its link works on websites."],
        ]}
      />
    </div>
  );
}

// ====================================================================== Sheets
export function SheetsGuide({ goSheets, goKeys }: { goSheets: () => void; goKeys: () => void }) {
  const config = useTuData<TuSheetConfig>("/dashboard/sheets/config");
  const [path, setPath] = useState<"website" | "app">("app");
  const common: Step[] = [
    {
      title: "Connect Google and create the sheet",
      body: (
        <p>
          Go to <b>Sheets → Connect a sheet</b>.{" "}
          {config.data?.oauth_enabled ? (
            <>
              Press <b>Continue with Google</b> and allow access. ThumbsUp can only see the sheets you create or pick here, nothing else in your Drive.
              Then give the sheet a name and press <b>Create sheet</b>: it appears in your Google Drive.
            </>
          ) : (
            <>Share your Google Sheet with the robot email shown there (as Editor), paste the link, and add the code it gives you to the sheet&apos;s name.</>
          )}
        </p>
      ),
      action: { label: "Open Sheets", onClick: goSheets },
    },
    {
      title: "Create the columns from your code",
      body: (
        <>
          <p>
            Open your sheet → <b>Columns from code</b>. Paste your website form&apos;s HTML (or React code, SQL, or an example of the data) and press{" "}
            <b>Find columns</b>. Check the list, then press <b>Apply to Google Sheets</b>. The column names appear in the sheet&apos;s first row.
          </p>
          <p>
            Change columns any time under <b>Tables &amp; columns</b>. Deleting a column moves the ones on its right one place left, like in
            Google Sheets, and your code keeps working because it uses names, not letters.
          </p>
        </>
      ),
    },
  ];
  const app: Step[] = [
    ...common,
    {
      title: "Get a secret key",
      body: (
        <p>
          <b>API Keys → Create API key → From my server / backend</b>. Copy it (shown only once) and keep it on your server, like a password.
        </p>
      ),
      action: { label: "Open API Keys", onClick: goKeys },
    },
    {
      title: "Save and read rows from your code",
      body: <p>Use your sheet&apos;s ID (on the sheet&apos;s <b>API &amp; code</b> tab) and the table name:</p>,
      code: {
        language: "javascript",
        code: `const url = "${THUMBSUP_API_URL}/v1/sheets/YOUR_SHEET_ID/contacts/rows";
const headers = { Authorization: "Bearer " + process.env.THUMBSUP_SECRET_KEY, "Content-Type": "application/json" };

// add a row
await fetch(url, { method: "POST", headers, body: JSON.stringify({ name: "Ann", email: "ann@example.com" }) });

// read rows
const { rows } = await fetch(url, { headers }).then(r => r.json());`,
      },
    },
    {
      title: "See the data",
      body: (
        <p>
          New rows show up in the sheet&apos;s <b>Data</b> tab right away, and in the Google Sheet within a few seconds. You can also edit rows by
          hand in Google Sheets: ThumbsUp notices.
        </p>
      ),
    },
  ];
  const site: Step[] = [
    ...common,
    {
      title: "Allow website forms to add rows",
      body: (
        <p>
          On the sheet&apos;s <b>Tables &amp; columns</b> tab, turn on <b>Website forms can add rows</b> for your table. Forms can only add rows.
          They can never read or change your data.
        </p>
      ),
    },
    {
      title: "Get a public key for your website",
      body: (
        <p>
          <b>API Keys → Create API key → From my website</b>, and type your website&apos;s address (and <b>http://localhost:3000</b> while you build it).
        </p>
      ),
      action: { label: "Open API Keys", onClick: goKeys },
    },
    {
      title: "Paste the form into your website",
      body: (
        <p>
          The sheet&apos;s <b>API &amp; code → Website form</b> tab has this code ready with your table&apos;s address. Put your public key in it:
        </p>
      ),
      code: {
        language: "html",
        code: `<form action="${THUMBSUP_API_URL}/v1/sheets/submit/YOUR_TABLE_ID" method="POST">
  <input type="hidden" name="public_key" value="YOUR_PUBLIC_KEY">
  <input type="hidden" name="_redirect" value="https://your-site.com/thank-you">
  <input name="name" required>
  <input name="email" type="email" required>
  <input type="text" name="_gotcha" style="display:none"> <!-- stops spam robots -->
  <button>Send</button>
</form>`,
      },
    },
  ];
  return (
    <div className="space-y-5 max-w-4xl">
      <GuideHeader
        title="How to use Sheets"
        intro="Use a Google Sheet as a simple database. Your website or app saves rows into it, reads them, changes and deletes them. Everyone in the team can open the sheet and see the data."
      />
      <TabBar
        tabs={[
          { id: "app", label: "From my app or server" },
          { id: "website", label: "From a website form" },
        ]}
        value={path}
        onChange={setPath}
      />
      <Steps steps={path === "app" ? app : site} />
      <Notice tone="success" title="Good to know">
        <div className="space-y-1">
          <div className="flex gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" /> Every table gets id, created_at and updated_at automatically.
          </div>
          <div className="flex gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" /> Text that looks like a formula (=SUM…) is saved as plain text, so it can never run.
          </div>
          <div className="flex gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" /> Google allows about 60 changes a minute per account; ThumbsUp groups changes so hundreds of rows fit.
          </div>
        </div>
      </Notice>
      <Words
        items={[
          ["Table", "One tab of the spreadsheet. Its first row holds the column names."],
          ["Column", "One kind of information, like name or email. Each has a type (text, number, email…), so wrong values are refused."],
          ["Row", "One record, like one person who filled in your form."],
          ["Secret key / public key", "Secret: for servers, full access. Public: for website forms, can only add rows."],
        ]}
      />
    </div>
  );
}
