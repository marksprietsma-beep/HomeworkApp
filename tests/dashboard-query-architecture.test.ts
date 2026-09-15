import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dashboardSource = readFileSync("lib/dashboard.ts", "utf8");
const pageSource = readFileSync("app/page.tsx", "utf8");

test("staff dashboard selects only feedback progress and submission identity fields", () => {
  assert.match(dashboardSource, /status: isStudent\(user\),\s+submittedAt: isStudent\(user\),/);
  assert.match(dashboardSource, /feedbackImport: isStudent\(user\)[\s\S]*?: false,/);
  assert.match(dashboardSource, /followUpActions: isStudent\(user\)[\s\S]*?: false,/);
  assert.match(dashboardSource, /questionFeedback: isStudent\(user\)[\s\S]*?: false,/);
  assert.match(dashboardSource, /studentId: true,\s+submissionId: true,\s+releaseState: true,/);
});

test("teacher and admin assignment rows render the derived feedback badge", () => {
  assert.match(pageSource, /feedbackStatusBadgeClass\(assignment\.feedbackStatus\.tone\)/);
  assert.match(pageSource, /assignment\.feedbackStatus\.label/);
});
