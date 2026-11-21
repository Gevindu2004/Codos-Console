import { describe, expect, it } from "vitest";
import type { SubmissionStatus } from "@/components/developer/types";
import { createSeededAdminState } from "./adminApi";

describe("Admin governance seed state", () => {
  it("includes review lifecycle queues, linked live products, and deterministic demo timestamps", () => {
    const state = createSeededAdminState();
    const statuses = new Set<SubmissionStatus>(state.submissions.map((submission) => submission.payload.status));

    expect((["Submitted", "Validating", "Testing", "Under Review"] as const).every((status) => statuses.has(status))).toBe(true);
    expect(state.liveProducts.find((product) => product.id === "third-party-weather")?.submissionId).toBe("sub-api-published");
    expect(state.auditEvents.every((event) => Number.isFinite(Date.parse(event.timestamp)))).toBe(true);
    expect(state.liveProducts.every((product) => Number.isFinite(Date.parse(product.updatedAt)))).toBe(true);
  });
});
