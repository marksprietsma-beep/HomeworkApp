export const CAMBRIDGE_9618_2026 = "CAMBRIDGE_9618_2026" as const;
export type PseudocodeDialect = typeof CAMBRIDGE_9618_2026;

export type PseudocodeLintHint = { line: number; message: string };

const KEYWORDS = [
  "DECLARE", "CONSTANT", "TYPE", "DEFINE", "INTEGER", "REAL", "CHAR", "STRING", "BOOLEAN", "DATE", "ARRAY", "SET", "OF",
  "IF", "THEN", "ELSE", "ENDIF", "CASE", "OTHERWISE", "ENDCASE",
  "FOR", "TO", "STEP", "NEXT", "REPEAT", "UNTIL", "WHILE", "ENDWHILE",
  "PROCEDURE", "ENDPROCEDURE", "FUNCTION", "RETURNS", "RETURN", "ENDFUNCTION", "CALL", "BYVAL", "BYREF",
  "OPENFILE", "READFILE", "WRITEFILE", "CLOSEFILE", "EOF", "READ", "WRITE", "APPEND", "RANDOM", "SEEK", "GETRECORD", "PUTRECORD",
  "CLASS", "ENDCLASS", "PUBLIC", "PRIVATE", "NEW", "INHERITS", "SUPER",
  "TRUE", "FALSE", "AND", "OR", "NOT", "DIV", "MOD",
];

export const CAMBRIDGE_PSEUDOCODE_KEYWORDS = new Set(KEYWORDS);
const lowerKeywordRegex = new RegExp(`\\b(${KEYWORDS.join("|")})\\b`, "gi");
const ident = "[A-Za-z][A-Za-z0-9_]*";
const typePattern = "(?:INTEGER|REAL|CHAR|STRING|BOOLEAN|DATE|ARRAY\\s*\\[[^\\]]+\\]\\s+OF\\s+(?:INTEGER|REAL|CHAR|STRING|BOOLEAN|DATE)|SET\\s+OF\\s+(?:INTEGER|REAL|CHAR|STRING|BOOLEAN|DATE))";

function stripStringsAndComments(line: string) {
  const withoutComment = line.split("//")[0] ?? "";
  return withoutComment.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, "");
}

function pushBlockHints(hints: PseudocodeLintHint[], stack: { keyword: string; line: number; expected: string }[]) {
  for (const block of stack) hints.push({ line: block.line, message: `${block.keyword} should close with ${block.expected}.` });
}

