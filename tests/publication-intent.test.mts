import assert from "node:assert/strict";
import test from "node:test";
import { parsePublicationIntent, PublicationIntent, statusForPublicationIntent } from "../lib/publication-intent.mjs";

test("only explicit draft and publish intents are accepted", () => {
  assert.equal(parsePublicationIntent("DRAFT"), PublicationIntent.DRAFT);
  assert.equal(parsePublicationIntent("PUBLISH"), PublicationIntent.PUBLISH);
  assert.equal(parsePublicationIntent("PUBLISHED"), null);
  assert.equal(parsePublicationIntent("RELEASED"), null);
  assert.equal(parsePublicationIntent(null), null);
});

test("teacher intent is authoritative over imported assignment status", () => {
  for (const importedStatus of ["DRAFT", "PUBLISHED"]) {
    assert.equal(statusForPublicationIntent(PublicationIntent.DRAFT), "DRAFT", importedStatus);
    assert.equal(statusForPublicationIntent(PublicationIntent.PUBLISH), "PUBLISHED", importedStatus);
  }
});
