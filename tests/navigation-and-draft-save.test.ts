import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const layout = readFileSync("app/layout.tsx", "utf8");
const homeAction = readFileSync("app/components/persistent-home-action.tsx", "utf8");
const workForm = readFileSync("app/assignments/[assignmentId]/work/autosave-form.tsx", "utf8");

test("the shared layout provides Home navigation only on authenticated nested routes", () => {
  assert.match(layout, /<PersistentHomeAction authenticated=\{user !== null\}/);
  assert.match(homeAction, /href="\/"/);
  assert.match(homeAction, /routesWithoutHomeAction = new Set\(\["\/", "\/login", "\/setup", "\/change-password"\]\)/);
  assert.match(homeAction, /if \(!authenticated \|\| routesWithoutHomeAction\.has\(pathname\)\)/);
});

test("explicit Save draft persists without navigation and keeps an accessible confirmation", () => {
  assert.match(workForm, /submitter\?\.value !== "DRAFT"/);
  assert.match(workForm, /event\.preventDefault\(\)/);
  assert.match(workForm, /fetch\(`\/api\/assignments\/\$\{assignmentId\}\/autosave`/);
  assert.match(workForm, /aria-live="polite" role="status"/);
  assert.match(workForm, /"Draft saved"/);
});

test("Submit response continues through the server form action", () => {
  assert.match(workForm, /if \(submitter\?\.value !== "DRAFT"\) \{[\s\S]*?return;/);
  assert.match(workForm, /action=\{action\}/);
  assert.match(workForm, /value="SUBMITTED"/);
});
