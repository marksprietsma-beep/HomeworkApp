/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import test from "node:test";
import { feedbackIdempotencyKey, homeworkIdempotencyKey, isEligibleStudent, isValidRecipientEmail, notificationTypeEnabled, shouldQueueFeedback, shouldQueuePublication } from "../lib/email-notification-policy.mjs";
import { claimNotification, MAX_AUTOMATIC_ATTEMPTS, processEmailOutbox } from "../lib/email-outbox-runtime.mjs";
import core from "../lib/email-core.cjs";
const { automaticEmailEnabled, formatSchoolDueDate, getPublicMailDiagnostics, sanitiseMailError } = core;

test("assignment lifecycle captures only genuine publications with deterministic republish versions", () => {
  assert.equal(shouldQueuePublication("DRAFT", "DRAFT"), false);
  assert.equal(shouldQueuePublication("DRAFT", "PUBLISHED"), true);
  assert.equal(shouldQueuePublication("PUBLISHED", "PUBLISHED"), false);
  assert.equal(shouldQueuePublication("ARCHIVED", "PUBLISHED"), true);
  assert.equal(homeworkIdempotencyKey(9, 1, 3), homeworkIdempotencyKey(9, 1, 3));
  assert.notEqual(homeworkIdempotencyKey(9, 1, 3), homeworkIdempotencyKey(9, 2, 3));
});

test("recipient policy selects only active students and invalid mail is non-deliverable", () => {
  assert.equal(isEligibleStudent({ role: "STUDENT", accountStatus: "ACTIVE" }), true);
  assert.equal(isEligibleStudent({ role: "STUDENT", accountStatus: "DISABLED" }), false);
  assert.equal(isEligibleStudent({ role: "TEACHER", accountStatus: "ACTIVE" }), false);
  assert.equal(isValidRecipientEmail("student@example.org"), true);
  assert.equal(isValidRecipientEmail("not-an-email"), false);
});

test("feedback identity prevents repeat release but permits replacement feedback", () => {
  assert.equal(shouldQueueFeedback("DRAFT", "DRAFT"), false);
  assert.equal(shouldQueueFeedback("DRAFT", "RELEASED"), true);
  assert.equal(shouldQueueFeedback("RELEASED", "RELEASED"), false);
  assert.equal(feedbackIdempotencyKey(41, 3), feedbackIdempotencyKey(41, 3));
  assert.notEqual(feedbackIdempotencyKey(41, 3), feedbackIdempotencyKey(42, 3));
});

function createOutboxDb(overrides: Partial<Record<string, unknown>> = {}) {
  const row: any = { id: 1, type: "HOMEWORK_PUBLISHED", status: "PENDING", recipientEmail: "student@example.org", attemptCount: 0, nextAttemptAt: null, leaseUntil: null, createdAt: new Date(0), templateData: { studentName: "Alex", className: "Maths", assignmentTitle: "Fractions", dueDate: "", clarionLink: "https://clarion.example/assignments/1/work" }, ...overrides };
  const matchesAvailability = (where: any) => {
    if (where.id && where.id !== row.id && !where.id.in?.includes(row.id)) return false;
    if (row.status === "SENT" || row.status === "SKIPPED") return false;
    if (row.status === "PROCESSING" && (!row.leaseUntil || row.leaseUntil > (where.OR?.[1]?.leaseUntil?.lte ?? new Date()))) return false;
    if (where.attemptCount?.lt !== undefined && row.attemptCount >= where.attemptCount.lt) return false;
    return true;
  };
  return {
    row,
    emailNotification: {
      findMany: async ({ where }: any) => matchesAvailability(where) ? [{ id: row.id }] : [],
      updateMany: async ({ where, data }: any) => { if (!matchesAvailability(where)) return { count: 0 }; row.status = data.status; row.leaseUntil = data.leaseUntil; row.attemptedAt = data.attemptedAt; row.attemptCount += data.attemptCount.increment; return { count: 1 }; },
      findUnique: async () => ({ ...row }),
      update: async ({ data }: any) => { Object.assign(row, data); return { ...row }; },
    },
    emailNotificationSettings: { findUnique: async () => null },
  };
}

