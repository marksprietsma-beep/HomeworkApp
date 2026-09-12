import assert from "node:assert/strict";
import test from "node:test";
import {
  ASSIGNMENT_JSON_OUTPUT_INSTRUCTIONS,
  ASSIGNMENT_PSEUDOCODE_PROMPT_GUIDANCE,
} from "../lib/assignment-pseudocode-prompt-guidance";

test("assignment helper locks down pseudocode fences and strict JSON characters", () => {
  assert.match(ASSIGNMENT_PSEUDOCODE_PROMPT_GUIDANCE, /A single backtick is invalid/);
  assert.match(ASSIGNMENT_PSEUDOCODE_PROMPT_GUIDANCE, /Do not escape underscores/);
  assert.match(ASSIGNMENT_PSEUDOCODE_PROMPT_GUIDANCE, /Do not escape colons/);
  assert.ok(ASSIGNMENT_PSEUDOCODE_PROMPT_GUIDANCE.includes('"prompt":"Consider the pseudocode:\\n```pseudocode\\nDECLARE X : INTEGER\\nOUTPUT X\\n```\\nExplain what the code does."'));
});

test("assignment helper distinguishes response Markdown from in-string pseudocode fences", () => {
  const assignmentHelperGuidance = `${ASSIGNMENT_PSEUDOCODE_PROMPT_GUIDANCE}\n${ASSIGNMENT_JSON_OUTPUT_INSTRUCTIONS}`;

  assert.match(
    assignmentHelperGuidance,
    /Do not wrap the overall JSON response in Markdown fences/,
  );
  assert.match(
    assignmentHelperGuidance,
    /Triple-backtick pseudocode fences are permitted only inside JSON string values where required/,
  );
  assert.doesNotMatch(
    assignmentHelperGuidance,
    /Do not include Markdown fences/,
  );
});
