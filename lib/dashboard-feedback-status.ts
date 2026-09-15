export type DashboardFeedbackStatus = {
  submitted: number;
  imported: number;
  released: number;
  kind: "no-submissions" | "not-created" | "draft" | "partial" | "released";
  label: string;
  tone: "slate" | "red" | "amber" | "blue" | "emerald";
};

type SubmittedResponse = { id: number; studentId: number };
type FeedbackRow = { studentId: number | null; submissionId: number | null; releaseState: string };

/** Summarises feedback against the submitted response it belongs to. */
export function getDashboardFeedbackStatus(submissions: SubmittedResponse[], feedbackRows: FeedbackRow[]): DashboardFeedbackStatus {
  const feedbackBySubmission = new Map<number, FeedbackRow[]>();
  for (const feedback of feedbackRows) {
    if (feedback.submissionId === null) continue;
    const existing = feedbackBySubmission.get(feedback.submissionId) ?? [];
    existing.push(feedback);
    feedbackBySubmission.set(feedback.submissionId, existing);
  }

  let imported = 0;
  let released = 0;
  for (const submission of submissions) {
    const matching = (feedbackBySubmission.get(submission.id) ?? []).filter(
      (feedback) => feedback.studentId === submission.studentId,
    );
    if (matching.length > 0) imported += 1;
    if (matching.some((feedback) => feedback.releaseState === "RELEASED")) released += 1;
  }

  const submitted = submissions.length;
  if (submitted === 0) return { submitted, imported, released, kind: "no-submissions", label: "No submitted work", tone: "slate" };
  if (imported === 0) return { submitted, imported, released, kind: "not-created", label: "Feedback not created", tone: "red" };
  if (released === 0) return { submitted, imported, released, kind: "draft", label: "Feedback draft — not released", tone: "amber" };
  if (released < submitted) return { submitted, imported, released, kind: "partial", label: `Feedback ${released}/${submitted} released`, tone: "blue" };
  return { submitted, imported, released, kind: "released", label: `Feedback ${released}/${submitted} released`, tone: "emerald" };
}
