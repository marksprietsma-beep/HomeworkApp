/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import test from "node:test";
import { AccountStatus, UserRole } from "@prisma/client";
import { canManageClassRoster } from "../lib/permissions.js";
import { PublicationIntent } from "../lib/publication-intent.mjs";
import { createAssignmentWithIntent, feedbackImportProtection, releaseFeedbackWithNotification, saveFeedbackWithIntent, transitionAssignmentStatusWithNotification } from "../lib/publication-workflows.mjs";

function assignmentDb() {
  const rows = new Map<number, any>();
  let nextId = 1;
  return {
    rows,
    homeworkAssignment: {
      create: async ({ data }: any) => { const row = { ...data, id: nextId++, publicationVersion: 0 }; rows.set(row.id, row); return { id: row.id }; },
      update: async ({ where, data }: any) => { Object.assign(rows.get(where.id), data); return { ...rows.get(where.id) }; },
      updateMany: async ({ where, data }: any) => { const row = rows.get(where.id); if (!row || row.status === "PUBLISHED") return { count: 0 }; row.status = data.status; row.publicationVersion += data.publicationVersion.increment; return { count: 1 }; },
      findUniqueOrThrow: async ({ where }: any) => ({ ...rows.get(where.id) }),
    },
  };
}

test("assignment import status is metadata and teacher intent controls stored state", async () => {
  for (const importedStatus of ["DRAFT", "PUBLISHED"]) {
    for (const intent of [PublicationIntent.DRAFT, PublicationIntent.PUBLISH]) {
      const db = assignmentDb(); const events: any[] = [];
      const transition = (target: any, id: number, status: string) => transitionAssignmentStatusWithNotification(target, id, status, async (_db: any, assignmentId: number, version: number) => { events.push({ assignmentId, version }); });
      const created = await createAssignmentWithIntent(db, { title: "Imported", status: importedStatus }, intent, transition);
      assert.equal(db.rows.get(created.id).status, intent === "PUBLISH" ? "PUBLISHED" : "DRAFT");
      assert.equal(db.rows.get(created.id).publicationVersion, intent === "PUBLISH" ? 1 : 0);
      assert.equal(events.length, intent === "PUBLISH" ? 1 : 0);
    }
  }
});

test("manual create uses the same canonical transition and repeated publication is idempotent", async () => {
  const db = assignmentDb(); const events: any[] = [];
  const transition = (target: any, id: number, status: string) => transitionAssignmentStatusWithNotification(target, id, status, async (_db: any, assignmentId: number, version: number) => { events.push({ assignmentId, version }); });
  const created = await createAssignmentWithIntent(db, { title: "Manual" }, PublicationIntent.PUBLISH, transition);
  await transition(db, created.id, "PUBLISHED");
  assert.equal(db.rows.get(created.id).publicationVersion, 1);
  assert.deepEqual(events, [{ assignmentId: created.id, version: 1 }]);
});

test("publication permissions allow assigned teachers and admins only", () => {
  const assigned = { id: 10, role: UserRole.TEACHER, accountStatus: AccountStatus.ACTIVE };
  const unrelated = { id: 11, role: UserRole.TEACHER, accountStatus: AccountStatus.ACTIVE };
  const admin = { id: 12, role: UserRole.ADMIN, accountStatus: AccountStatus.ACTIVE };
  const student = { id: 13, role: UserRole.STUDENT, accountStatus: AccountStatus.ACTIVE };
  assert.equal(canManageClassRoster(assigned, 10), true);
  assert.equal(canManageClassRoster(admin, 10), true);
  assert.equal(canManageClassRoster(unrelated, 10), false);
  assert.equal(canManageClassRoster(student, 10), false);
});

function feedbackDb() {
  const rows = [
    { id: 1, assignmentId: 7, releaseState: "DRAFT", scoreAwarded: 8 },
    { id: 2, assignmentId: 7, releaseState: "DRAFT", scoreAwarded: 6 },
    { id: 3, assignmentId: 7, releaseState: "DRAFT", scoreAwarded: 4 },
    { id: 4, assignmentId: 8, releaseState: "DRAFT", scoreAwarded: 10 },
  ];
  return { rows, participantFeedback: {
    findMany: async ({ where }: any) => rows.filter((row) => row.assignmentId === where.assignmentId && row.releaseState === where.releaseState && (!where.id || where.id.in.includes(row.id))).map(({ id }) => ({ id })),
    updateMany: async ({ where, data }: any) => { let count = 0; for (const row of rows) if (row.assignmentId === where.assignmentId && where.id.in.includes(row.id) && row.releaseState === where.releaseState) { Object.assign(row, data); count++; } return { count }; },
  } };
}

test("scoped feedback release changes and notifies only selected drafts", async () => {
  const db = feedbackDb(); const notified: number[][] = [];
  const count = await releaseFeedbackWithNotification(db, 7, 99, async (_db: any, ids: number[]) => { notified.push(ids); }, [1, 2, 4]);
  assert.equal(count, 2); assert.deepEqual(notified, [[1, 2]]);
  assert.equal(db.rows.find((row) => row.id === 1)?.releaseState, "RELEASED");
  assert.equal(db.rows.find((row) => row.id === 2)?.releaseState, "RELEASED");
  assert.equal(db.rows.find((row) => row.id === 3)?.releaseState, "DRAFT");
  assert.equal(db.rows.find((row) => row.id === 4)?.releaseState, "DRAFT");
});

test("unscoped delayed release preserves bulk behavior", async () => {
  const db = feedbackDb(); const notified: number[][] = [];
  assert.equal(await releaseFeedbackWithNotification(db, 7, 99, async (_db: any, ids: number[]) => { notified.push(ids); }), 3);
  assert.deepEqual(notified, [[1, 2, 3]]);
});

test("feedback draft and immediate publish preserve scores and share one transaction boundary", async () => {
  for (const intent of [PublicationIntent.DRAFT, PublicationIntent.PUBLISH]) {
    const timeline: string[] = []; const rows = [{ id: 20, releaseState: "DRAFT", scoreAwarded: 7 }];
    const saved = await saveFeedbackWithIntent(intent, async () => { timeline.push("persist"); return { id: 5, feedbackIds: [20], rows }; }, async (ids) => { timeline.push(`release:${ids.join()}`); rows[0].releaseState = "RELEASED"; return 1; });
    assert.equal(saved.rows[0].scoreAwarded, 7);
    assert.equal(saved.rows[0].releaseState, intent === "PUBLISH" ? "RELEASED" : "DRAFT");
    assert.deepEqual(timeline, intent === "PUBLISH" ? ["persist", "release:20"] : ["persist"]);
    assert.equal(saved.releasedCount, intent === "PUBLISH" ? 1 : 0);
  }
});

test("duplicate and replacement protections remain mandatory", () => {
  assert.deepEqual(feedbackImportProtection(44, [], true), { kind: "DUPLICATE", importId: 44 });
  assert.deepEqual(feedbackImportProtection(null, [{ id: 1 }], false), { kind: "REPLACE_CONFIRMATION_REQUIRED" });
  assert.deepEqual(feedbackImportProtection(null, [{ id: 1 }], true), { kind: "PROCEED" });
});
