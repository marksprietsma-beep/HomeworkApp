import assert from "node:assert/strict";
import test from "node:test";
import { parseStudentCsv } from "../lib/student-csv-import";

test("student CSV requires the three named headers but permits case, whitespace, and extras", () => {
  const rows = parseStudentCsv(" first name ,LAST NAME, Email Address,Ignored\n Ada , Lovelace , ADA@School.test,x");
  assert.deepEqual(rows[0], { rowNumber: 2, firstName: "Ada", lastName: "Lovelace", displayName: "Ada Lovelace", email: "ada@school.test", messages: [] });
  assert.throws(() => parseStudentCsv("username,First Name,Last Name\na@b.test,A,B"), /Email Address/);
  assert.throws(() => parseStudentCsv("displayName,email,yearGroup\nAda Lovelace,a@b.test,Y9"), /First Name.*Last Name.*Email Address/);
});

test("student CSV validates blanks, email shape, and every duplicate occurrence", () => {
  const rows = parseStudentCsv("First Name,Last Name,Email Address\nAda,Lovelace,same@school.test\nAlan,Turing,SAME@school.test\n,Person,invalid");
  assert.match(rows[0].messages[0], /Duplicate/);
  assert.match(rows[1].messages[0], /Duplicate/);
  assert.deepEqual(rows[2].messages, ["First Name is blank.", "Email Address is not a valid email address."]);
});
