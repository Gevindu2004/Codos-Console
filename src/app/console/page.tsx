"use client";

import React, { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { InteractiveConsoleDashboard } from "@/components/InteractiveConsoleDashboard";

function Console() {
  const router = useRouter();
  const params = useSearchParams();
  // Coming back from "Sign in with Google" (ThumbsUp Sheets): open the Thumbs Up API tab.
  // Read once: ThumbsUp then tidies the address bar, which must not switch the tab back.
  const [initialTab] = useState<"overview" | "api">(() =>
    params.has("tu_sheets") || params.has("tu_sheets_error") ? "api" : "overview"
  );

  const handleReturnToLanding = () => {
    router.push("/");
  };

  return <InteractiveConsoleDashboard initialTab={initialTab} onReturnToLanding={handleReturnToLanding} />;
}

export default function ConsolePage() {
  return (
    <Suspense fallback={null}>
      <Console />
    </Suspense>
  );
}
