"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { InteractiveConsoleDashboard } from "@/components/InteractiveConsoleDashboard";

export default function ConsolePage() {
  const router = useRouter();

  const handleReturnToLanding = () => {
    router.push("/");
  };

  return <InteractiveConsoleDashboard onReturnToLanding={handleReturnToLanding} />;
}

