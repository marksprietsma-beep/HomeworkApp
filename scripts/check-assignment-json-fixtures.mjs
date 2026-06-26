import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { parseAssignmentImportJson } from "../lib/assignment-import-parser.mjs";

const repoRoot = process.cwd();
const validFixtures = ["docs/fixtures/assignment-import/valid/fractions-check.json", "docs/fixtures/assignment-import/valid/bilingual-vocabulary.json", "docs/fixtures/assignment-import/valid/pseudocode-loops.json"];
const invalidFixtures = [
  {
    path: "docs/fixtures/assignment-import/invalid/contract-violations.json",
    expectedErrors: [
      "assignment.dueDate must be a real YYYY-MM-DD date",
      "assignment.status must be DRAFT or PUBLISHED",
      "id duplicates \"q1\"",
      "type must be OPEN_TEXT or MULTIPLE_CHOICE",
      "points must be a positive integer",
      "id duplicates \"a\"",
      "question orders must be sequential; missing 2",
    ],
  },
  {
    path: "docs/fixtures/assignment-import/invalid/text-question-with-options.json",
    expectedErrors: ["options must be omitted unless type is MULTIPLE_CHOICE"],
  },
  {
    path: "docs/fixtures/assignment-import/invalid/bad-glossary.json",
    expectedErrors: ["category must be a string", "must match an assignment question id"],
  },
];
const docsPath = "docs/assignment-import-json-v1.md";

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
function normalizeJsonText(text) {
  return `${JSON.stringify(JSON.parse(text), null, 2)}\n`;
}

function extractDocumentedFixtureBlocks(markdown) {
  const normalizedMarkdown = markdown.replace(/\r\n/g, "\n");
  const fixtureBlockRegex = /<!--\s*fixture:\s*([^\s]+)\s*-->\s*```json\n([\s\S]*?)\n```/g;
  return [...normalizedMarkdown.matchAll(fixtureBlockRegex)].map((match) => ({
    fixturePath: match[1],
    jsonText: `${match[2]}\n`,
  }));
}

async function checkValidFixture(relativePath) {
  const text = await readText(relativePath);
  const result = parseAssignmentImportJson(text);

  if (!result.ok) {
    fail(`${relativePath} should pass parser validation:\n  - ${result.errors.map((item) => item.message).join("\n  - ")}`);
    return;
  }

  pass(`${relativePath} parsed and produced a normalised assignment with ${result.assignment.questions.length} questions`);
}

async function checkInvalidFixture(fixture) {
  const text = await readText(fixture.path);
  const result = parseAssignmentImportJson(text);

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

async function checkHelperPromptDoesNotAdvertiseUnsupportedTypes() {
  const formSource = await readText("app/classes/[classId]/assignments/import/import-assignment-form.tsx");
  const promptMatch = formSource.match(/const assignmentChatGptPrompt = `([\s\S]*?)`;/);

  if (!promptMatch) {
    fail("assignment import helper prompt could not be found");
    return;
  }

  if (promptMatch[1].includes("LONG_TEXT")) {
    fail("assignment import helper prompt must not advertise unsupported LONG_TEXT question types");
    return;
  }

  for (const requiredText of ["responseMode: \"PSEUDOCODE\"", "pseudocodeDialect: \"CAMBRIDGE_9618_2026\"", "write, complete, trace, debug, or explain pseudocode/code-style answers", "Do not add pseudocode metadata to ordinary prose questions"]) {
    if (!promptMatch[1].includes(requiredText)) {
      fail(`assignment import helper prompt is missing pseudocode guidance: ${requiredText}`);
      return;
    }
  }

  pass("assignment import helper prompt only advertises supported question types and includes pseudocode metadata guidance");
}

async function checkDocumentationSync() {
  const markdown = await readText(docsPath);
  const blocks = extractDocumentedFixtureBlocks(markdown);
  const expectedPaths = new Set([...validFixtures, ...invalidFixtures.map((fixture) => fixture.path)]);

  for (const expectedPath of expectedPaths) {
    if (!blocks.some((block) => block.fixturePath === expectedPath)) {
      fail(`${docsPath} is missing documented fixture block for ${expectedPath}`);
    }
  }

  for (const block of blocks) {
    if (!expectedPaths.has(block.fixturePath)) {
      fail(`${docsPath} references an unmanaged fixture block: ${block.fixturePath}`);
      continue;
    }

    let fixtureText;
    try {
      fixtureText = await readText(block.fixturePath);
      const documented = normalizeJsonText(block.jsonText);
      const fixture = normalizeJsonText(fixtureText);
      if (documented !== fixture) {
        fail(`${docsPath} example for ${block.fixturePath} is out of sync with the fixture file`);
      } else {
        pass(`${docsPath} example is in sync with ${block.fixturePath}`);
      }
    } catch (error) {
      fail(`${docsPath} example for ${block.fixturePath} could not be checked: ${error.message}`);
    }
  }
}

for (const fixturePath of validFixtures) {
  await checkValidFixture(fixturePath);
}
for (const fixture of invalidFixtures) {
  await checkInvalidFixture(fixture);
}
await checkDocumentationSync();
await checkHelperPromptDoesNotAdvertiseUnsupportedTypes();

if (failureCount > 0) {
  console.error(`\nAssignment JSON fixture check failed with ${failureCount} problem${failureCount === 1 ? "" : "s"}.`);
  process.exit(1);
}

console.log("\nAssignment JSON fixture check passed.");
