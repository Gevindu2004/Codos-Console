"use client";

import React, { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { HeroSection } from "@/components/HeroSection";
import { ServicesSection } from "@/components/ServicesSection";
import { UnifiedArchitecture } from "@/components/UnifiedArchitecture";
import { PricingSection } from "@/components/PricingSection";
import { SeoFooter } from "@/components/SeoFooter";
import { InteractiveConsoleDashboard } from "@/components/InteractiveConsoleDashboard";

export default function Home() {
  const [view, setView] = useState<"landing" | "dashboard">("landing");
  const [initialTab, setInitialTab] = useState<"overview" | "voice" | "api" | "llm">("overview");

  const handleOpenDashboard = (tab: "overview" | "voice" | "api" | "llm" = "overview") => {
    setInitialTab(tab);
    setView("dashboard");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleReturnToLanding = () => {
    setView("landing");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (view === "dashboard") {
    return (
      <InteractiveConsoleDashboard
        initialTab={initialTab}
        onReturnToLanding={handleReturnToLanding}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0F172A] text-[#F1F5F9] flex flex-col selection:bg-[#14B8A6] selection:text-[#0F172A]">
      {/* Top Navigation */}
      <Navbar activeView="landing" onToggleView={() => handleOpenDashboard("overview")} />

      {/* Main Content Area */}
      <main className="flex-1">
        {/* Hero Section with Glassmorphic Floating Stack */}
        <HeroSection onOpenDashboard={() => handleOpenDashboard("overview")} />

        {/* Three Core Services Showcase (AI Call Colleague, Thumbs Up API, LLM Studio) */}
        <ServicesSection onSelectService={(serviceId) => handleOpenDashboard(serviceId)} />

        {/* Unified Architecture & Developer SDKs */}
        <UnifiedArchitecture />

        {/* Transparent Unified Pricing */}
        <PricingSection onGetStarted={() => handleOpenDashboard("overview")} />
      </main>

      {/* Semantic SEO Footer */}
      <SeoFooter />
    </div>
  );
}
