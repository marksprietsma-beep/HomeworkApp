import assert from "node:assert/strict";
import test from "node:test";
import { assertDraftFeedbackScoreTarget, assertDraftFeedbackScoreUpdated, assertQuestionPointsEditable, calculateHomeworkPoints, getAssignmentTotalPoints, validateScoreAwarded } from "../lib/assignment-points";
test("canonical assignment total requires complete positive point data", () => {
  assert.equal(getAssignmentTotalPoints([{ points: 4 }, { points: 6 }]), 10);
  assert.equal(getAssignmentTotalPoints([{ points: 4 }, { points: null }]), null);
  assert.equal(getAssignmentTotalPoints([]), null);
});
test("question point meaning is locked after any score exists", () => {
  assert.doesNotThrow(() => assertQuestionPointsEditable(10, 10, true));
  assert.doesNotThrow(() => assertQuestionPointsEditable(10, 20, false));
  assert.throws(() => assertQuestionPointsEditable(10, 20, true), /cannot be changed while scored feedback exists/);
});
test("draft score correction requires matching canonical submission but clearing remains safe", () => {
  const valid = { releaseState: "DRAFT", studentId: 3, submissionId: 18, submission: { assignmentId: 42, studentId: 3 } };
  assert.doesNotThrow(() => assertDraftFeedbackScoreTarget(valid, 42, 7));
  assert.doesNotThrow(() => assertDraftFeedbackScoreTarget({ ...valid, submissionId: null, submission: null }, 42, null));
  assert.throws(() => assertDraftFeedbackScoreTarget({ ...valid, releaseState: "RELEASED" }, 42, 7), /Only draft/);
  assert.throws(() => assertDraftFeedbackScoreTarget({ ...valid, submission: { assignmentId: 42, studentId: 4 } }, 42, 7), /real submission/);
});
test("draft score write rejects a concurrent state change before update", () => {
  assert.doesNotThrow(() => assertDraftFeedbackScoreUpdated(1));
  assert.throws(() => assertDraftFeedbackScoreUpdated(0), /Only draft feedback scores can be edited/);
});
test("homework points reward submitted completion and rounded released quality", () => {
  assert.equal(calculateHomeworkPoints({ submitted: false, assignmentTotalPoints: 10, releasedScoreAwarded: 10 }), 0);
  assert.equal(calculateHomeworkPoints({ submitted: true, assignmentTotalPoints: null, releasedScoreAwarded: null }), 10);
  assert.equal(calculateHomeworkPoints({ submitted: true, assignmentTotalPoints: 20, releasedScoreAwarded: 0 }), 10);
  assert.equal(calculateHomeworkPoints({ submitted: true, assignmentTotalPoints: 20, releasedScoreAwarded: 9 }), 15);
  assert.equal(calculateHomeworkPoints({ submitted: true, assignmentTotalPoints: 20, releasedScoreAwarded: 20 }), 20);
});
test("scores are optional whole numbers bounded by the canonical total", () => {
  assert.equal(validateScoreAwarded(null, 10), null);
  assert.equal(validateScoreAwarded(7, 10), null);
  assert.match(validateScoreAwarded(-1, 10) ?? "", /negative/);
  assert.match(validateScoreAwarded(7.5, 10) ?? "", /whole/);
  assert.match(validateScoreAwarded(11, 10) ?? "", /exceed/);
  assert.match(validateScoreAwarded(1, null) ?? "", /every question/);
});
