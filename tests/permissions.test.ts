import assert from "node:assert/strict";
import test from "node:test";
import { AccountStatus, UserRole } from "@prisma/client";
import {
  canManageClasses,
  canManageClassRoster,
  canManageUsers,
  canTeachClass,
  isEligibleClassTeacher,
} from "../lib/permissions";

const active = AccountStatus.ACTIVE;
const disabled = AccountStatus.DISABLED;

test("only active staff accounts are eligible for class assignment", () => {
  assert.equal(isEligibleClassTeacher({ role: UserRole.TEACHER, accountStatus: active }), true);
  assert.equal(isEligibleClassTeacher({ role: UserRole.ADMIN, accountStatus: active }), true);
  assert.equal(isEligibleClassTeacher({ role: UserRole.STUDENT, accountStatus: active }), false);
  assert.equal(isEligibleClassTeacher({ role: UserRole.TEACHER, accountStatus: disabled }), false);
  assert.equal(isEligibleClassTeacher({ role: UserRole.ADMIN, accountStatus: disabled }), false);
});

test("class roster management allows admins or only the assigned teacher", () => {
  assert.equal(canManageClassRoster({ id: 1, role: UserRole.ADMIN }, 99), true);
  assert.equal(canManageClassRoster({ id: 2, role: UserRole.TEACHER }, 2), true);
  assert.equal(canManageClassRoster({ id: 2, role: UserRole.TEACHER }, 3), false);
  assert.equal(canManageClassRoster({ id: 3, role: UserRole.STUDENT }, 3), false);
});

test("class teaching requires explicit ownership for teachers and admins", () => {
  assert.equal(canTeachClass({ id: 10, role: UserRole.TEACHER }, 10), true);
  assert.equal(canTeachClass({ id: 20, role: UserRole.ADMIN }, 20), true);
  assert.equal(canTeachClass({ id: 20, role: UserRole.ADMIN }, 10), false);
  assert.equal(canTeachClass({ id: 30, role: UserRole.STUDENT }, 30), false);
});

test("global management permissions remain admin-only", () => {
  assert.equal(canManageUsers({ role: UserRole.ADMIN }), true);
  assert.equal(canManageClasses({ role: UserRole.ADMIN }), true);
  assert.equal(canManageUsers({ role: UserRole.TEACHER }), false);
  assert.equal(canManageClasses({ role: UserRole.TEACHER }), false);
});
