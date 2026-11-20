"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PublishWizard } from "@/components/developer/PublishWizard";

export default function PublishPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/developer"
          className="flex items-center gap-1.5 text-xs text-[#CBD5E1] hover:text-[#14B8A6] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Dashboard
        </Link>
      </div>
      {/* Unified single-page submission form */}
      <PublishWizard />
    </div>
  );
}
