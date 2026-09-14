import assert from "node:assert/strict";
import test from "node:test";
// The production parser is intentionally a plain ESM module shared with fixture scripts.
// @ts-expect-error TypeScript does not pair a sibling .d.ts with an explicit .mjs import.
import { normalizeSingleBacktickPseudocodeFences, parseAssignmentImportJson } from "../lib/assignment-import-parser.mjs";

test("canonical pseudocode fences remain unchanged", () => {
  const canonical = "Before\n```pseudocode\nDECLARE X : INTEGER\n```\nAfter";
  assert.equal(normalizeSingleBacktickPseudocodeFences(canonical), canonical);
});

test("repairs only paired line-delimited single-backtick pseudocode fences", () => {
  assert.equal(normalizeSingleBacktickPseudocodeFences("Before\n`pseudocode\n  OUTPUT X\n`\nAfter"), "Before\n```pseudocode\n  OUTPUT X\n```\nAfter");
  assert.equal(normalizeSingleBacktickPseudocodeFences("Use `Name` and `Age` here."), "Use `Name` and `Age` here.");
  assert.equal(normalizeSingleBacktickPseudocodeFences("Input a user's name."), "Input a user's name.");
  assert.equal(normalizeSingleBacktickPseudocodeFences("Before\n`pseudocode\nOUTPUT X\nAfter"), "Before\n`pseudocode\nOUTPUT X\nAfter");
});

test("v2 accepts structured tables while v1 remains strict", () => {
  const question = { id: "q1", order: 1, type: "OPEN_TEXT", responseMode: "STRUCTURED", prompt: "Complete it", responseSchema: { schemaVersion: 1, kind: "table", columns: [{ id: "label", label: "" }, { id: "total", label: "£" }], rows: [{ id: "total_row", label: "Total", cells: { total: { editable: true, inputType: "currency" } } }] } };
  assert.equal(parseAssignmentImportJson(JSON.stringify({ formatVersion: "assignment-import-v2", assignment: { title: "Accounts", instructions: "Complete it", status: "DRAFT", questions: [question] } })).ok, true);
  const v1 = parseAssignmentImportJson(JSON.stringify({ formatVersion: "assignment-import-v1", assignment: { title: "Accounts", instructions: "Complete it", status: "DRAFT", questions: [question] } }));
  assert.equal(v1.ok, false);
  if (!v1.ok) assert.ok(v1.errors.some((error: { path: string; code: string }) => error.path.endsWith("responseSchema")));
});

test("v2 reports duplicate semantic IDs and unknown schema fields by path", () => {
  const result = parseAssignmentImportJson(JSON.stringify({ formatVersion: "assignment-import-v2", assignment: { title: "Accounts", instructions: "Complete it", status: "DRAFT", questions: [{ id: "q1", order: 1, type: "OPEN_TEXT", responseMode: "STRUCTURED", prompt: "Complete it", responseSchema: { schemaVersion: 1, kind: "table", script: "bad", columns: [{ id: "label", label: "" }, { id: "label", label: "£" }], rows: [{ id: "r", label: "R", cells: { label: { editable: true } } }] } }] } }));
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.some((error: { path: string; code: string }) => error.path.endsWith(".script") && error.code === "unknown_field"));
    assert.ok(result.errors.some((error: { path: string; code: string }) => error.path.endsWith("columns[1].id") && error.code === "duplicate"));
  }
});

for (const kind of ["table", "t_account"] as const) test(`v2 rejects ${kind} schemas above 300 editable fields`, () => {
  const responseSchema = kind === "table"
    ? { schemaVersion: 1, kind, columns: [{ id: "label", label: "" }, { id: "working", label: "Working" }, { id: "value", label: "Value" }], rows: Array.from({ length: 151 }, (_, index) => ({ id: `row_${index}`, label: `Row ${index}`, cells: { working: { editable: true }, value: { editable: true } } })) }
    : { schemaVersion: 1, kind, title: "Ledger", entries: Array.from({ length: 151 }, (_, index) => ({ id: `entry_${index}`, side: index % 2 ? "credit" : "debit", label: `Entry ${index}`, detail: { editable: true }, amount: { editable: true } })) };
  const result = parseAssignmentImportJson(JSON.stringify({ formatVersion: "assignment-import-v2", assignment: { title: "Too large", instructions: "Complete it", status: "DRAFT", questions: [{ id: "q1", order: 1, type: "OPEN_TEXT", responseMode: "STRUCTURED", prompt: "Complete it", responseSchema }] } }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.some((error: { code: string; message: string }) => error.code === "too_many_fields" && error.message.includes("too many editable fields")));
});

function assignment(prompt = "Move Location to Lab 2") {
  return JSON.stringify({
    formatVersion: "assignment-import-v1",
    assignment: {
      title: "Locations",
      instructions: "Answer every question.",
      status: "DRAFT",
      questions: [{ id: "q6", order: 1, type: "OPEN_TEXT", prompt }],
    },
  }, null, 2);
}

for (const [name, prompt] of [
  ["Name/Age Q5", "Complete the pseudocode.\n`pseudocode\nDECLARE Name : STRING\nDECLARE Age : INTEGER\n________ Name\n________ Age\n`"],
  ["Price/DeliveryCharge/Total Q9", "Complete the pseudocode.\n`pseudocode\nDECLARE Price : REAL\nDECLARE DeliveryCharge : REAL\nDECLARE Total : REAL\nINPUT Price\nINPUT DeliveryCharge\n---\n---\n`"],
] as const) test(`repairs the production ${name} prompt before storage`, () => {
  const result = parseAssignmentImportJson(assignment(prompt));
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.match(result.assignment.questions[0].prompt, /^```pseudocode$/m);
    assert.match(result.assignment.questions[0].prompt, /^```$/m);
  }
});

