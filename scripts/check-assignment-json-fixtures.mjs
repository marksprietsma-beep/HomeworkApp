import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const validFixtures = ["docs/fixtures/assignment-import/valid/fractions-check.json"];
const invalidFixtures = [
  "docs/fixtures/assignment-import/invalid/contract-violations.json",
  "docs/fixtures/assignment-import/invalid/text-question-with-options.json",
];
const docsPath = "docs/assignment-import-json-v1.md";
const allowedQuestionTypes = new Set(["OPEN_TEXT", "LONG_TEXT", "MULTIPLE_CHOICE"]);
const allowedStatuses = new Set(["DRAFT", "PUBLISHED"]);

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

function parseJson(relativePath, text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${relativePath} is not valid JSON: ${error.message}`);
  }
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function addUnknownFieldErrors(errors, label, value, allowedFields) {
  for (const field of Object.keys(value)) {
    if (!allowedFields.has(field)) {
      errors.push(`${label} has unknown field "${field}"`);
    }
  }
}

function validateAssignmentSmoke(value) {
  const errors = [];

  if (!isPlainObject(value)) {
    return ["root must be a JSON object"];
  }

  addUnknownFieldErrors(errors, "root", value, new Set(["formatVersion", "assignment"]));

  if (value.formatVersion !== "assignment-import-v1") {
    errors.push("formatVersion must be assignment-import-v1");
  }

  if (!isPlainObject(value.assignment)) {
    errors.push("assignment must be an object");
    return errors;
  }

  const assignment = value.assignment;
  addUnknownFieldErrors(
    errors,
    "assignment",
    assignment,
    new Set(["title", "instructions", "dueDate", "status", "questions"]),
  );

  if (!hasNonEmptyString(assignment.title)) {
    errors.push("assignment.title must be a non-empty string");
  }
  if (!hasNonEmptyString(assignment.instructions)) {
    errors.push("assignment.instructions must be a non-empty string");
  }
  if (
    assignment.dueDate !== undefined &&
    assignment.dueDate !== null &&
    (typeof assignment.dueDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(assignment.dueDate))
  ) {
    errors.push("assignment.dueDate must be YYYY-MM-DD, null, or omitted");
  }
  if (!allowedStatuses.has(assignment.status)) {
    errors.push("assignment.status must be DRAFT or PUBLISHED");
  }
  if (!Array.isArray(assignment.questions) || assignment.questions.length === 0) {
    errors.push("assignment.questions must be a non-empty array");
    return errors;
  }

  const seenQuestionIds = new Set();
  const seenOrders = new Set();

  assignment.questions.forEach((question, index) => {
    const label = `question ${index + 1}`;
    if (!isPlainObject(question)) {
      errors.push(`${label} must be an object`);
      return;
    }

    addUnknownFieldErrors(errors, label, question, new Set(["id", "order", "type", "prompt", "options", "image"]));

    if (!hasNonEmptyString(question.id)) {
      errors.push(`${label}.id must be a non-empty string`);
    } else if (seenQuestionIds.has(question.id)) {
      errors.push(`${label}.id duplicates "${question.id}"`);
    } else {
      seenQuestionIds.add(question.id);
    }

    if (!Number.isInteger(question.order)) {
      errors.push(`${label}.order must be an integer`);
    } else if (seenOrders.has(question.order)) {
      errors.push(`${label}.order duplicates ${question.order}`);
    } else {
      seenOrders.add(question.order);
    }

    if (!allowedQuestionTypes.has(question.type)) {
      errors.push(`${label}.type must be OPEN_TEXT, LONG_TEXT, or MULTIPLE_CHOICE`);
    }
    if (!hasNonEmptyString(question.prompt)) {
      errors.push(`${label}.prompt must be a non-empty string`);
    }

    if (question.type === "MULTIPLE_CHOICE") {
      if (!Array.isArray(question.options) || question.options.length < 2) {
        errors.push(`${label}.options must contain at least two options`);
      } else {
        const seenOptionIds = new Set();
        question.options.forEach((option, optionIndex) => {
          const optionLabel = `${label}.options[${optionIndex}]`;
          if (!isPlainObject(option)) {
            errors.push(`${optionLabel} must be an object`);
            return;
          }
          addUnknownFieldErrors(errors, optionLabel, option, new Set(["id", "text"]));
          if (!hasNonEmptyString(option.id)) {
            errors.push(`${optionLabel}.id must be a non-empty string`);
          } else if (seenOptionIds.has(option.id)) {
            errors.push(`${optionLabel}.id duplicates "${option.id}"`);
          } else {
            seenOptionIds.add(option.id);
          }
          if (!hasNonEmptyString(option.text)) {
            errors.push(`${optionLabel}.text must be a non-empty string`);
          }
        });
      }
    } else if ("options" in question) {
      errors.push(`${label}.options must be omitted unless type is MULTIPLE_CHOICE`);
    }

    if (question.image !== undefined && question.image !== null) {
      if (!isPlainObject(question.image)) {
        errors.push(`${label}.image must be an object or null`);
      } else {
        addUnknownFieldErrors(errors, `${label}.image`, question.image, new Set(["path", "caption", "altText"]));
        if (!hasNonEmptyString(question.image.path)) {
          errors.push(`${label}.image.path must be a non-empty string`);
        }
        for (const optionalField of ["caption", "altText"]) {
          if (optionalField in question.image && typeof question.image[optionalField] !== "string") {
            errors.push(`${label}.image.${optionalField} must be a string when present`);
          }
        }
      }
    }
  });

  for (let expectedOrder = 1; expectedOrder <= assignment.questions.length; expectedOrder += 1) {
    if (!seenOrders.has(expectedOrder)) {
      errors.push(`question orders must be sequential; missing ${expectedOrder}`);
    }
  }

  return errors;
}

function normalizeJsonText(text) {
  return `${JSON.stringify(JSON.parse(text), null, 2)}\n`;
}

function extractDocumentedFixtureBlocks(markdown) {
  const fixtureBlockRegex = /<!--\s*fixture:\s*([^\s]+)\s*-->\s*```json\n([\s\S]*?)\n```/g;
  return [...markdown.matchAll(fixtureBlockRegex)].map((match) => ({
    fixturePath: match[1],
    jsonText: `${match[2]}\n`,
  }));
}

async function checkFixture(relativePath, expectedValid) {
  const text = await readText(relativePath);
  let parsed;
  try {
    parsed = parseJson(relativePath, text);
  } catch (error) {
    fail(error.message);
    return;
  }

  const errors = validateAssignmentSmoke(parsed);
  if (expectedValid && errors.length > 0) {
    fail(`${relativePath} should pass the smoke check:\n  - ${errors.join("\n  - ")}`);
    return;
  }
  if (!expectedValid && errors.length === 0) {
    fail(`${relativePath} is in invalid fixtures but passed the smoke check`);
    return;
  }

  pass(`${relativePath} parsed as JSON and ${expectedValid ? "passed" : "failed"} the smoke check as expected`);
}

async function checkDocumentationSync() {
  const markdown = await readText(docsPath);
  const blocks = extractDocumentedFixtureBlocks(markdown);
  const expectedPaths = new Set([...validFixtures, ...invalidFixtures]);

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
  await checkFixture(fixturePath, true);
}
for (const fixturePath of invalidFixtures) {
  await checkFixture(fixturePath, false);
}
await checkDocumentationSync();

if (failureCount > 0) {
  console.error(`\nAssignment JSON fixture check failed with ${failureCount} problem${failureCount === 1 ? "" : "s"}.`);
  process.exit(1);
}

console.log("\nAssignment JSON fixture check passed.");
