import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const controller = readFileSync("app/assignments/[assignmentId]/work/autosave-form.tsx", "utf8");
const endpoint = readFileSync("app/api/assignments/[assignmentId]/autosave/route.ts", "utf8");
const manualAction = readFileSync("app/assignments/[assignmentId]/work/actions.ts", "utf8");
const persistence = readFileSync("lib/participant-submission.ts", "utf8");

test("manual saves and autosave use the same persistence path", () => {
  assert.match(endpoint, /persistParticipantSubmission/);
  assert.match(manualAction, /persistParticipantSubmission/);
  assert.match(persistence, /validateStructuredAnswer/);
  assert.match(persistence, /submissionAnswer\.upsert/);
});

test("autosave is draft-only and atomically refuses submitted work", () => {
  assert.match(persistence, /intent === "AUTOSAVE" && current\?\.status === SubmissionStatus\.SUBMITTED/);
  assert.match(persistence, /where: \{ id: current\.id, status: SubmissionStatus\.DRAFT \}/);
  assert.match(persistence, /status: SubmissionStatus\.DRAFT, submittedAt: null/);
  assert.match(endpoint, /"ALREADY_SUBMITTED" \? 404 : 409|error\.code === "NOT_FOUND" \? 404 : 409/);
});

test("controller debounces, coalesces in-flight edits, and performs lifecycle flushes", () => {
  assert.match(controller, /setTimeout\(\(\) => void save\(\), 1500\)/);
  assert.match(controller, /if \(inFlightRef\.current\) followUpRef\.current = true/);
  assert.match(controller, /keepalive: true/);
  assert.match(controller, /visibilitychange/);
  assert.match(controller, /pagehide/);
  assert.match(controller, /beforeunload/);
});
