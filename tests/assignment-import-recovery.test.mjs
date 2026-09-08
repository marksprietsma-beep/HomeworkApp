import assert from "node:assert/strict";
import test from "node:test";

import { parseAssignmentImportJson } from "../lib/assignment-import-parser.mjs";

const productionQ6Json = `{
  "formatVersion": "assignment-import-v1",
  "assignment": {
    "title": "Computing",
    "instructions": "Answer every question.",
    "status": "DRAFT",
    "questions": [{
      "id": "q6",
      "order": 1,
      "type": "OPEN_TEXT",
      "prompt": "In pseudocode, set Location to "Lab 2", Reading to 18.5 and Active to TRUE.",
      "textI18n": {
        "en": "Set Location to "Lab 2", Reading to 18.5 and Active to TRUE.",
        "zh": "将 Location 设为 "Lab 2"，Reading 设为 18.5，并将 Active 设为 TRUE。"
      }
    }]
  }
}`;

test("repairs the production q6 quote shape in prompt and both translations", () => {
  const result = parseAssignmentImportJson(productionQ6Json);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.assignment.questions[0].id, "q6");
  assert.equal(
    result.assignment.questions[0].prompt,
    'In pseudocode, set Location to "Lab 2", Reading to 18.5 and Active to TRUE.',
  );
  assert.equal(
    result.assignment.questions[0].textI18n?.en,
    'Set Location to "Lab 2", Reading to 18.5 and Active to TRUE.',
  );
  assert.equal(
    result.assignment.questions[0].textI18n?.zh,
    '将 Location 设为 "Lab 2"，Reading 设为 18.5，并将 Active 设为 TRUE。',
  );
});

test("does not reinterpret a genuine missing comma as an embedded quote", () => {
  const malformed = productionQ6Json.replace(
    '"title": "Computing",',
    '"title": "Computing" "instructions2": "unexpected",',
  );

  const result = parseAssignmentImportJson(malformed);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.errors[0].code, "invalid_json");
});
