import assert from "node:assert/strict";
import test from "node:test";
// The production parser is intentionally a plain ESM module shared with fixture scripts.
// @ts-expect-error TypeScript does not pair a sibling .d.ts with an explicit .mjs import.
import { parseAssignmentImportJson } from "../lib/assignment-import-parser.mjs";

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

test("valid JSON passes through without a repaired state", () => {
  const raw = assignment();
  const result = parseAssignmentImportJson(raw);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.repaired, undefined);
    assert.equal(result.assignment.questions[0].prompt, "Move Location to Lab 2");
  }
});

test("repairs unescaped quoted text without changing content or ids", () => {
  const raw = assignment('Move Location to "Lab 2"').replace('\\"Lab 2\\"', '"Lab 2"');
  const result = parseAssignmentImportJson(raw);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.repaired, true);
    assert.equal(result.assignment.questions[0].id, "q6");
    assert.equal(result.assignment.questions[0].prompt, 'Move Location to "Lab 2"');
    assert.match(result.repairedJson ?? "", /\\"Lab 2\\"/);
  }
});

test("repairs the production quote failure when prose continues after the quoted term", () => {
  const expected = 'Change the Location to "Lab 2" and explain why this room is appropriate.';
  const raw = assignment(expected).replace('\\"Lab 2\\"', '"Lab 2"');
  const result = parseAssignmentImportJson(raw);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.repaired, true);
    assert.equal(result.assignment.questions[0].id, "q6");
    assert.equal(result.assignment.questions[0].prompt, expected);
  }
});

test("repairs the exact production quote failure when quoted text is followed by a comma", () => {
  const expected = 'Location to "Lab 2", Reading to 18.5 and Active to TRUE.';
  const raw = assignment(expected).replace('\\"Lab 2\\"', '"Lab 2"');
  const result = parseAssignmentImportJson(raw);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.repaired, true);
    assert.equal(result.assignment.questions[0].id, "q6");
    assert.equal(result.assignment.questions[0].prompt, expected);
  }
});

test("repairs equivalent unescaped quotes in Chinese i18n text", () => {
  const raw = assignment();
  const object = JSON.parse(raw);
  object.assignment.questions[0].textI18n = { en: "Go to Lab 2", zh: '将位置改为“Lab 2”中的 "Lab 2"' };
  const malformed = JSON.stringify(object).replace('\\"Lab 2\\"', '"Lab 2"');
  const result = parseAssignmentImportJson(malformed);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.assignment.questions[0].textI18n?.zh, object.assignment.questions[0].textI18n.zh);
});

test("repairs the production quote failure in English and Chinese translations", () => {
  const object = JSON.parse(assignment());
  object.assignment.questions[0].textI18n = {
    en: 'Change the Location to "Lab 2" before saving the record.',
    zh: '保存记录前，将位置更改为 "Lab 2"。',
  };
  const malformed = JSON.stringify(object).replaceAll('\\"Lab 2\\"', '"Lab 2"');
  const result = parseAssignmentImportJson(malformed);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.assignment.questions[0].id, "q6");
    assert.deepEqual(result.assignment.questions[0].textI18n, object.assignment.questions[0].textI18n);
  }
});

test("repairs fences and trailing commas", () => {
  const trailing = assignment().replace(/\n  }\n}$/, "\n  },\n}");
  const result = parseAssignmentImportJson(`Here is your assignment:\n\`\`\`json\n${trailing}\n\`\`\``);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.repaired, true);
});

test("rejects ambiguous broken JSON and reports likely question", () => {
  const malformed = assignment().replace('"prompt": "Move', '"prompt": "Move" "extra": "');
  const result = parseAssignmentImportJson(malformed);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.errors[0].message, /near question q6/);
});

test("repaired JSON still goes through strict schema validation", () => {
  const invalidSchema = `\`\`\`json\n${assignment().replace('"type": "OPEN_TEXT"', '"type": "ESSAY"')}\n\`\`\``;
  const result = parseAssignmentImportJson(invalidSchema);
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.some((item: { code: string }) => item.code === "invalid_value"));
});
