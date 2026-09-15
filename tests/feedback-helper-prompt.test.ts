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

test("feedback guidance requires non-empty participant-level feedback fields", () => {
  const prompt = buildFeedbackHelperPrompt();

  assert.match(prompt, /overallFeedback is REQUIRED and must be a non-empty string/);
  assert.match(prompt, /strengths is REQUIRED and must be a non-empty array containing at least one non-empty string/);
  assert.match(prompt, /targets is REQUIRED and must be a non-empty array containing at least one non-empty string/);
  assert.match(prompt, /Never return strengths: \[\] or targets: \[\]/);
  assert.match(prompt, /Feedback-specific quality-control check before returning/);
  assert.match(prompt, /Do not return the JSON until every participantFeedback entry passes all three checks/);
});

test("feedback guidance handles participants without submissions without fabricating strengths", () => {
  const prompt = buildFeedbackHelperPrompt("english");

  assert.match(prompt, /If a participant has submission: null, do not invent academic strengths/);
  assert.match(prompt, /No submitted work was available to assess strengths\./);
  assert.match(prompt, /still provide at least one practical target or next step/);
  assert.match(prompt, /avoid question-level feedback unless there is a clear reason/);
});

test("non-empty participant guidance remains present in bilingual prompts", () => {
  const prompt = buildFeedbackHelperPrompt("bilingual");

  assert.match(prompt, /strengths is REQUIRED and must be a non-empty array/);
  assert.match(prompt, /targets is REQUIRED and must be a non-empty array/);
  assert.match(prompt, /Generate bilingual feedback/);
  assert.match(prompt, /strengthsI18n \{ en, zh \}/);
});
