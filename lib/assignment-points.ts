export type PointBearingQuestion = { points: number | null };

/** A denominator is safe only when every assignment question has positive integer points. */
export function getAssignmentTotalPoints(questions: PointBearingQuestion[]): number | null {
  if (questions.length === 0 || questions.some((question) => !Number.isInteger(question.points) || (question.points ?? 0) <= 0)) {
    return null;
  }
  const total = questions.reduce((sum, question) => sum + (question.points ?? 0), 0);
  return Number.isSafeInteger(total) && total > 0 ? total : null;
}

export function validateScoreAwarded(score: unknown, total: number | null): string | null {
  if (score === null || score === undefined) return null;
  if (!Number.isInteger(score)) return "Score must be a whole number.";
  if (total === null) return "A score cannot be saved because every question must have points.";
  if ((score as number) < 0) return "Score cannot be negative.";
  if ((score as number) > total) return `Score cannot exceed the assignment total of ${total}.`;
  return null;
}

export function calculateHomeworkPoints(input: { submitted: boolean; assignmentTotalPoints: number | null; releasedScoreAwarded: number | null }) {
  if (!input.submitted) return 0;
  if (input.assignmentTotalPoints === null || input.releasedScoreAwarded === null || validateScoreAwarded(input.releasedScoreAwarded, input.assignmentTotalPoints)) return 10;
  return 10 + Math.round(10 * input.releasedScoreAwarded / input.assignmentTotalPoints);
}

export function assertQuestionPointsEditable(existingPoints: number | null, nextPoints: number | null, hasScoredFeedback: boolean) {
  if (hasScoredFeedback && existingPoints !== nextPoints) {
    throw new Error("Question points cannot be changed while scored feedback exists. Clear or replace draft scores first.");
  }
}

export function assertDraftFeedbackScoreTarget(target: { releaseState: string; studentId: number | null; submissionId: number | null; submission: { assignmentId: number; studentId: number } | null } | null, assignmentId: number, score: number | null) {
  if (!target || target.releaseState !== "DRAFT") throw new Error("Only draft feedback scores can be edited.");
  if (score !== null && (!target.studentId || !target.submissionId || target.submission?.assignmentId !== assignmentId || target.submission.studentId !== target.studentId)) {
    throw new Error("A score requires a real submission belonging to this student and assignment.");
  }
}

export function assertDraftFeedbackScoreUpdated(updatedCount: number) {
  if (updatedCount !== 1) throw new Error("Only draft feedback scores can be edited.");
}
