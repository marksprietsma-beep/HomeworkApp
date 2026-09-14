import assert from "node:assert/strict";
import test from "node:test";
import { buildFeedbackHelperPrompt } from "../lib/feedback-helper-prompt";

test("feedback guidance accepts Unicode and ASCII assignment arrows equally", () => {
  const prompt = buildFeedbackHelperPrompt("english", 10);

  for (const example of ["Score ← 10", "Score <- 10", "Score -> 10"]) {
    assert.ok(prompt.includes(example), `missing accepted assignment example: ${example}`);
  }

  assert.match(prompt, /Do not reduce a score, create a target or follow-up action, or add corrective syntax, formatting, or other feedback solely because a student used "<-" or "->" instead of "←"/);
  assert.match(prompt, /Do not silently rewrite stored or exported response text/);
});

test("feedback guidance still distinguishes equality from assignment", () => {
  const prompt = buildFeedbackHelperPrompt();

  assert.match(prompt, /does not make "=" an assignment operator/);
  assert.match(prompt, /flag genuinely incorrect use of "=" where Cambridge pseudocode requires assignment/);
  assert.match(prompt, /evaluate algorithmic correctness, declarations, control structures, identifiers, operators, and all other pseudocode rules normally/);
});
