import assert from "node:assert/strict";
import test from "node:test";
import { getDashboardFeedbackStatus } from "../lib/dashboard-feedback-status";

const submissions = [
  { id: 11, studentId: 101 },
  { id: 12, studentId: 102 },
  { id: 13, studentId: 103 },
];

test("shows that assignments without submitted work need no feedback", () => {
  assert.deepEqual(getDashboardFeedbackStatus([], []), {
    submitted: 0, imported: 0, released: 0, kind: "no-submissions", label: "No submitted work", tone: "slate",
  });
});

test("distinguishes missing feedback, drafts, partial release, and complete release", () => {
  assert.equal(getDashboardFeedbackStatus(submissions, []).label, "Feedback not created");
  assert.equal(getDashboardFeedbackStatus(submissions, [
    { studentId: 101, submissionId: 11, releaseState: "DRAFT" },
  ]).label, "Feedback draft — not released");
  assert.deepEqual(getDashboardFeedbackStatus(submissions, [
    { studentId: 101, submissionId: 11, releaseState: "RELEASED" },
  ]), {
    submitted: 3, imported: 1, released: 1, kind: "partial", label: "Feedback 1/3 released", tone: "blue",
  });
  assert.equal(getDashboardFeedbackStatus(submissions, submissions.map((submission) => ({
    studentId: submission.studentId, submissionId: submission.id, releaseState: "RELEASED",
  }))).label, "Feedback 3/3 released");
});

test("counts each submitted response once and ignores orphaned or mismatched feedback", () => {
  const status = getDashboardFeedbackStatus(submissions.slice(0, 2), [
    { studentId: 101, submissionId: 11, releaseState: "DRAFT" },
    { studentId: 101, submissionId: 11, releaseState: "RELEASED" },
    { studentId: 101, submissionId: 11, releaseState: "DRAFT" },
    { studentId: 102, submissionId: null, releaseState: "RELEASED" },
    { studentId: 999, submissionId: 12, releaseState: "RELEASED" },
  ]);
  assert.deepEqual(status, {
    submitted: 2, imported: 1, released: 1, kind: "partial", label: "Feedback 1/2 released", tone: "blue",
  });
});
