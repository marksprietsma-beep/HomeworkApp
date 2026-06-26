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
  {
    path: "docs/fixtures/feedback-import/invalid/missing-follow-up-action-ids.json",
    expectedErrors: [
      "Each follow-up action must include a stable string id, for example pf1-q86-action1",
    ],
  },
  {
    path: "docs/fixtures/feedback-import/invalid/old-helper-shape.json",
    expectedErrors: [
      "Use root-level participantFeedback, not participants",
      "Use root-level class, not assignment.class",
      "class must be an object",
    ],
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
  const bilingualQuestionAction = result.feedback.participantFeedback
    .flatMap((participant) => participant.questionFeedback)
    .flatMap((question) => question.followUpActions)
    .find((action) => action.id === "pf-3-q101-followup");
  if (bilingualQuestionAction?.promptI18n?.zh !== "你把分子和分母都乘以了多少？") {
    fail(`${relativePath} did not preserve bilingual question-level follow-up action promptI18n during parser normalisation`);
    return;
  }
  pass(`${relativePath} parsed and produced normalised feedback for ${result.feedback.participantFeedback.length} participant(s) and ${actionCount} action(s), preserving question-level action promptI18n`);
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

const responseOverviewPage = await readText("app/classes/[classId]/assignments/[assignmentId]/responses/page.tsx");
const feedbackImportForm = await readText("app/classes/[classId]/assignments/[assignmentId]/feedback/import/feedback-import-form.tsx");
const feedbackImportActions = await readText("app/classes/[classId]/assignments/[assignmentId]/feedback/import/actions.ts");
const prismaSchema = await readText("prisma/schema.prisma");
const sharedFeedbackHelper = await readText("lib/feedback-helper-prompt.ts");
const requiredPromptText = [
  "feedbackFormat",
  "feedbackVersion",
  "sourceExport",
  "assignment",
  "class",
  "participantFeedback",
  "Do not return root-level participants",
  "Do not nest class inside assignment",
  "Do not rename participantFeedback to participants",
  "Return valid importable feedback JSON only",
  "participant/source participant id",
  "Every follow-up action requires a stable non-empty string id",
  "participant-level followUpActions and question-level followUpActions",
  "pf1-action1",
  "pf1-q86-action1",
  "pf1-q91-action1",
  "Each follow-up action must include id, type, prompt, and required",
];
for (const expectedText of requiredPromptText) {
  if (!sharedFeedbackHelper.includes(expectedText)) {
    fail(`Shared feedback helper prompt is missing required text: ${expectedText}`);
  }
}
if (!responseOverviewPage.includes("buildFullFeedbackPrompt")) {
  fail("Response overview page must build the shared feedback helper prompt");
}
if (!feedbackImportForm.includes("FEEDBACK_HELPER_PROMPT")) {
  fail("Feedback import form must use the shared feedback helper prompt");
}
if (!feedbackImportForm.includes("!compact ?") || !feedbackImportForm.includes("<ChatGptJsonHelper")) {
  fail("Compact feedback import form must hide the older ChatGPT helper card while keeping it available on the full import page");
}
if (!feedbackImportActions.includes("releaseState: FeedbackReleaseState.DRAFT")) {
  fail("Feedback import persistence must explicitly save newly imported participant feedback as Draft");
}
if (!feedbackImportActions.includes("where: { assignmentId, releaseState: FeedbackReleaseState.DRAFT }") || !feedbackImportActions.includes("releaseState: FeedbackReleaseState.RELEASED")) {
  fail("Feedback release action must continue to update Draft feedback to Released");
}
if (!feedbackImportActions.includes("questionFeedbackId: questionFeedback.id") || !feedbackImportActions.includes("promptI18n: action.promptI18n")) {
  fail("Question-level follow-up action persistence must save promptI18n while preserving its questionFeedback link");
}
if (!prismaSchema.includes("releaseState           FeedbackReleaseState     @default(DRAFT)")) {
  fail("ParticipantFeedback.releaseState schema default must be DRAFT");
}
if (failureCount === 0) {
  pass("shared feedback helper prompt includes import-contract and follow-up action id guardrails");
}

if (failureCount > 0) {
  console.error(`\nFeedback JSON fixture check failed with ${failureCount} problem${failureCount === 1 ? "" : "s"}.`);
  process.exit(1);
}

console.log("\nFeedback JSON fixture check passed.");
