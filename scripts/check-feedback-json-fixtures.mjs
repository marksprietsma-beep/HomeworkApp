import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { parseFeedbackImportJson } from "../lib/feedback-import-parser.mjs";

const repoRoot = process.cwd();
const validFixtures = ["docs/fixtures/feedback-import/valid/fractions-feedback.json"];
const invalidFixtures = [
  {
    path: "docs/fixtures/feedback-import/invalid/contract-violations.json",
    expectedErrors: [
      "feedbackFormat must be homework-feedback",
      "feedbackVersion must be integer 1",
      "sourceExport.exportFormat must be homework-assignment-responses-v2",
      "sourceExport.exportVersion must be integer 2",
      "assignment.id must be an integer",
      "class.id must match current class 7",
      "participant.id must match an exported participant",
      "overallFeedback must be a non-empty string",
      "strengths must be a non-empty array",
      "questionId must match an exported assignment question",
      "type must be ACKNOWLEDGEMENT, SHORT_REFLECTION, or ANSWER_FOLLOW_UP_QUESTION",
      "id duplicates \"duplicate-action\"",
      "required must be a boolean when present",
    ],
  },
  {
    path: "docs/fixtures/feedback-import/invalid/not-json.json",
    expectedErrors: ["Input is not valid JSON"],
  },
];
const context = {
  assignmentId: 42,
  classId: 7,
  questions: [{ id: 101 }, { id: 102 }],
  participants: [
    { id: 3, submission: { id: 18, responsesByQuestionId: { "101": "2/4", "102": "1/3 is smaller" } } },
    { id: 4, submission: null },
  ],
};

let failureCount = 0;

function fail(message) {
  failureCount += 1;
  console.error(`✗ ${message}`);
}

function pass(message) {
  console.log(`✓ ${message}`);
}

async function readText(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

async function checkValidFixture(relativePath) {
  const text = await readText(relativePath);
  const result = parseFeedbackImportJson(text, context);
  if (!result.ok) {
    fail(`${relativePath} should pass parser validation:\n  - ${result.errors.map((item) => item.message).join("\n  - ")}`);
    return;
  }
  const actionCount = result.feedback.participantFeedback.reduce((total, participant) => total + participant.followUpActions.length + participant.questionFeedback.reduce((questionTotal, question) => questionTotal + question.followUpActions.length, 0), 0);
  pass(`${relativePath} parsed and produced normalised feedback for ${result.feedback.participantFeedback.length} participant(s) and ${actionCount} action(s)`);
}

async function checkInvalidFixture(fixture) {
  const text = await readText(fixture.path);
  const result = parseFeedbackImportJson(text, context);
  if (result.ok) {
    fail(`${fixture.path} is in invalid fixtures but passed parser validation`);
    return;
  }
  const messages = result.errors.map((item) => item.message);
  for (const expectedError of fixture.expectedErrors) {
    if (!messages.some((message) => message.includes(expectedError))) {
      fail(`${fixture.path} did not report expected parser error containing: ${expectedError}\nActual errors:\n  - ${messages.join("\n  - ")}`);
      return;
    }
  }
  pass(`${fixture.path} failed parser validation for the expected reasons`);
}

for (const fixturePath of validFixtures) {
  await checkValidFixture(fixturePath);
}
for (const fixture of invalidFixtures) {
  await checkInvalidFixture(fixture);
}

if (failureCount > 0) {
  console.error(`\nFeedback JSON fixture check failed with ${failureCount} problem${failureCount === 1 ? "" : "s"}.`);
  process.exit(1);
}

console.log("\nFeedback JSON fixture check passed.");