test("atomic claim allows only one concurrent owner and an expired lease is reclaimable", async () => {
  const db = createOutboxDb();
  const now = new Date("2026-09-10T00:00:00Z");
  const [first, second] = await Promise.all([claimNotification(db, 1, { now }), claimNotification(db, 1, { now })]);
  assert.equal([first, second].filter(Boolean).length, 1);
  assert.equal(db.row.attemptCount, 1);
  db.row.leaseUntil = new Date(now.getTime() - 1);
  const reclaimed = await claimNotification(db, 1, { now });
  assert.ok(reclaimed);
  assert.equal(db.row.attemptCount, 2);
});

test("overlapping processors physically send once and success records SENT", async () => {
  const previous = process.env.EMAIL_NOTIFICATIONS_ENABLED; process.env.EMAIL_NOTIFICATIONS_ENABLED = "true";
  try {
    const db = createOutboxDb(); let sends = 0;
    const transport = { verify: async () => undefined, send: async () => { sends++; } };
    await Promise.all([processEmailOutbox({ db, transport }), processEmailOutbox({ db, transport })]);
    assert.equal(sends, 1); assert.equal(db.row.status, "SENT"); assert.equal(db.row.attemptCount, 1);
  } finally { process.env.EMAIL_NOTIFICATIONS_ENABLED = previous; }
});

test("SMTP failure records FAILED without mutating canonical domain state", async () => {
  const previous = process.env.EMAIL_NOTIFICATIONS_ENABLED; process.env.EMAIL_NOTIFICATIONS_ENABLED = "true";
  const assignment = { status: "PUBLISHED" }; const feedback = { releaseState: "RELEASED" };
  try {
    const db = createOutboxDb();
    const result = await processEmailOutbox({ db, transport: { verify: async () => undefined, send: async () => { throw new Error("connection refused password=private"); } } });
    assert.equal(result.failed, 1); assert.equal(db.row.status, "FAILED"); assert.equal(db.row.lastError.includes("private"), false);
    assert.deepEqual(assignment, { status: "PUBLISHED" }); assert.deepEqual(feedback, { releaseState: "RELEASED" });
  } finally { process.env.EMAIL_NOTIFICATIONS_ENABLED = previous; }
});

test("manual retry bypasses backoff and automatic exhaustion while retaining one logical row", async () => {
  const previous = process.env.EMAIL_NOTIFICATIONS_ENABLED; process.env.EMAIL_NOTIFICATIONS_ENABLED = "true";
  try {
    const db = createOutboxDb({ status: "FAILED", attemptCount: MAX_AUTOMATIC_ATTEMPTS, nextAttemptAt: new Date("2099-01-01") });
    const automatic = await processEmailOutbox({ db, transport: { verify: async () => undefined, send: async () => undefined } });
    assert.equal(automatic.processed, 0);
    const manual = await processEmailOutbox({ db, ids: [1], manual: true, transport: { verify: async () => undefined, send: async () => undefined } });
    assert.equal(manual.sent, 1); assert.equal(db.row.status, "SENT"); assert.equal(db.row.id, 1); assert.equal(db.row.attemptCount, MAX_AUTOMATIC_ATTEMPTS + 1);
  } finally { process.env.EMAIL_NOTIFICATIONS_ENABLED = previous; }
});

test("disabled mode, school timezone and diagnostics are safe and deterministic", () => {
  assert.equal(automaticEmailEnabled({ EMAIL_NOTIFICATIONS_ENABLED: "false" } as NodeJS.ProcessEnv), false);
  assert.match(formatSchoolDueDate(new Date("2026-09-10T08:00:00Z"), {} as NodeJS.ProcessEnv), /16:00 \(Asia\/Shanghai\)/);
  assert.doesNotMatch(sanitiseMailError(new Error("auth token=abc password=xyz")), /abc|xyz/);
  const diagnostics = getPublicMailDiagnostics({ SMTP_PASSWORD: "super-secret" } as NodeJS.ProcessEnv);
  assert.equal(JSON.stringify(diagnostics).includes("super-secret"), false);
  assert.equal(notificationTypeEnabled({ homeworkEnabled: true, feedbackEnabled: false }, "HOMEWORK_PUBLISHED"), true);
  assert.equal(notificationTypeEnabled({ homeworkEnabled: true, feedbackEnabled: false }, "FEEDBACK_RELEASED"), false);
});
