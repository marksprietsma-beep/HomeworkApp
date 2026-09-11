import assert from "node:assert/strict";
import test from "node:test";
import { ClassStatus, HomeworkAssignmentStatus, UserRole } from "@prisma/client";
import {
  studentAssignmentAccessWhere,
  studentFeedbackActionAccessWhere,
} from "../lib/access-control";
import { requireAuthenticatedUserValue, requirePasswordChangeCompleteValue, requireRoleValue } from "../lib/auth-guards";
import { canManageClasses, canManageUsers } from "../lib/permissions";
import { applyStudentPasswordReset } from "../lib/student-management";

const studentA = { id: 101, role: UserRole.STUDENT };
const studentB = { id: 202, role: UserRole.STUDENT };

test("protected operations reject unauthenticated identities", () => {
  assert.throws(() => requireAuthenticatedUserValue(null), /Authentication required/);
  assert.throws(() => requireRoleValue(null, [UserRole.TEACHER]), /Authentication required/);
  assert.deepEqual(studentAssignmentAccessWhere(7, null).class.enrollments.some, { studentId: -1 });
});

test("students cannot pass staff or admin authorization", () => {
  assert.throws(() => requireRoleValue(studentA, [UserRole.TEACHER, UserRole.ADMIN]), /permission/);
  assert.equal(canManageUsers(studentA), false);
  assert.equal(canManageClasses(studentA), false);
});

test("teachers cannot perform admin-only actions", () => {
  const teacher = { id: 303, role: UserRole.TEACHER };
  assert.equal(canManageUsers(teacher), false);
  assert.equal(canManageClasses(teacher), false);
  assert.throws(() => requireRoleValue(teacher, [UserRole.ADMIN]), /permission/);
});

test("forced-password-change identities cannot pass protected guards", () => {
  assert.throws(
    () => requirePasswordChangeCompleteValue({ ...studentA, mustChangePassword: true }),
    /password change is required/i,
  );
});

test("student assignment reads and submissions are scoped to that student's enrollment", () => {
  assert.deepEqual(studentAssignmentAccessWhere(7, studentA), {
    id: 7,
    status: HomeworkAssignmentStatus.PUBLISHED,
    class: { status: ClassStatus.ACTIVE, enrollments: { some: { studentId: studentA.id } } },
  });
  assert.notDeepEqual(studentAssignmentAccessWhere(7, studentA), studentAssignmentAccessWhere(7, studentB));
});

test("student feedback mutations are scoped to released feedback owned by that student", () => {
  assert.deepEqual(studentFeedbackActionAccessWhere(12, 7, studentA), {
    id: 12,
    participantFeedback: { assignmentId: 7, studentId: studentA.id, releaseState: "RELEASED", assignment: { class: { status: ClassStatus.ACTIVE } } },
  });
  assert.notDeepEqual(
    studentFeedbackActionAccessWhere(12, 7, studentA),
    studentFeedbackActionAccessWhere(12, 7, studentB),
  );
});

test("password reset requires a password change and invalidates every existing session", async () => {
  const calls: unknown[] = [];
  await applyStudentPasswordReset({
    user: { async update(args) { calls.push(["user.update", args]); } },
    session: { async deleteMany(args) { calls.push(["session.deleteMany", args]); } },
  }, studentA.id, "new-password-hash");

  assert.deepEqual(calls, [
    ["user.update", { where: { id: studentA.id }, data: { passwordHash: "new-password-hash", mustChangePassword: true } }],
    ["session.deleteMany", { where: { userId: studentA.id } }],
  ]);
});
