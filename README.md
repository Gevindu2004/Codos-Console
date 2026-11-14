# Codos Console — Unified Enterprise AI & API Cloud Platform

**Codos Console** (by **Via Codos (PVT) LTD**) is a centralized enterprise SaaS frontend platform that unifies autonomous voice telephony agents, high-throughput developer API gateways, and multi-model LLM routing under a single account, master API key, and consolidated billing system.

---

## Core Services Included

1. **Call Colleague (Conversational Voice & Telephony AI)**
   - **Live Colleague Dispatcher**: Configure and test sub-80ms WebRTC/SIP voice agents with real-time waveform telemetry and barge-in interruption controls.
   - **Call Colleague Training Studio**: Upload domain voice samples (`.wav`, `.mp3`) and knowledge playbooks (`.jsonl`, `.pdf`), tune acoustic prosody parameters, and run neural voice fine-tuning epochs with live MOS & WER metrics.
   - **Call Colleague API Generation**: Provision colleague-scoped voice API keys and copy syntax-highlighted SDK snippets in TypeScript, Python, cURL, and Go.

2. **Thumbs Up API (High-Throughput Developer API Gateway)**
   - **Categorized API Catalog**: Browse and inspect production endpoints across Voice & Telephony, AI & LLM Orchestration, Gateway Security, and Webhooks & Telemetry, complete with an interactive API Playground.
   - **Master & Scoped API Key Vault**: Generate, rotate, and revoke cryptographic keys with RBAC scopes and token-bucket rate limits.

3. **Sky Beak LLM (Multi-Model AI Orchestration & Training)**
   - **Dynamic Routing Matrix**: Route prompts across Claude, GPT-4o, Gemini, and SkyBeak models with automatic zero-downtime failover and semantic prompt caching.
   - **Unified Sub-Workspaces**: Switch between **Industry AI Models** (Healthcare, Finance, Legal, Retail, Security), **General AI Chatbot**, and **Custom AI Training** directly inside the SkyBeak AI workspace.

---

## Tech Stack

