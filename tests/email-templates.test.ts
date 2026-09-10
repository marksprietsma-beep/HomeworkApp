import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_EMAIL_TEMPLATES, renderSafeHtml, renderTemplate, validateTemplate } from "../lib/email-templates";

const data = { studentName: "Alex", className: "9 Maths", assignmentTitle: "Fractions", dueDate: "", clarionLink: "https://clarion.example/assignments/1/work" };

test("supported placeholders render deterministically and absent due dates stay natural", () => {
  const text = renderTemplate(DEFAULT_EMAIL_TEMPLATES.homeworkBody, data);
  assert.match(text, /Hi Alex/);
  assert.match(text, /9 Maths/);
  assert.doesNotMatch(text, /Due: null|Due: undefined/);
  assert.doesNotMatch(text, /\n{3,}/);
});

test("unknown and malformed placeholders are rejected", () => {
  assert.throws(() => validateTemplate("Hello {{student.email}}"), /Unsupported template placeholder/);
  assert.throws(() => validateTemplate("Hello {{studentName"), /invalid placeholder/);
});

test("safe HTML escapes editable copy and keeps the approved CTA link", () => {
  const html = renderSafeHtml("Hello <script>alert('x')</script>", data.clarionLink, "View Homework");
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /https:\/\/clarion\.example/);
});

test("feedback defaults never contain feedback detail or marks", () => {
  const text = renderTemplate(DEFAULT_EMAIL_TEMPLATES.feedbackBody, data);
  assert.match(text, /released feedback/);
  assert.doesNotMatch(text, /score|percentage|rank|overallFeedback/i);
});