test("repairs single-backtick fences independently in localized prompts", () => {
  const value = JSON.parse(assignment());
  value.assignment.questions[0].textI18n = {
    en: "Look:\n`pseudocode\nOUTPUT Name\n`\nExplain.",
    zh: "请看：\n`pseudocode\nOUTPUT Name\n`\n请解释。",
  };
  const result = parseAssignmentImportJson(JSON.stringify(value));
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.match(result.assignment.questions[0].textI18n?.en ?? "", /^```pseudocode$/m);
    assert.match(result.assignment.questions[0].textI18n?.zh ?? "", /^```pseudocode$/m);
  }
});

test("repairs the legacy question text alias before it becomes the stored prompt", () => {
  const value = JSON.parse(assignment());
  value.assignment.questions[0].text = "Trace:\n`pseudocode\nOUTPUT X\n`";
  delete value.assignment.questions[0].prompt;
  const result = parseAssignmentImportJson(JSON.stringify(value));
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.assignment.questions[0].prompt, "Trace:\n```pseudocode\nOUTPUT X\n```");
});

test("valid JSON passes through without a repaired state", () => {
  const raw = assignment();
  const result = parseAssignmentImportJson(raw);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.repaired, undefined);
    assert.equal(result.assignment.questions[0].prompt, "Move Location to Lab 2");
  }
});

test("repairs only unambiguous stray backslashes from production output", () => {
  const malformed = assignment("Use <name> and <colour>.")
    .replace('"status":', '"dueDate"\\: null,\n    "status":')
    .replace('OPEN_TEXT', 'OPEN\\_TEXT')
    .replaceAll('<', '\\<')
    .replaceAll('>', '\\>');
  const result = parseAssignmentImportJson(malformed);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.repaired, true);
    assert.equal(result.assignment.questions[0].type, "OPEN_TEXT");
    assert.equal(result.assignment.questions[0].prompt, "Use <name> and <colour>.");
    assert.match(result.repairedJson ?? "", /"dueDate": null/);
  }
});

test("does not alter valid escaped backslashes before repairable characters", () => {
  const expected = String.raw`Keep \\_ and \\<name>`;
  const result = parseAssignmentImportJson(assignment(expected));
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.assignment.questions[0].prompt, expected);
});

for (const quotedText of [
  'The variable Code stores the string "CS2026EXAM".',
  'Compare "password", "Valid", "s", and "edu".',
]) test(`rejects ambiguous unescaped quotes: ${quotedText}`, () => {
  const malformed = assignment(quotedText).replaceAll('\\"', '"');
  const result = parseAssignmentImportJson(malformed);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errors[0].message, /There may be several/);
    assert.doesNotMatch(result.errors[0].message, /near question/);
    assert.match(result.errors[0].message, /correction prompt/);
  }
});

test("valid bilingual assignments with escaped quoted text parse unchanged", () => {
  const object = JSON.parse(assignment('Store the string "CS2026EXAM".'));
  object.assignment.titleI18n = { en: "String task", zh: "字符串任务" };
  object.assignment.questions[0].textI18n = { en: 'Output "Valid".', zh: '输出字符串“Valid”。' };
  const result = parseAssignmentImportJson(JSON.stringify(object));
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.repaired, undefined);
    assert.equal(result.assignment.questions[0].prompt, 'Store the string "CS2026EXAM".');
    assert.equal(result.assignment.questions[0].textI18n?.en, 'Output "Valid".');
  }
});

test("valid pseudocode samples containing quoted OUTPUT strings parse", () => {
  const prompt = 'Trace this pseudocode:\n```pseudocode\nOUTPUT "Valid"\n```\nState the output.';
  const result = parseAssignmentImportJson(assignment(prompt));
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.assignment.questions[0].prompt, prompt);
});

test("repairs fences and trailing commas", () => {
  const trailing = assignment().replace(/\n  }\n}$/, "\n  },\n}");
  const result = parseAssignmentImportJson(`Here is your assignment:\n\`\`\`json\n${trailing}\n\`\`\``);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.repaired, true);
});

test("rejects ambiguous broken JSON without blaming one question", () => {
  const malformed = assignment().replace('"prompt": "Move', '"prompt": "Move" "extra": "');
  const result = parseAssignmentImportJson(malformed);
  assert.equal(result.ok, false);
  if (!result.ok) assert.doesNotMatch(result.errors[0].message, /near question/);
});

test("repaired JSON still goes through strict schema validation", () => {
  const invalidSchema = `\`\`\`json\n${assignment().replace('"type": "OPEN_TEXT"', '"type": "ESSAY"')}\n\`\`\``;
  const result = parseAssignmentImportJson(invalidSchema);
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.some((item: { code: string }) => item.code === "invalid_value"));
});
