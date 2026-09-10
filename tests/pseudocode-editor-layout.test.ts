import assert from "node:assert/strict";
import test from "node:test";
import { synchroniseEditorScroll } from "../lib/pseudocode-editor-layout";

test("synchroniseEditorScroll copies both axes to every rendered layer", () => {
  const source = { scrollTop: 144, scrollLeft: 38 };
  const highlight = { scrollTop: 0, scrollLeft: 0 };
  const secondLayer = { scrollTop: 12, scrollLeft: 4 };

  synchroniseEditorScroll(source, highlight, secondLayer);

  assert.deepEqual(highlight, source);
  assert.deepEqual(secondLayer, source);
});
