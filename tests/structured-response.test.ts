import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { assertManualCreateResponseMode, assertSafeResponseModeEdit, submissionStateAfterSave } from "../lib/question-response-mode";
import { safeStructuredAnswerValues, safeStructuredSchema, structuredExportRepresentation, structuredFields, tableCellContent, validateStructuredAnswer } from "../lib/structured-response";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore The test compiler does not pair the declaration with this explicit .mjs import.
import { parseAssignmentImportJson } from "../lib/assignment-import-parser.mjs";

const schema = {
  schemaVersion: 1,
  kind: "table",
  columns: [{ id: "label", label: "" }, { id: "total", label: "£" }],
  rows: [{ id: "prime_cost", label: "Prime cost", cells: { total: { editable: true, inputType: "currency" } } }],
};

test("derives deterministic semantic fields and accepts known values", () => {
  assert.deepEqual(structuredFields(schema), [{ id: "prime_cost.total", label: "Prime cost — £", inputType: "currency" }]);
  assert.deepEqual(validateStructuredAnswer(schema, { schemaVersion: 1, values: { "prime_cost.total": "196000" } }), { schemaVersion: 1, values: { "prime_cost.total": "196000" } });
});

test("rejects hidden structured answer keys", () => {
  assert.throws(() => validateStructuredAnswer(schema, { schemaVersion: 1, values: { "hidden.total": "1" } }), /unknown field/);
});

test("manual create/edit guards preserve structured and answered response semantics", () => {
  assert.throws(() => assertManualCreateResponseMode("STRUCTURED"), /validated JSON import/);
  assert.throws(() => assertSafeResponseModeEdit("TEXT", "STRUCTURED", false), /validated JSON import/);
  assert.throws(() => assertSafeResponseModeEdit("STRUCTURED", "TEXT", false), /cannot be changed/);
  assert.throws(() => assertSafeResponseModeEdit("TEXT", "PSEUDOCODE", true), /once students have responses/);
  assert.doesNotThrow(() => assertSafeResponseModeEdit("STRUCTURED", "STRUCTURED", true));
});

test("draft saves do not downgrade an existing submission", () => {
  const submittedAt = new Date("2026-09-09T10:00:00Z");
  assert.deepEqual(submissionStateAfterSave({ status: "SUBMITTED", submittedAt }, true, new Date()), { status: "SUBMITTED", submittedAt });
  assert.deepEqual(submissionStateAfterSave(null, true, new Date()), { status: "DRAFT", submittedAt: null });
});

test("explicit first-column cells win over labels and malformed schemas fail safely", () => {
  const firstColumn = { ...schema, rows: [{ id: "prime_cost", label: "Prime cost", cells: { label: { value: "Explicit" }, total: { editable: true } } }] };
  assert.deepEqual(tableCellContent(firstColumn, "prime_cost", "label"), { available: true, cell: { value: "Explicit" }, fallbackLabel: null });
  assert.deepEqual(tableCellContent(schema, "prime_cost", "label"), { available: true, cell: null, fallbackLabel: "Prime cost" });
  assert.deepEqual(structuredFields({ schemaVersion: 1, kind: "table", columns: {}, rows: null }), []);
  assert.deepEqual(tableCellContent({ schemaVersion: 1, kind: "t_account", entries: "bad" }, "x", "y"), { available: false });
});

test("nested corrupt cells and presentation enums make stored schemas unavailable", () => {
  const objectValue = { ...schema, rows: [{ id: "r1", label: "Row 1", cells: { total: { value: { oops: "not a string" } } } }] };
  assert.equal(safeStructuredSchema(objectValue), null);
  assert.equal(safeStructuredSchema({ schemaVersion: 1, kind: "t_account", title: "Bank", entries: [{ id: "rent", label: "Rent", side: "credit", amount: { editable: "yes" } }] }), null);
  assert.equal(safeStructuredSchema({ ...schema, columns: [{ id: "label", label: "", align: "diagonal" }], rows: [] }), null);
  assert.equal(safeStructuredSchema({ ...schema, rows: [{ id: "r1", label: "Row", style: "flashing" }] }), null);
});

test("corrupt stored answer values are excluded before read-only rendering", () => {
  assert.deepEqual(safeStructuredAnswerValues({ schemaVersion: 1, values: { "prime_cost.total": "196000", unsafe: { oops: true }, alsoUnsafe: 42 } }), { "prime_cost.total": "196000" });
  assert.deepEqual(safeStructuredAnswerValues({ schemaVersion: 1, values: [] }), {});
});

test("Manufacturing Account fixture preserves semantic IDs through parse, answer validation, and export", async () => {
  const fixture = await readFile("docs/fixtures/assignment-import/valid/manufacturing-account-v2.json", "utf8");
  const parsed = parseAssignmentImportJson(fixture);
  assert.equal(parsed.ok, true);
  if (!parsed.ok || !parsed.assignment) return;
  const responseSchema = parsed.assignment.questions[0].responseSchema;
  const values = { "opening_raw_materials.working": "4500", "prime_cost.total": "196000", "cost_production.total": "210000" };
  const representation = structuredExportRepresentation(responseSchema, { schemaVersion: 1, values });
  assert.deepEqual(representation.answerData.values, values);
  assert.ok(representation.fields.some((field) => field.id === "prime_cost.total" && field.label === "Prime cost — £"));
});
