import assert from "node:assert/strict";
import test from "node:test";
import { AccountStatus, UserRole } from "@prisma/client";
import {
  canAccessStudentManagement,
  existingAccountEnrollmentError,
  manageableClassesWhere,
  moderatableStudentProfileWhere,
  ownStudentProfileWhere,
  resettableStudentWhere,
  studentDirectoryWhere,
  visibleStudentProfileImageWhere,
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

test("password reset targets are server-scoped to students managed by the viewer", () => {
  assert.deepEqual(resettableStudentWhere({ id: 1, role: UserRole.ADMIN }, 9), {
    id: 9,
    role: UserRole.STUDENT,
  });
  assert.deepEqual(resettableStudentWhere({ id: 42, role: UserRole.TEACHER }, 9), {
    id: 9,
    role: UserRole.STUDENT,
    classEnrollments: { some: { class: { teacherId: 42 } } },
  });
  assert.deepEqual(resettableStudentWhere({ id: 9, role: UserRole.STUDENT }, 9), {
    id: -1,
    role: UserRole.STUDENT,
  });
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

test("profile moderation uses the same admin and teacher class scope", () => {
  assert.deepEqual(moderatableStudentProfileWhere({ id: 1, role: UserRole.ADMIN }, 9), { id: 9, role: UserRole.STUDENT });
  assert.deepEqual(moderatableStudentProfileWhere({ id: 42, role: UserRole.TEACHER }, 9), { id: 9, role: UserRole.STUDENT, classEnrollments: { some: { class: { teacherId: 42 } } } });
  assert.deepEqual(moderatableStudentProfileWhere({ id: 3, role: UserRole.STUDENT }, 9), { id: -1, role: UserRole.STUDENT });
});

test("student self-service profile mutations can target only their own student row", () => {
  assert.deepEqual(ownStudentProfileWhere({ id: 7, role: UserRole.STUDENT }), {
    id: 7,
    role: UserRole.STUDENT,
  });
  assert.deepEqual(ownStudentProfileWhere({ id: 7, role: UserRole.TEACHER }), {
    id: -1,
    role: UserRole.STUDENT,
  });
});

test("students can read their own or a classmate's profile image but not an unrelated student's", () => {
  const where = visibleStudentProfileImageWhere(
    { id: 7, role: UserRole.STUDENT },
    "/media/profile-images/avatar.jpg",
  );
  assert.deepEqual(where, {
    role: UserRole.STUDENT,
    profileImagePath: "/media/profile-images/avatar.jpg",
    OR: [
      { id: 7 },
      { classEnrollments: { some: { class: { enrollments: { some: { studentId: 7 } } } } } },
    ],
  });
});

test("profile image visibility preserves scoped teacher and unrestricted admin behaviour", () => {
  assert.deepEqual(visibleStudentProfileImageWhere({ id: 42, role: UserRole.TEACHER }, "/media/profile-images/a.jpg"), {
    role: UserRole.STUDENT,
    profileImagePath: "/media/profile-images/a.jpg",
    classEnrollments: { some: { class: { teacherId: 42 } } },
  });
  assert.deepEqual(visibleStudentProfileImageWhere({ id: 1, role: UserRole.ADMIN }, "/media/profile-images/a.jpg"), {
    role: UserRole.STUDENT,
    profileImagePath: "/media/profile-images/a.jpg",
  });
});
