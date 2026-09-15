import assert from "node:assert/strict";
import test from "node:test";
import { consolidateOutstandingAssignments, reminderIdempotencyKey } from "../lib/homework-reminder-core.mjs";

const active = (id: number, accountStatus = "ACTIVE") => ({ id, email: `student${id}@example.org`, displayName: `Student ${id}`, role: "STUDENT", accountStatus });
const assignment = (id: number, students: ReturnType<typeof active>[], submissions: { studentId: number; status: string }[] = []) => ({ id, title: `Task ${id}`, dueAt: null, class: { name: "Maths", enrollments: students.map((student) => ({ student })) }, submissions });

test("missing and draft submissions are outstanding while submitted work is excluded", () => {
  const students = [active(1), active(2), active(3)];
  const result = consolidateOutstandingAssignments([assignment(10, students, [{ studentId: 2, status: "DRAFT" }, { studentId: 3, status: "SUBMITTED" }])]);
  assert.deepEqual(result.map((item) => item.student.id), [1, 2]);
});

test("several tasks are consolidated and inactive students are excluded", () => {
  const result = consolidateOutstandingAssignments([assignment(10, [active(1), active(2, "DISABLED")]), assignment(11, [active(1)])]);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].tasks.map((task) => task.id), [10, 11]);
});

test("a run is stable per student while a later run has a distinct key", () => {
  assert.equal(reminderIdempotencyKey("run-one", 4), reminderIdempotencyKey("run-one", 4));
  assert.notEqual(reminderIdempotencyKey("run-one", 4), reminderIdempotencyKey("run-two", 4));
});
