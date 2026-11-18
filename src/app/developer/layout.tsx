"use client";
import React from "react";
import Link from "next/link";
import { LayoutDashboard, Code2, BarChart3, CreditCard, Settings, Package, User, Boxes, ArrowLeft } from "lucide-react";
import { DeveloperProvider } from "../../components/developer/DeveloperContext";

export default function DeveloperLayout({ children }: { children: React.ReactNode }) {
  // In a real app we would obtain the logged‑in developer ID from auth context.
  const devId = "dev-123"; // placeholder

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/developer" },
    { id: "publish", label: "Publish Product", icon: Package, href: "/developer/publish" },
    { id: "apis", label: "My APIs", icon: Code2, href: "/developer/apis" },
    { id: "models", label: "My Models", icon: Code2, href: "/developer/models" },
    { id: "analytics", label: "Analytics & Transactions", icon: BarChart3, href: "/developer/analytics" },
    { id: "earnings", label: "Earnings & Commissions", icon: CreditCard, href: "/developer/earnings" },
    { id: "settings", label: "Profile & Payouts", icon: Settings, href: "/developer/settings" },
    { id: "register", label: "Developer Registration", icon: User, href: "/developer/register" },
  ];

  return (
    <DeveloperProvider devId={devId}>
      <div className="flex min-h-screen bg-[#0F172A] text-[#F1F5F9]">
        {/* Sidebar */}
        <aside className="w-64 border-r border-[#FFFFFF]/10 bg-[#1E293B] p-4 hidden md:flex flex-col">
          <Link href="/" className="flex items-center mb-6">
            <div className="text-2xl font-bold text-[#14B8A6]">Developer Portal</div>
          </Link>
          <div className="mb-4 grid grid-cols-2 gap-2">
            <Link href="/console" className="flex items-center justify-center gap-1.5 rounded-lg border border-[#F1F5F9]/10 px-2 py-2 text-[11px] hover:bg-[#14B8A6]/10">
              <ArrowLeft className="w-3.5 h-3.5" />Console
            </Link>
            <Link href="/models" className="flex items-center justify-center gap-1.5 rounded-lg border border-[#F1F5F9]/10 px-2 py-2 text-[11px] hover:bg-[#14B8A6]/10">
              <Boxes className="w-3.5 h-3.5" />Model Hub
            </Link>
          </div>
          <nav className="flex-1 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-[#14B8A6]/10 transition-colors"
              >
                <item.icon className="w-4 h-4" />
                <span className="text-sm">{item.label}</span>
              </Link>
            ))}
          </nav>
        </aside>
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </DeveloperProvider>
  );
}