export function lintCambridgePseudocode(value: string): PseudocodeLintHint[] {
  const hints: PseudocodeLintHint[] = [];
  const stack: { keyword: string; line: number; expected: string }[] = [];
  const functionStack: { line: number; hasReturn: boolean; header: string }[] = [];

  value.split("\n").forEach((rawLine, index) => {
    const lineNo = index + 1;
    const code = stripStringsAndComments(rawLine).trim();
    if (!code) return;
    const upper = code.toUpperCase();

    for (const match of code.matchAll(lowerKeywordRegex)) {
      if (match[0] !== match[0].toUpperCase()) hints.push({ line: lineNo, message: `Use uppercase keyword ${match[0].toUpperCase()}.` });
    }

    const declaration = code.match(/^DECLARE\s+([^:]+?)\s*:\s*(.+)$/i);
    if (/^DECLARE\b/i.test(code) && !declaration) hints.push({ line: lineNo, message: "DECLARE should broadly follow DECLARE identifier : data type." });
    if (declaration) {
      const name = declaration[1].trim();
      const dtype = declaration[2].trim().toUpperCase();
      if (!new RegExp(`^${ident}$`).test(name)) hints.push({ line: lineNo, message: "Identifiers should start with a letter and contain only letters, digits and underscore." });
      if (/^ARRAY\b/.test(dtype) && !new RegExp(`^ARRAY\\s*\\[\\s*[^:\],]+\\s*:\\s*[^\\],]+(?:\\s*,\\s*[^:\],]+\\s*:\\s*[^\\],]+)?\\s*\\]\\s+OF\\s+${typePattern.replace(/^\(\?:|\)$/g, "")}$`).test(dtype)) {
        hints.push({ line: lineNo, message: "Array declarations should use ARRAY[lower:upper] OF data type, with an optional second dimension." });
      }
    }

    if (/^[A-Za-z][A-Za-z0-9_]*\s*=\s*[^=]/.test(code)) hints.push({ line: lineNo, message: "Assignment should use ← rather than =." });
    if (/\bBY(?:REF|VAL)\b/i.test(code) && !/^(PROCEDURE|FUNCTION)\b/i.test(code)) hints.push({ line: lineNo, message: "BYREF/BYVAL should only appear in parameter definitions." });
    if (/^FUNCTION\b/i.test(code) && /\bBYREF\b/i.test(code)) hints.push({ line: lineNo, message: "BYREF should not be used for function parameters." });

    if (/^RETURN\b/i.test(code) && functionStack.length) functionStack[functionStack.length - 1].hasReturn = true;

    const close = (expected: string) => {
      const block = stack.pop();
      if (!block || block.expected !== expected) hints.push({ line: lineNo, message: `${expected} does not match an open block.` });
    };

    if (/^ENDIF\b/.test(upper)) close("ENDIF");
    else if (/^ENDCASE\b/.test(upper)) close("ENDCASE");
    else if (/^NEXT\b/.test(upper)) close("NEXT");
    else if (/^UNTIL\b/.test(upper)) close("UNTIL");
    else if (/^ENDWHILE\b/.test(upper)) close("ENDWHILE");
    else if (/^ENDPROCEDURE\b/.test(upper)) close("ENDPROCEDURE");
    else if (/^ENDFUNCTION\b/.test(upper)) { close("ENDFUNCTION"); const fn = functionStack.pop(); if (fn && !fn.hasReturn) hints.push({ line: fn.line, message: "FUNCTION should usually contain RETURN." }); }
    else if (/^ENDCLASS\b/.test(upper)) close("ENDCLASS");

    if (/^IF\b/.test(upper) && /\bTHEN\b/.test(upper)) stack.push({ keyword: "IF", line: lineNo, expected: "ENDIF" });
    else if (/^CASE\b/.test(upper) && /\bOF\b/.test(upper)) stack.push({ keyword: "CASE OF", line: lineNo, expected: "ENDCASE" });
    else if (/^FOR\b/.test(upper)) stack.push({ keyword: "FOR", line: lineNo, expected: "NEXT" });
    else if (/^REPEAT\b/.test(upper)) stack.push({ keyword: "REPEAT", line: lineNo, expected: "UNTIL" });
    else if (/^WHILE\b/.test(upper)) stack.push({ keyword: "WHILE", line: lineNo, expected: "ENDWHILE" });
    else if (/^PROCEDURE\b/.test(upper)) stack.push({ keyword: "PROCEDURE", line: lineNo, expected: "ENDPROCEDURE" });
    else if (/^FUNCTION\b/.test(upper)) { stack.push({ keyword: "FUNCTION", line: lineNo, expected: "ENDFUNCTION" }); functionStack.push({ line: lineNo, hasReturn: false, header: code }); if (!/\bRETURNS\b/.test(upper)) hints.push({ line: lineNo, message: "FUNCTION definitions should include RETURNS." }); }
    else if (/^CLASS\b/.test(upper)) stack.push({ keyword: "CLASS", line: lineNo, expected: "ENDCLASS" });
  });

  pushBlockHints(hints, stack);
  return hints.slice(0, 12);
}

export function formatCambridgePseudocode(value: string) {
  let indent = 0;
  return value.replace(/<-/g, "←").replace(/\t/g, "  ").split("\n").map((line) => {
    const trimmed = line.trim();
    const upper = trimmed.toUpperCase();
    if (/^(ENDIF|ENDCASE|NEXT\b|UNTIL\b|ENDWHILE|ENDPROCEDURE|ENDFUNCTION|ENDCLASS|ELSE\b|OTHERWISE\b)/.test(upper)) indent = Math.max(0, indent - 1);
    const out = trimmed ? `${"  ".repeat(indent)}${trimmed}` : "";
    if (/^(IF\b.*\bTHEN\b|CASE\b.*\bOF\b|FOR\b|REPEAT\b|WHILE\b|PROCEDURE\b|FUNCTION\b|CLASS\b|ELSE\b|OTHERWISE\b)/.test(upper) && !/^END/.test(upper)) indent += 1;
    return out;
  }).join("\n");
}
