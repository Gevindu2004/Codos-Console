import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://console.viacodos.com"),
  title: {
    default: "Codos Console | Premier SaaS Platform for AI Voice, API Gateway & LLM Orchestration",
    template: "%s | Codos Console",
  },
  description:
    "Codos Console by Via Codos (PVT) LTD is the next-generation unified SaaS platform to deploy, monitor, and scale AI Call Colleagues (voice agents), high-throughput Thumbs Up APIs, and multi-model LLM services through one enterprise account.",
  keywords: [
    "SaaS platform",
    "best SaaS platform",
    "enterprise SaaS platform",
    "Codos Console",
    "Via Codos",
    "Via Codos PVT LTD",
    "AI Call Colleague",
    "conversational voice AI",
    "Thumbs Up API",
    "API gateway SaaS",
    "LLM routing service",
    "AI voice agent platform",
    "unified developer console",
    "ElevenLabs alternative",
    "Twilio alternative",
    "voice AI customer service",
    "multi-model LLM gateway",
  ],
  authors: [{ name: "Via Codos (PVT) LTD", url: "https://viacodos.com" }],
  creator: "Via Codos (PVT) LTD",
  publisher: "Via Codos (PVT) LTD",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: "https://console.viacodos.com",
  },
  icons: {
    icon: [
      { url: "/assets/codos-tab-logo-blue.png", type: "image/png" },
      { url: "/icon.png", type: "image/png", sizes: "64x64" },
    ],
    shortcut: "/assets/codos-tab-logo-blue.png",
    apple: "/assets/codos-tab-logo-blue.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://console.viacodos.com",
    title: "Codos Console | Premier SaaS Platform for AI Voice, API Gateway & LLM Services",
    description:
      "Access, configure, and scale AI Call Colleagues, Thumbs Up API, and LLM Studio from one unified console with centralized billing and real-time observability.",
    siteName: "Codos Console",
    images: [
      {
        url: "/assets/via-codos-logo.jpg",
        width: 1200,
        height: 630,
        alt: "Codos Console - Unified SaaS Platform by Via Codos",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Codos Console | Enterprise SaaS Platform for Voice AI, API & LLMs",
    description:
      "Deploy autonomous voice agents, unified API gateways, and resilient multi-model LLM clusters with Codos Console.",
    images: ["/assets/via-codos-logo.jpg"],
    creator: "@ViaCodos",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  category: "technology",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://console.viacodos.com/#organization",
        name: "Via Codos (PVT) LTD",
        url: "https://viacodos.com",
        logo: "https://console.viacodos.com/assets/via-codos-logo.jpg",
        sameAs: ["https://twitter.com/ViaCodos", "https://linkedin.com/company/viacodos"],
      },
      {
        "@type": "WebSite",
        "@id": "https://console.viacodos.com/#website",
        url: "https://console.viacodos.com",
        name: "Codos Console",
        publisher: { "@id": "https://console.viacodos.com/#organization" },
        potentialAction: {
          "@type": "SearchAction",
          target: "https://console.viacodos.com/search?q={search_term_string}",
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "SoftwareApplication",
        "@id": "https://console.viacodos.com/#software",
        name: "Codos Console SaaS Platform",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Cloud, Web",
        offers: {
          "@type": "AggregateOffer",
          priceCurrency: "USD",
          lowPrice: "0",
          highPrice: "999",
        },
        description:
          "Enterprise unified SaaS platform facilitating autonomous AI Call Colleagues, Thumbs Up API microservices, and multi-model LLM router.",
        featureList: [
          "AI Call Colleague: Real-time autonomous conversational voice telephony",
          "Thumbs Up API: Developer-first high-throughput secure API gateway",
          "LLM Studio: Multi-model AI routing with failover and prompt caching",
          "Unified Account Management & Consolidated Billing",
        ],
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: "4.9",
          ratingCount: "380",
        },
      },
    ],
  };

  return (
    <html lang="en" className="dark scroll-smooth">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-screen bg-[#0F172A] text-[#F1F5F9] antialiased selection:bg-[#14B8A6] selection:text-[#0F172A]">
        {children}
      </body>
    </html>
  );
}
