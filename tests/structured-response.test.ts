import assert from "node:assert/strict";
import test from "node:test";
import { structuredFields, validateStructuredAnswer } from "../lib/structured-response";

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
