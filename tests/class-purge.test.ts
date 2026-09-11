import assert from "node:assert/strict";
import test from "node:test";
import { ClassStatus } from "@prisma/client";
import { purgeClassInTransaction } from "../lib/class-purge";

type Call = { model: string; operation: string; args: unknown };

function fakePurgeTransaction(options: { status?: ClassStatus; confirmationName?: string; finalDeleteCount?: number } = {}) {
  const calls: Call[] = [];
  const record = (model: string, operation: string, result: unknown) => async (args: unknown) => {
    calls.push({ model, operation, args });
    return result;
  };
  const deletion = (model: string) => ({ deleteMany: record(model, "deleteMany", { count: 1 }) });
  const tx = {
    class: {
      findUnique: record("class", "findUnique", { name: options.confirmationName ?? "Test class", status: options.status ?? ClassStatus.INACTIVE }),
      deleteMany: record("class", "deleteMany", { count: options.finalDeleteCount ?? 1 }),
    },
    classEnrollment: { count: record("classEnrollment", "count", 2), ...deletion("classEnrollment") },
    homeworkAssignment: { count: record("homeworkAssignment", "count", 1), findMany: record("homeworkAssignment", "findMany", [{ id: 20 }]), ...deletion("homeworkAssignment") },
    homeworkQuestion: deletion("homeworkQuestion"),
    submission: { count: record("submission", "count", 1), ...deletion("submission") },
    submissionAnswer: { count: record("submissionAnswer", "count", 1), ...deletion("submissionAnswer") },
    feedbackImport: deletion("feedbackImport"),
    participantFeedback: { count: record("participantFeedback", "count", 1), ...deletion("participantFeedback") },
    questionFeedback: deletion("questionFeedback"),
    feedbackFollowUpAction: deletion("feedbackFollowUpAction"),
    emailNotification: { count: record("emailNotification", "count", 2), ...deletion("emailNotification") },
    curriculumHomeworkLibraryItem: { updateMany: record("curriculumHomeworkLibraryItem", "updateMany", { count: 1 }) },
  };
  return { tx: tx as unknown as Parameters<typeof purgeClassInTransaction>[0], calls };
}

test("inactive purge executes every class-owned deletion and clears only matching library provenance", async () => {
  const { tx, calls } = fakePurgeTransaction();
  const result = await purgeClassInTransaction(tx, 10, "DELETE");
  assert.equal(result.name, "Test class");
  assert.deepEqual(result.counts, { enrollments: 2, assignments: 1, submissions: 1, answers: 1, feedback: 1, notifications: 2 });
  const deleted = calls.filter((call) => call.operation === "deleteMany").map((call) => call.model);
  assert.deepEqual(deleted, ["emailNotification", "feedbackFollowUpAction", "questionFeedback", "participantFeedback", "feedbackImport", "submissionAnswer", "submission", "homeworkQuestion", "homeworkAssignment", "classEnrollment", "class"]);
  assert.equal(deleted.includes("user"), false);
  const libraryUpdate = calls.find((call) => call.model === "curriculumHomeworkLibraryItem");
  assert.deepEqual(libraryUpdate?.args, { where: { sourceAssignmentId: { in: [20] } }, data: { sourceAssignmentId: null } });
  assert.deepEqual(calls.at(-1)?.args, { where: { id: 10, status: ClassStatus.INACTIVE } });
});

test("active class and bad confirmation cannot reach destructive execution", async () => {
  const active = fakePurgeTransaction({ status: ClassStatus.ACTIVE });
  await assert.rejects(purgeClassInTransaction(active.tx, 10, "DELETE"), /inactive/);
  assert.equal(active.calls.some((call) => call.operation === "deleteMany"), false);
  const bad = fakePurgeTransaction();
  await assert.rejects(purgeClassInTransaction(bad.tx, 10, "wrong"), /Confirmation/);
  assert.equal(bad.calls.some((call) => call.operation === "deleteMany"), false);
});

test("concurrent reactivation fails the conditional final delete so a transaction wrapper can roll back", async () => {
  const committed: Call[] = [];
  const attempt = fakePurgeTransaction({ finalDeleteCount: 0 });
  await assert.rejects(async () => {
    const result = await purgeClassInTransaction(attempt.tx, 10, "Test class");
    committed.push(...attempt.calls);
    return result;
  }, /reactivated/);
  assert.deepEqual(committed, []);
  assert.deepEqual(attempt.calls.at(-1)?.args, { where: { id: 10, status: ClassStatus.INACTIVE } });
});
