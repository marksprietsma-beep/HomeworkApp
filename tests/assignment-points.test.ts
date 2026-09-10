import assert from "node:assert/strict";
import test from "node:test";
import { calculateHomeworkPoints, getAssignmentTotalPoints, validateScoreAwarded } from "../lib/assignment-points";
test("canonical assignment total requires complete positive point data", () => {
  assert.equal(getAssignmentTotalPoints([{ points: 4 }, { points: 6 }]), 10);
  assert.equal(getAssignmentTotalPoints([{ points: 4 }, { points: null }]), null);
  assert.equal(getAssignmentTotalPoints([]), null);
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
