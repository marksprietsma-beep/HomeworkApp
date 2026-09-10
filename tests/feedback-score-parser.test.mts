import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error production parser is a plain ESM module copied by the test runner.
import { parseFeedbackImportJson } from "../lib/feedback-import-parser.mjs";

const context = { assignmentId: 42, classId: 7, assignmentTotalPoints: 10, questions: [{ id: 101 }], participants: [{ id: 3, name: "Alex", submission: { id: 18 } }] };
function payload(scoreAwarded: unknown = undefined, submission: unknown = { id: 18, status: "SUBMITTED" }) {
  const participant: Record<string, unknown> = { participant: { id: 3, name: "Alex" }, submission, overallFeedback: "Useful feedback", strengths: ["Clear"], targets: ["Explain more"] };
  if (scoreAwarded !== undefined) participant.scoreAwarded = scoreAwarded;
  return JSON.stringify({ feedbackFormat: "homework-feedback", feedbackVersion: 1, sourceExport: { exportFormat: "homework-assignment-responses-v2", exportVersion: 2 }, assignment: { id: 42 }, class: { id: 7 }, participantFeedback: [participant] });
}

test("optional valid scores import and ordinary unscored feedback remains compatible", () => {
  assert.equal(parseFeedbackImportJson(payload(7), context).ok, true);
  assert.equal(parseFeedbackImportJson(payload(), context).ok, true);
});
for (const score of [-1, 1.5, 11]) test(`invalid score ${score} is rejected`, () => assert.equal(parseFeedbackImportJson(payload(score), context).ok, false));
test("submission null is rejected when the export contains a real submission", () => {
  const result = parseFeedbackImportJson(payload(7, null), context);
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.some((error: { path: string }) => error.path.endsWith(".submission")));
});
test("score is rejected for an exported participant without a submission or safe denominator", () => {
  assert.equal(parseFeedbackImportJson(payload(1, null), { ...context, participants: [{ id: 3, submission: null }] }).ok, false);
  assert.equal(parseFeedbackImportJson(payload(1), { ...context, assignmentTotalPoints: null }).ok, false);
  assert.equal(parseFeedbackImportJson(payload(undefined, null), { ...context, assignmentTotalPoints: null, participants: [{ id: 3, submission: null }] }).ok, true);
});
