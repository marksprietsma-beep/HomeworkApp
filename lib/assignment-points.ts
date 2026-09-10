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
