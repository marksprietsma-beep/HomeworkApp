import assert from "node:assert/strict";
import test from "node:test";
import { parsePseudocodePrompt } from "../lib/pseudocode-prompt";

test("ordinary prompts remain one unchanged text segment", () => {
  assert.deepEqual(parsePseudocodePrompt("Explain <b>this</b>."), [{ type: "text", value: "Explain <b>this</b>." }]);
});

test("parses fenced pseudocode between prose and preserves indentation", () => {
  const prompt = "Consider this:\n```pseudocode\nIF Ready THEN\n  OUTPUT \"yes\"\nENDIF\n```\nExplain it.";
  assert.deepEqual(parsePseudocodePrompt(prompt), [
    { type: "text", value: "Consider this:" },
    { type: "pseudocode", value: "IF Ready THEN\n  OUTPUT \"yes\"\nENDIF" },
    { type: "text", value: "Explain it." },
  ]);
});

test("supports multiple blocks, including localized prompt strings", () => {
  const localized = "比较：\n```pseudocode\nDECLARE 值 : INTEGER\n```\n然后：\n```pseudocode\nOUTPUT 值\n```";
  assert.equal(parsePseudocodePrompt(localized).filter((part) => part.type === "pseudocode").length, 2);
});

test("an unclosed fence safely falls back to the complete plain prompt", () => {
  const prompt = "Trace this:\n```pseudocode\nOUTPUT 1";
  assert.deepEqual(parsePseudocodePrompt(prompt), [{ type: "text", value: prompt }]);
});
