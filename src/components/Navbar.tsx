"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ViaCodosLogo } from "./ViaCodosLogo";
import {
  LayoutDashboard,
  Sun,
  Moon,
  X,
  ChevronRight,
} from "lucide-react";

interface NavbarProps {
  activeView?: "landing" | "dashboard";
  onToggleView?: (view: "landing" | "dashboard") => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeView = "landing",
  onToggleView,
}) => {
  const [activeNav, setActiveNav] = useState("Services");
  const [scrolled, setScrolled] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = localStorage.getItem("codos-theme") as "dark" | "light" | null;
    if (saved === "light" || saved === "dark") {
      setTheme(saved);
      document.documentElement.setAttribute("data-theme", saved);
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("codos-theme", nextTheme);
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navItems = [
    { label: "Services", href: "#services" },
    { label: "Call Colleague", href: "#voice-service" },
    { label: "Thumbs Up API", href: "#api-service" },
    { label: "Sky Beak LLM", href: "#llm-service" },
    { label: "Console", href: "/console" },
    { label: "Model Hub", href: "/models" },
    { label: "API Marketplace", href: "/apis" },
    { label: "Pricing", href: "#pricing" },
    { label: "Developer Portal", href: "/developer" },
    { label: "Admin Portal", href: "/admin" },
  ];

  const handleNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    item: { label: string; href: string }
  ) => {
    // External routes (not hash anchors) — navigate directly
    if (!item.href.startsWith("#")) {
      window.location.href = item.href;
      return;
    }
    e.preventDefault();
    setActiveNav(item.label);
    const targetId = item.href.replace("#", "");

    const isServiceCard =
      targetId === "voice-service" ||
      targetId === "api-service" ||
      targetId === "llm-service";

    // Notify ServicesSection which card (if any) was explicitly selected
    window.dispatchEvent(
      new CustomEvent("codos:highlight-service", {
        detail: isServiceCard ? targetId : null,
      })
    );

    // On desktop (>= 1024px), all 3 service cards sit side-by-side inside #services.
    // Scrolling to #services aligns the section title and all 3 cards cleanly below the navbar.
    if (isServiceCard && window.innerWidth >= 1024) {
      const servicesSection = document.getElementById("services");
      if (servicesSection) {
        servicesSection.scrollIntoView({ behavior: "smooth", block: "start" });
        window.history.replaceState(null, "", item.href);
        return;
      }
    }

    const targetEl = document.getElementById(targetId);
    if (targetEl) {
      if (isServiceCard) {
        // On mobile/tablet (< 1024px), cards stack vertically — offset for fixed navbar
        const y =
          targetEl.getBoundingClientRect().top + window.scrollY - 88;
        window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
      } else {
        targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      window.history.replaceState(null, "", item.href);
    }
  };

  const isLight = theme === "light";

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? isLight
            ? "py-2.5 bg-[#F4EDE0]/90 backdrop-blur-2xl border-b border-[#0F172A]/10 shadow-lg"
            : "py-2.5 bg-[#0F172A]/85 backdrop-blur-2xl border-b border-[#F1F5F9]/10 shadow-2xl"
          : "py-4 bg-transparent"
      }`}
    >
      <div className="w-full px-6 sm:px-10 lg:px-12 flex items-center justify-between">
        {/* Upper Left: Official Via Codos (PVT) LTD Logo */}
        <Link
          href="/"
          className="flex items-center focus:outline-none group"
          aria-label="Via Codos Console Home"
        >
          <ViaCodosLogo size="sm" />
        </Link>

        {/* Center: Frosted Capsule Pill Navigation */}
        <nav
          className={`hidden md:flex items-center gap-1 p-1 rounded-full backdrop-blur-2xl border transition-colors duration-300 ${
            isLight
              ? "bg-[#F1F5F9]/85 border-[#0B0B0C]/15 shadow-[0_8px_28px_rgba(11,11,12,0.08)]"
              : "bg-[#0F172A]/65 border-[#F1F5F9]/[0.16] shadow-[0_8px_32px_rgba(0,0,0,0.35)]"
          }`}
          aria-label="Primary Navigation"
        >
          {navItems.map((item) => {
            const isActive = activeNav === item.label;
            return (
              <a
                key={item.label}
                href={item.href}
                onClick={(e) => handleNavClick(e, item)}
                className={`relative px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-300 flex items-center gap-2 ${
                  isActive
                    ? isLight
                      ? "bg-[#14213D] !text-[#FFFFFF] shadow-sm font-semibold"
                      : "bg-[#F1F5F9]/[0.14] text-[#F1F5F9] shadow-inner border border-[#F1F5F9]/15"
                    : isLight
                    ? "text-[#0B0B0C]/80 hover:text-[#14213D] hover:bg-[#14213D]/[0.08]"
                    : "text-[#F1F5F9]/75 hover:text-[#F1F5F9] hover:bg-[#F1F5F9]/[0.06]"
                }`}
              >
                {isActive && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isLight
                        ? "bg-[#FFFFFF]"
                        : "bg-[#14B8A6] shadow-[0_0_8px_#14B8A6]"
                    }`}
                  />
                )}
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>

        {/* Right: Light/Dark Theme Toggle Circle + Menu Circle */}
        <div className="flex items-center gap-2.5">
          {/* Theme Toggle Button (Sun / Moon) */}
          <button
            onClick={toggleTheme}
            title={
              isLight
                ? "Switch to Dark Theme (#0F172A)"
                : "Switch to Light Cream Theme (#F4EDE0)"
            }
            className={`w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer ${
              isLight
                ? "bg-[#14213D] !text-[#FFFFFF] hover:bg-[#0B0B0C]"
                : "bg-[#F1F5F9] text-[#0F172A] hover:bg-[#14B8A6]"
            }`}
            aria-label="Toggle Light/Dark Theme"
          >
            {isLight ? (
              <Moon className="w-4 h-4 stroke-[2.2]" />
            ) : (
              <Sun className="w-4 h-4 stroke-[2.2]" />
            )}
          </button>

          {/* Frosted Equal Menu Circle */}
          <button
            onClick={() => setDrawerOpen(!drawerOpen)}
            title="Console Quick Menu"
            className={`w-9 h-9 rounded-full backdrop-blur-xl border flex flex-col items-center justify-center gap-1.5 shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer ${
              isLight
                ? "bg-[#14213D] border-[#14213D] !text-[#FFFFFF] hover:bg-[#0B0B0C]"
                : "bg-[#0F172A]/65 border-[#F1F5F9]/25 text-[#F1F5F9] hover:border-[#14B8A6]"
            }`}
            aria-label="Toggle Navigation Drawer"
          >
            {drawerOpen ? (
              <X className="w-4 h-4" />
            ) : (
              <>
                <span className="w-3.5 h-[1.8px] rounded-full bg-[#FFFFFF]" />
                <span className="w-3.5 h-[1.8px] rounded-full bg-[#FFFFFF]" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Quick Console Drawer */}
      {drawerOpen && (
        <div
          className={`max-w-md ml-auto mr-6 sm:mr-12 mt-3 rounded-3xl backdrop-blur-2xl border p-5 shadow-2xl space-y-4 animate-in fade-in slide-in-from-top-3 duration-200 ${
            isLight
              ? "bg-[#F1F5F9]/95 border-[#0B0B0C]/15 text-[#0B0B0C]"
              : "bg-[#0F172A]/95 border-[#F1F5F9]/20 text-[#F1F5F9]"
          }`}
        >
          <div className="flex items-center justify-between border-b border-[#F1F5F9]/10 pb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#F1F5F9]/70">
              Codos Console Quick Access
            </span>
            <span className="text-[11px] font-mono text-[#14B8A6] flex items-center gap-1">
              <span
                className={`w-1.5 h-1.5 rounded-full animate-ping ${
                  isLight ? "bg-[#14213D]" : "bg-[#14B8A6]"
                }`}
              />
              All 3 Services Online
            </span>
          </div>

          <div className="space-y-1">
            {navItems.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={(e) => {
                  handleNavClick(e, link);
                  setDrawerOpen(false);
                }}
                className="px-3.5 py-2 rounded-xl text-sm text-[#F1F5F9]/90 hover:bg-[#14B8A6]/10 flex items-center justify-between transition-colors"
              >
                <span>{link.label}</span>
                <ChevronRight className="w-4 h-4 text-[#14B8A6]" />
              </a>
            ))}
          </div>

          <div className="pt-2 border-t border-[#F1F5F9]/10 flex flex-col gap-2.5">
            {onToggleView && (
              <button
                onClick={() => {
                  onToggleView(
                    activeView === "landing" ? "dashboard" : "landing"
                  );
                  setDrawerOpen(false);
                }}
                className="codos-cta-btn w-full py-2.5 rounded-full bg-[#14B8A6] hover:bg-[#0D9488] text-[#0F172A] text-xs font-bold flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>
                  {activeView === "landing"
                    ? "Open Interactive Console Dashboard ↗"
                    : "Return to Landing Page"}
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
