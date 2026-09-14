import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("pseudocode layers are clipped to an isolated editor below the opaque action bar", () => {
  const editorSource = readFileSync(
    "app/assignments/[assignmentId]/work/pseudocode-answer-editor.tsx",
    "utf8",
  );
  const workPageSource = readFileSync(
    "app/assignments/[assignmentId]/work/page.tsx",
    "utf8",
  );
  const autosaveFormSource = readFileSync(
    "app/assignments/[assignmentId]/work/autosave-form.tsx",
    "utf8",
  );

  assert.match(editorSource, /className="relative isolate min-h-80 overflow-hidden [^"]*\[contain:paint\]/);
  assert.match(editorSource, /aria-hidden="true" className="[^"]*absolute inset-y-0 left-0/);
  assert.match(autosaveFormSource, /className="sticky bottom-4 z-30 [^"]* bg-white /);
  assert.doesNotMatch(`${workPageSource}\n${autosaveFormSource}`, /className="sticky bottom-4[^"]*bg-white\/95/);
});
