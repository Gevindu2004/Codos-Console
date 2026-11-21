// Ready-made designs so nobody starts from a blank page.

export interface StarterTemplate {
  id: string;
  name: string;
  description: string;
  subject: string;
  html: string;
  allow_public: boolean;
  auto_reply?: boolean;
  auto_reply_subject?: string;
  auto_reply_text?: string;
  sample: Record<string, string>;
}

const wrap = (inner: string) => `<div style="font-family:Arial,Helvetica,sans-serif;background:#f1f5f9;padding:32px 12px">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;padding:32px;color:#0f172a">
${inner}
  </div>
  <p style="text-align:center;font-size:11px;color:#94a3b8;margin-top:16px">Sent with ThumbsUp Email</p>
</div>`;

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: "contact",
    name: "Contact form",
    description: "Website visitors send you a message. You can reply straight from your inbox.",
    subject: "New message from {{name}}",
    allow_public: true,
    auto_reply: true,
    auto_reply_subject: "Thanks for contacting us, {{name}}",
    auto_reply_text: "Hi {{name}},\n\nThanks for your message. We'll get back to you soon.\n\nBest regards",
    sample: { name: "Nimal Perera", email: "nimal@example.com", phone: "077 123 4567", message: "Hi! I'd like to know more about your services." },
    html: wrap(`    <h2 style="margin:0 0 4px">📬 New message from your website</h2>
    <p style="color:#64748b;margin:0 0 24px">Reply to this email to answer {{name}} directly.</p>
    <p><b>Name:</b> {{name}}<br><b>Email:</b> {{email}}<br><b>Phone:</b> {{phone}}</p>
    <div style="background:#f8fafc;border-left:4px solid #14b8a6;padding:16px;border-radius:8px">{{message}}</div>`),
  },
  {
    id: "welcome",
    name: "Welcome email",
    description: "Greet new users right after they sign up.",
    subject: "Welcome to {{company}}, {{name}}! 🎉",
    allow_public: false,
    sample: { name: "Oshan", company: "Via Codos", link: "https://example.com/start" },
    html: wrap(`    <h1 style="margin:0 0 12px">Welcome aboard, {{name}}! 🎉</h1>
    <p>We're really happy to have you at <b>{{company}}</b>. Your account is ready.</p>
    <p style="margin:28px 0"><a href="{{link}}" style="background:#14b8a6;color:#0f172a;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:bold">Get started</a></p>
    <p style="color:#64748b">If you have any questions, just reply to this email.</p>`),
  },
  {
    id: "otp",
    name: "Verification code (OTP)",
    description: "One-time codes for login, sign-up or password reset.",
    subject: "Your verification code is {{code}}",
    allow_public: false,
    sample: { name: "Oshan", code: "482 915", minutes: "10" },
    html: wrap(`    <h2 style="margin:0 0 12px">Your verification code</h2>
    <p>Hi {{name}}, use this code to continue:</p>
    <div style="font-size:34px;letter-spacing:8px;font-weight:bold;background:#f1f5f9;border-radius:12px;padding:18px;text-align:center;margin:20px 0">{{code}}</div>
    <p style="color:#64748b">The code expires in {{minutes}} minutes. If you didn't ask for it, you can ignore this email.</p>`),
  },
  {
    id: "receipt",
    name: "Order receipt",
    description: "Confirm a purchase with the order details.",
    subject: "Receipt for order #{{order_id}}",
    allow_public: false,
    sample: { name: "Kamal", order_id: "10482", item: "Premium plan (1 year)", amount: "LKR 24,900.00", date: "18 Nov 2026" },
    html: wrap(`    <h2 style="margin:0 0 4px">Thanks for your order, {{name}}!</h2>
    <p style="color:#64748b;margin:0 0 24px">Order #{{order_id}} · {{date}}</p>
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:12px 0;border-bottom:1px solid #e2e8f0">{{item}}</td><td style="padding:12px 0;border-bottom:1px solid #e2e8f0;text-align:right">{{amount}}</td></tr>
      <tr><td style="padding:12px 0;font-weight:bold">Total</td><td style="padding:12px 0;text-align:right;font-weight:bold">{{amount}}</td></tr>
    </table>`),
  },
  {
    id: "careers",
    name: "Job application (with CV upload)",
    description: "Candidates apply on your website and attach their CV.",
    subject: "New application: {{name}} for {{position}}",
    allow_public: true,
    auto_reply: true,
    auto_reply_subject: "We received your application, {{name}}",
    auto_reply_text: "Hi {{name}},\n\nThank you for applying for {{position}}. Our team will review your CV and contact you.\n\nGood luck!",
    sample: { name: "Ayesha Silva", email: "ayesha@example.com", position: "Frontend Developer", message: "I have 3 years of React experience." },
    html: wrap(`    <h2 style="margin:0 0 4px">🧑‍💼 New job application</h2>
    <p style="color:#64748b;margin:0 0 24px">The CV is attached to this email.</p>
    <p><b>Name:</b> {{name}}<br><b>Email:</b> {{email}}<br><b>Position:</b> {{position}}</p>
    <div style="background:#f8fafc;border-left:4px solid #14b8a6;padding:16px;border-radius:8px">{{message}}</div>`),
  },
];

const VAR = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;

export function extractVariables(...parts: string[]): string[] {
  const out: string[] = [];
  for (const p of parts) {
    for (const m of (p || "").matchAll(VAR)) if (!out.includes(m[1])) out.push(m[1]);
  }
  return out;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

/** Same rules as the server: values are HTML-escaped inside HTML. */
export function renderLocal(tpl: string, vars: Record<string, string>, html: boolean): string {
  return (tpl || "").replace(VAR, (_, name: string) => {
    const v = vars[name] ?? "";
    return html ? esc(v).replace(/\n/g, "<br>") : v;
  });
}
