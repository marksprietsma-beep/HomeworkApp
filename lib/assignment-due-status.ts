import { SubmissionStatus } from "@prisma/client";

export type AssignmentDueStatus =
  | "no-due-date"
  | "due"
  | "overdue"
  | "missing"
  | "late"
  | "on-time"
  | "submitted";

export type AssignmentDueStatusSummary = {
  status: AssignmentDueStatus;
  label: string;
  tone: "slate" | "blue" | "amber" | "red" | "emerald";
  priority: number;
};

type DueStatusSubmission = {
  status?: string | null;
  submittedAt?: Date | null;
} | null;

export function getAssignmentDueStatus(
  dueAt: Date | null,
  submission: DueStatusSubmission,
  now = new Date(),
): AssignmentDueStatusSummary {
  const isSubmitted = submission?.status === SubmissionStatus.SUBMITTED;

  if (!dueAt) {
    return isSubmitted
      ? { status: "submitted", label: "Submitted", tone: "emerald", priority: 40 }
      : { status: "no-due-date", label: "Assigned", tone: "slate", priority: 50 };
  }

  if (isSubmitted) {
    if (submission?.submittedAt && submission.submittedAt.getTime() > dueAt.getTime()) {
      return { status: "late", label: "Late", tone: "amber", priority: 20 };
    }

    return { status: "on-time", label: "On time", tone: "emerald", priority: 60 };
  }

  if (dueAt.getTime() < now.getTime()) {
    return submission
      ? { status: "overdue", label: "Overdue", tone: "red", priority: 0 }
      : { status: "missing", label: "Missing", tone: "red", priority: 0 };
  }

  return { status: "due", label: "Due", tone: "blue", priority: 30 };
}
