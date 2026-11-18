import type {
  ApiSubmissionPayload,
  ModelSubmissionPayload,
  SubmissionStatus,
} from "./types";

export type SubmissionMode = "resume" | "fix" | "edit" | "view";
export type SubmissionAction = {
  label: string;
  mode: SubmissionMode;
};
export type CachedSubmission =
  | { type: "api"; payload: ApiSubmissionPayload }
  | { type: "model"; payload: ModelSubmissionPayload };

export function getPrimarySubmissionAction(status: SubmissionStatus): SubmissionAction {
  switch (status) {
    case "Draft":
      return { label: "Resume Draft", mode: "resume" };
    case "Changes Requested":
      return { label: "Fix & Resubmit", mode: "fix" };
    case "Submitted":
    case "Validating":
    case "Testing":
    case "Under Review":
      return { label: "View Submission", mode: "view" };
    case "Approved":
    case "Published":
    case "Suspended":
    case "Unpublished":
    case "Rejected":
      return { label: "Edit / New Version", mode: "edit" };
  }
}

export function createSubmissionDraftId(type: "api" | "model", index: number) {
  return `${type}-${index}`;
}

export function cacheSubmissionForPublish(
  draftId: string,
  submission: CachedSubmission
) {
  window.sessionStorage.setItem(
    `codos-submission-${draftId}`,
    JSON.stringify(submission)
  );
}
