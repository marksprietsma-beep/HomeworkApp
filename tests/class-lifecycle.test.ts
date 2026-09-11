import assert from "node:assert/strict";
import test from "node:test";
import { ClassStatus } from "@prisma/client";
import { canMutateClassFeedback, classCanBePurged, classMetadataUpdateData, classPurgeConfirmationMatches, nextClassStatus } from "../lib/class-lifecycle";

test("class lifecycle toggles between active and inactive", () => {
  assert.equal(nextClassStatus(ClassStatus.ACTIVE), ClassStatus.INACTIVE);
  assert.equal(nextClassStatus(ClassStatus.INACTIVE), ClassStatus.ACTIVE);
});

test("ordinary metadata edits cannot carry a forged lifecycle status", () => {
  const forgedInput = { name: "Maths", subject: "Maths", description: "History", teacherId: 3, status: ClassStatus.INACTIVE };
  assert.deepEqual(classMetadataUpdateData(forgedInput), { name: "Maths", subject: "Maths", description: "History", teacherId: 3 });
  assert.equal("status" in classMetadataUpdateData(forgedInput), false);
});

test("only inactive classes may be permanently purged", () => {
  assert.equal(classCanBePurged(ClassStatus.ACTIVE), false);
  assert.equal(classCanBePurged(ClassStatus.INACTIVE), true);
});

test("inactive class feedback import and immediate publish are denied", () => {
  assert.equal(canMutateClassFeedback(ClassStatus.INACTIVE, true), false);
  assert.equal(canMutateClassFeedback(ClassStatus.INACTIVE, true), false);
});

test("inactive class delayed release and draft-score correction are denied", () => {
  assert.equal(canMutateClassFeedback(ClassStatus.INACTIVE, true), false);
  assert.equal(canMutateClassFeedback(ClassStatus.INACTIVE, true), false);
});

test("feedback mutation still requires ownership and reactivation restores eligibility", () => {
  assert.equal(canMutateClassFeedback(ClassStatus.ACTIVE, false), false);
  assert.equal(canMutateClassFeedback(ClassStatus.ACTIVE, true), true);
});

test("purge confirmation requires DELETE or the exact case-sensitive class name", () => {
  assert.equal(classPurgeConfirmationMatches("DELETE", "Accounting test"), true);
  assert.equal(classPurgeConfirmationMatches(" Accounting test ", "Accounting test"), true);
  assert.equal(classPurgeConfirmationMatches("delete", "Accounting test"), false);
  assert.equal(classPurgeConfirmationMatches("Accounting Test", "Accounting test"), false);
  assert.equal(classPurgeConfirmationMatches("", "Accounting test"), false);
});
