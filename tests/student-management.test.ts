import assert from "node:assert/strict";
import test from "node:test";
import { AccountStatus, UserRole } from "@prisma/client";
import {
  canAccessStudentManagement,
  existingAccountEnrollmentError,
  manageableClassesWhere,
  studentDirectoryWhere,
} from "../lib/student-management";

test("admin student directory includes every student and searchable account fields", () => {
  const where = studentDirectoryWhere({ id: 1, role: UserRole.ADMIN }, "Ada");
  assert.equal(where.role, UserRole.STUDENT);
  assert.equal("classEnrollments" in where, false);
  assert.deepEqual(where.OR, [
    { displayName: { contains: "Ada" } },
    { email: { contains: "Ada" } },
    { yearGroup: { contains: "Ada" } },
  ]);
  assert.deepEqual(manageableClassesWhere({ id: 1, role: UserRole.ADMIN }), {});
});

test("teacher student searches and class choices are scoped by teacher id on the server", () => {
  const viewer = { id: 42, role: UserRole.TEACHER };
  assert.deepEqual(studentDirectoryWhere(viewer), {
    role: UserRole.STUDENT,
    classEnrollments: { some: { class: { teacherId: 42 } } },
  });
  assert.deepEqual(manageableClassesWhere(viewer), { teacherId: 42 });
});

test("students cannot access staff student management", () => {
  assert.equal(canAccessStudentManagement({ id: 1, role: UserRole.ADMIN }), true);
  assert.equal(canAccessStudentManagement({ id: 2, role: UserRole.TEACHER }), true);
  assert.equal(canAccessStudentManagement({ id: 3, role: UserRole.STUDENT }), false);
  assert.equal(canAccessStudentManagement(null), false);
});

test("non-student and disabled accounts cannot be silently converted or reactivated", () => {
  assert.match(existingAccountEnrollmentError({ role: UserRole.TEACHER, accountStatus: AccountStatus.ACTIVE }) ?? "", /cannot be changed/);
  assert.match(existingAccountEnrollmentError({ role: UserRole.STUDENT, accountStatus: AccountStatus.DISABLED }) ?? "", /disabled/);
  assert.equal(existingAccountEnrollmentError({ role: UserRole.STUDENT, accountStatus: AccountStatus.ACTIVE }), null);
});
