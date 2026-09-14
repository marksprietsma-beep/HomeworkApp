import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("assignment helper uses safe quotes in prose and escaped ASCII quotes in code", () => {
  assert.match(
    ASSIGNMENT_PSEUDOCODE_PROMPT_GUIDANCE,
    /ordinary human-readable question prose, do not use ASCII double quotes/,
  );
  assert.match(
    ASSIGNMENT_PSEUDOCODE_PROMPT_GUIDANCE,
    /Use Unicode curly quotes for quoted words, labels, output phrases, and examples/,
  );
  assert.ok(
    ASSIGNMENT_PSEUDOCODE_PROMPT_GUIDANCE.includes(
      '"prompt":"If Age is 13 or more, output “Teenager or older”; otherwise output “Under 13”."',
    ),
  );
  assert.match(
    ASSIGNMENT_PSEUDOCODE_PROMPT_GUIDANCE,
    /Reserve ASCII double quotes for JSON syntax and genuine code\/string literals/,
  );
  assert.ok(
    ASSIGNMENT_PSEUDOCODE_PROMPT_GUIDANCE.includes(
      '"prompt":"```pseudocode\\nOUTPUT \\"Valid\\"\\n```"',
    ),
  );
});

test("assignment helper chooses pseudocode mode from the required answer, not prompt presentation", () => {
  const formSource = readFileSync(
    "app/classes/[classId]/assignments/import/import-assignment-form.tsx",
    "utf8",
  );

  assert.match(formSource, /only when the student must write or rewrite code/);
  assert.match(formSource, /A prompt may show pseudocode while expecting TEXT prose/);
  assert.match(formSource, /a result\/output, an explanation, or error identification/);
  assert.match(
    ASSIGNMENT_PSEUDOCODE_PROMPT_GUIDANCE,
    /A fenced pseudocode sample in a question prompt does not require a pseudocode answer/,
  );
});

test("assignment helper opens with clarified overall-response Markdown wording", () => {
  const formSource = readFileSync(
    "app/classes/[classId]/assignments/import/import-assignment-form.tsx",
    "utf8",
  );

  assert.match(
    formSource,
    /Return only one complete, strict JSON object with no outer Markdown fence or commentary/,
  );
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
