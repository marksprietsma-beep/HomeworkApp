import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { runAutosaveSequentially } from "../lib/autosave-request-queue";
import { participantSubmissionAdvisoryLockQuery } from "../lib/participant-submission-lock";

const controller = readFileSync("app/assignments/[assignmentId]/work/autosave-form.tsx", "utf8");
const endpoint = readFileSync("app/api/assignments/[assignmentId]/autosave/route.ts", "utf8");
const manualAction = readFileSync("app/assignments/[assignmentId]/work/actions.ts", "utf8");
const persistence = readFileSync("lib/participant-submission.ts", "utf8");

test("manual saves and autosave use the same persistence path", () => {
  assert.match(endpoint, /persistParticipantSubmission/);
  assert.match(manualAction, /persistParticipantSubmission/);
  assert.match(persistence, /tx\.\$executeRaw\(participantSubmissionAdvisoryLockQuery/);
  assert.match(persistence, /validateStructuredAnswer/);
  assert.match(persistence, /submissionAnswer\.upsert/);
});

test("autosave is draft-only and atomically refuses submitted work", () => {
  assert.match(persistence, /intent === "AUTOSAVE" && current\?\.status === SubmissionStatus\.SUBMITTED/);
  assert.match(persistence, /where: \{ id: current\.id, status: SubmissionStatus\.DRAFT \}/);
  assert.match(persistence, /status: SubmissionStatus\.DRAFT, submittedAt: null/);
  assert.match(endpoint, /"ALREADY_SUBMITTED" \? 404 : 409|error\.code === "NOT_FOUND" \? 404 : 409/);
});

test("advisory lock binds both JavaScript numbers to PostgreSQL INT4 arguments", () => {
  const query = participantSubmissionAdvisoryLockQuery(42, 314);

  assert.deepEqual(query.values, [42, 314]);
  assert.deepEqual(query.strings, [
    "SELECT pg_advisory_xact_lock(",
    "::int, ",
    "::int)",
  ]);
});

test("Prisma executes the PostgreSQL advisory lock without deserializing its void result", {
  skip: !process.env.DATABASE_URL && "DATABASE_URL is required for the PostgreSQL integration regression",
}, async () => {
  const client = new PrismaClient();

  try {
    await client.$transaction(async (tx) => {
      await tx.$executeRaw(participantSubmissionAdvisoryLockQuery(42, 314));
    });
  } finally {
    await client.$disconnect();
  }
});

test("controller debounces, coalesces in-flight edits, and performs lifecycle flushes", () => {
  assert.match(controller, /setTimeout\(\(\) => void save\(\), 1500\)/);
  assert.match(controller, /if \(inFlightRef\.current\) followUpRef\.current = true/);
  assert.match(controller, /keepalive: true/);
  assert.match(controller, /visibilitychange/);
  assert.match(controller, /pagehide/);
  assert.match(controller, /beforeunload/);
  assert.match(controller, /const pageHide = \(\) => \{ if \(dirtyRef\.current\) void flushFinal\(\); \}/);
});

test("save A in flight then a page-hide snapshot persists the latest edit in order", async () => {
  let releaseA!: () => void;
  const aBlocked = new Promise<void>((resolve) => { releaseA = resolve; });
  let persisted = "nothing";

  const saveA = runAutosaveSequentially("student-1:assignment-2", async () => {
    await aBlocked;
    persisted = "answer A";
  });
  await Promise.resolve();

  // flushFinal dispatches this immediately during pagehide; the server owns the
  // queued work even if the page is discarded before save A completes.
  const finalSave = runAutosaveSequentially("student-1:assignment-2", async () => {
    persisted = "latest answer B";
  });
  assert.equal(persisted, "nothing");

  releaseA();
  await Promise.all([saveA, finalSave]);
  assert.equal(persisted, "latest answer B");
});