- **Framework**: [Next.js 16.4](https://nextjs.org/) (App Router)
- **UI Library**: [React 19.3](https://react.dev/) & [TypeScript 5](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) + Custom CSS Variables & Glassmorphism Utilities
- **Icons**: [Lucide React](https://lucide.dev/)

---

## Prerequisites

Ensure you have the following installed on your machine before starting:

- **Node.js**: `v20.x` or later (LTS recommended)
- **Package Manager**: `npm` (comes with Node.js), `pnpm`, `yarn`, or `bun`
- **Git**: For cloning and version control

---

## Quick Start for Developers

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd Codos-Console
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy the tracked `.env.example` template to create your local `.env` file:

**macOS / Linux (Bash / Zsh):**
```bash
cp .env.example .env
```

**Windows (PowerShell):**
```powershell
Copy-Item .env.example .env
```

Open `.env` and update any endpoints or sample placeholders if connecting to a custom staging/production backend:

```dotenv
# 1. Public Platform Endpoints & Region Defaults
NEXT_PUBLIC_CODOS_API_BASE_URL=https://api.viacodos.com
NEXT_PUBLIC_CODOS_STREAM_WSS_URL=wss://stream.viacodos.com/v1
NEXT_PUBLIC_CODOS_DEFAULT_REGION=us-east-1

# 2. Public Webhook & Default Model Settings
NEXT_PUBLIC_CALL_COLLEAGUE_WEBHOOK_URL=https://api.viacodos.com/v1/webhooks/voice-events
NEXT_PUBLIC_CALL_COLLEAGUE_VIP_WEBHOOK_URL=https://incident.enterprise.io/hooks/codos-call
NEXT_PUBLIC_SKYBEAK_DEFAULT_MODEL=skybeak-ultra-70b

# 3. Server-Only API Key Samples (Never exposed in client bundles)
CODOS_API_KEY="API KEY 1"
CODOS_ADMIN_API_KEY="API KEY 2"
CODOS_STAGING_API_KEY="API KEY 2"
CALL_COLLEAGUE_API_KEY="API KEY 1"
CALL_COLLEAGUE_VIP_API_KEY="API KEY 2"
SKYBEAK_LLM_API_KEY="API KEY 3"
```

> **Security Note:** `.env`, `.env.*`, and any `env.ts` files are excluded via `.gitignore`. **Never** commit real secret keys to GitHub. Only `.env.example` with generic placeholders (`"API KEY 1"`, `"API KEY 2"`, etc.) should be tracked in Git.

### 4. Start the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.
- The **Landing Page** loads by default with cloud-loading scroll animations, 3D interactive service cards, unified SDK code tabs, and pricing tiers.
- Click **"Launch Console ↗"** (or any service action button) to open the **Interactive Console Dashboard**.

---

## Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the Next.js 16 development server at `http://localhost:3000` with hot-reloading. |
| `npm run build` | Builds the optimized production bundle (`next build --webpack`). |
| `npm run start` | Starts the compiled Next.js production server after running `npm run build`. |
| `npm run lint` | Runs ESLint across the project to catch code quality issues. |
| `npx tsc --noEmit` | Runs a full TypeScript type check without emitting build artifacts. |

---

## Project Structure

```text
Codos-Console/
├── public/
│   └── assets/                        # Official service & brand logos
│       ├── call-colleague-logo.jpg
│       ├── sky-beak-llm-logo.jpg
│       ├── thumbs-up-api-logo.jpg
│       └── via-codos-logo.jpg
├── src/
│   ├── app/
│   │   ├── globals.css                # Tailwind v4 imports, Dark/Light theme rules, syntax tokens & cloud animations
│   │   ├── layout.tsx                 # Root layout, SEO metadata & JSON-LD structured data
│   │   └── page.tsx                   # Main entry point switching between Landing View & Console Dashboard
│   └── components/
│       ├── ApiProductsCatalog.tsx     # Categorized Thumbs Up API catalog & live request sandbox
│       ├── CallColleagueWorkspace.tsx # Call Colleague dispatcher, Training Studio & Voice API Generator
│       ├── HeroSection.tsx            # Full-viewport hero with 3D mouse-reactive background & SLA metrics
│       ├── InteractiveConsoleDashboard.tsx # Unified SaaS console shell, sidebar navigation & key vault
│       ├── Navbar.tsx                 # Fixed capsule navigation, smooth section scrolling & theme switcher
│       ├── PricingSection.tsx         # Unified monthly/annual pricing tiers
│       ├── ScrollCloudReveal.tsx      # Bidirectional cloud-loading scroll reveal wrapper & ambient mist
│       ├── SeoFooter.tsx              # Full-bleed enterprise footer with service quick links
│       ├── ServicesSection.tsx        # 3D tilt cards for Call Colleague, Thumbs Up API & Sky Beak LLM
│       ├── SkyBeakAiWorkspace.tsx     # SkyBeak AI Models (Industry Models, General Chatbot & Custom Training)
│       ├── UnifiedArchitecture.tsx    # Multi-language SDK showcase (TS, PY, CURL, GO) with syntax highlighting
│       └── ViaCodosLogo.tsx           # Official Via Codos (PVT) LTD brand emblem component
├── .env.example                       # Tracked template for environment variables
├── .gitignore                         # Ignores node_modules, .next, .env*, and *env.ts
├── next.config.ts                     # Next.js 16 configuration
├── package.json                       # Dependencies and scripts
└── tsconfig.json                      # TypeScript compiler configuration
```

---

## Design & Security Conventions

1. **API Key Masking in the UI**:
   - All API keys displayed in the UI are masked using `maskApiKey()` so only the first 3 characters are visible followed by asterisks (`API**********`).
   - Clicking **Copy Key** copies the full underlying sample key (`API KEY 1`, `API KEY 2`, etc.) to the clipboard.
2. **Dual Theme Support (`data-theme="dark" | "light"`)**:
   - **Dark Theme (Default)**: Deep Slate `#0F172A` primary canvas, Teal `#14B8A6` accents, and `#F1F5F9` light typography.
   - **Light Theme**:
     - **Landing Page**: Warm Cream `#F4EDE0` background, `#F1F5F9` cards, Midnight Black `#0B0B0C` text, and Rich Navy Blue `#14213D` buttons/accents with `#FFFFFF` button text.
     - **Console Dashboard (`.codos-dashboard`)**: Pure White `#FFFFFF` workspace background and cards with Navy Blue `#14213D` active controls.
3. **Next.js 16 Guidelines**:
   - Refer to `AGENTS.md` and `node_modules/next/dist/docs/` when working with Next.js 16 APIs. Do not remove the auto-generated block inside `AGENTS.md`.

---

## License & Ownership

© 2026 **Via Codos (PVT) LTD**. All rights reserved. Codos Console, Call Colleague, Thumbs Up API, and Sky Beak LLM are proprietary products of Via Codos (PVT) LTD.
