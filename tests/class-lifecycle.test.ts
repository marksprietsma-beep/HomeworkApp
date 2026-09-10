import assert from "node:assert/strict";
import test from "node:test";
import { ClassStatus } from "@prisma/client";
import { classCanBePurged, classPurgeConfirmationMatches, nextClassStatus } from "../lib/class-lifecycle";

test("class lifecycle toggles between active and inactive", () => {
  assert.equal(nextClassStatus(ClassStatus.ACTIVE), ClassStatus.INACTIVE);
  assert.equal(nextClassStatus(ClassStatus.INACTIVE), ClassStatus.ACTIVE);
});

test("only inactive classes may be permanently purged", () => {
  assert.equal(classCanBePurged(ClassStatus.ACTIVE), false);
  assert.equal(classCanBePurged(ClassStatus.INACTIVE), true);
});

test("purge confirmation requires DELETE or the exact case-sensitive class name", () => {
  assert.equal(classPurgeConfirmationMatches("DELETE", "Accounting test"), true);
  assert.equal(classPurgeConfirmationMatches(" Accounting test ", "Accounting test"), true);
  assert.equal(classPurgeConfirmationMatches("delete", "Accounting test"), false);
  assert.equal(classPurgeConfirmationMatches("Accounting Test", "Accounting test"), false);
  assert.equal(classPurgeConfirmationMatches("", "Accounting test"), false);
});
