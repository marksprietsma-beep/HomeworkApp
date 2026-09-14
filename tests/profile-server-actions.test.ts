import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

test("profile Server Action module only exposes callable runtime exports", async () => {
  const path = "app/profile/actions.ts";
  const source = ts.createSourceFile(path, await readFile(path, "utf8"), ts.ScriptTarget.Latest, true);
  const runtimeExports = source.statements.filter((statement) => {
    const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
    const exported = modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
    const typeOnly = ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement);
    return exported && !typeOnly;
  });

  assert.ok(runtimeExports.length > 0);
  for (const exported of runtimeExports) {
    assert.ok(ts.isFunctionDeclaration(exported), `Only functions may be exported from ${path}`);
    const modifiers = ts.canHaveModifiers(exported) ? ts.getModifiers(exported) : undefined;
    assert.ok(modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword), `Server Action ${exported.name?.text} must be async`);
  }
});
