import { CAMBRIDGE_PSEUDOCODE_KEYWORDS } from "../../lib/cambridge-pseudocode";

const tokenPattern = /(\/\/.*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|←|<>|>=|<=|[+\-*/&=<>]|\b\d+(?:\.\d+)?\b|\b[A-Za-z][A-Za-z0-9_]*\b)/g;
function tokenClass(token: string) {
  const upper = token.toUpperCase();
  if (token.startsWith("//")) return "text-slate-500";
  if (token.startsWith("\"") || token.startsWith("'")) return "text-emerald-700";
  if (/^\d/.test(token)) return "text-violet-700";
  if (/^(←|<>|>=|<=|[+\-*/&=<>])$/.test(token) || upper === "DIV" || upper === "MOD") return "text-rose-700";
  if (CAMBRIDGE_PSEUDOCODE_KEYWORDS.has(upper)) {
    if (["TRUE", "FALSE", "AND", "OR", "NOT"].includes(upper)) return "text-purple-700";
    if (["INTEGER", "REAL", "CHAR", "STRING", "BOOLEAN", "DATE", "ARRAY", "SET", "OF"].includes(upper)) return "text-teal-700";
    return "text-blue-800";
  }
  return "text-slate-950";
}
export function HighlightedPseudocode({ value }: { value: string }) {
  return <>{value.split("\n").map((line, lineIndex) => <span key={lineIndex} data-code-line className="block min-h-6">{line.length === 0 ? "\u00a0" : line.split(tokenPattern).filter(Boolean).map((part, index) => <span key={`${lineIndex}-${index}`} className={tokenClass(part)}>{part}</span>)}</span>)}</>;
}
