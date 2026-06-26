"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import { CAMBRIDGE_PSEUDOCODE_KEYWORDS, formatCambridgePseudocode, lintCambridgePseudocode } from "../../../../lib/cambridge-pseudocode";

type PseudocodeAnswerEditorProps = {
  id: string;
  name: string;
  defaultValue: string;
  dialect?: string | null;
};

const tokenPattern = /(\/\/.*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|←|<>|>=|<=|[+\-*/&=<>]|\b\d+(?:\.\d+)?\b|\b[A-Za-z][A-Za-z0-9_]*\b)/g;

function tokenClass(token: string) {
  const upper = token.toUpperCase();
  if (token.startsWith("//")) return "text-slate-500 italic";
  if (token.startsWith("\"") || token.startsWith("'")) return "text-emerald-700";
  if (/^\d/.test(token)) return "text-violet-700";
  if (/^(←|<>|>=|<=|[+\-*/&=<>])$/.test(token) || upper === "DIV" || upper === "MOD") return "font-semibold text-rose-700";
  if (CAMBRIDGE_PSEUDOCODE_KEYWORDS.has(upper)) {
    if (["TRUE", "FALSE", "AND", "OR", "NOT"].includes(upper)) return "font-semibold text-purple-700";
    if (["INTEGER", "REAL", "CHAR", "STRING", "BOOLEAN", "DATE", "ARRAY", "SET", "OF"].includes(upper)) return "font-semibold text-teal-700";
    return "font-semibold text-blue-800";
  }
  return "text-slate-950";
}

function HighlightedPseudocode({ value }: { value: string }) {
  const lines = value.split("\n");
  return (
    <>
      {lines.map((line, lineIndex) => (
        <Fragment key={lineIndex}>
          <span className="select-none pr-4 text-right text-slate-400">{String(lineIndex + 1).padStart(2, " ")}</span>
          <span>
            {line.length === 0 ? "\u00a0" : line.split(tokenPattern).filter(Boolean).map((part, index) => <span key={`${lineIndex}-${index}`} className={tokenClass(part)}>{part}</span>)}
          </span>
          {lineIndex < lines.length - 1 ? "\n" : null}
        </Fragment>
      ))}
    </>
  );
}

export function PseudocodeAnswerEditor({ id, name, defaultValue, dialect }: PseudocodeAnswerEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(defaultValue);
  const hints = useMemo(() => lintCambridgePseudocode(value), [value]);

  function dispatchInput(textarea: HTMLTextAreaElement) {
    setValue(textarea.value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Tab") return;
    event.preventDefault();
    const textarea = event.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = textarea.value;

    if (start !== end) {
      const lineStart = current.lastIndexOf("\n", start - 1) + 1;
      const selectedText = current.slice(lineStart, end);
      const adjusted = selectedText.split("\n").map((line) => {
        if (!event.shiftKey) return `  ${line}`;
        if (line.startsWith("  ")) return line.slice(2);
        if (line.startsWith("\t")) return line.slice(1);
        return line;
      }).join("\n");
      textarea.value = `${current.slice(0, lineStart)}${adjusted}${current.slice(end)}`;
      textarea.selectionStart = lineStart;
      textarea.selectionEnd = end + adjusted.length - selectedText.length;
      dispatchInput(textarea);
      return;
    }

    if (event.shiftKey) {
      const lineStart = current.lastIndexOf("\n", start - 1) + 1;
      const removableIndent = current.slice(lineStart, start).match(/(?:  |\t)$/)?.[0];
      if (!removableIndent) return;
      const removalStart = start - removableIndent.length;
      textarea.value = `${current.slice(0, removalStart)}${current.slice(start)}`;
      textarea.selectionStart = removalStart;
      textarea.selectionEnd = removalStart;
      dispatchInput(textarea);
      return;
    }

    textarea.value = `${current.slice(0, start)}  ${current.slice(end)}`;
    textarea.selectionStart = start + 2;
    textarea.selectionEnd = start + 2;
    dispatchInput(textarea);
  }

  function handleFormat() {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.value = formatCambridgePseudocode(textarea.value);
    dispatchInput(textarea);
  }

  return (
    <div className="mt-5 grid gap-3">
      <div className="flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-medium">Cambridge 9618 pseudocode mode preserves spacing, highlights exam keywords and shows non-blocking syntax hints{dialect ? ` (${dialect})` : ""}.</p>
        <button type="button" onClick={handleFormat} className="rounded-full border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-amber-950 shadow-sm transition hover:border-amber-400 hover:bg-amber-100">Format pseudocode</button>
      </div>
      <div className="relative min-h-80 overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-200">
        <pre aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-auto px-4 py-3 font-mono text-sm leading-6 tabular-nums whitespace-pre-wrap"><HighlightedPseudocode value={value || " "} /></pre>
        <textarea ref={textareaRef} id={id} name={name} defaultValue={defaultValue} rows={12} spellCheck={false} onKeyDown={handleKeyDown} onChange={(event) => setValue(event.currentTarget.value)} className="relative z-10 min-h-80 w-full resize-y bg-transparent px-4 py-3 pl-4 font-mono text-sm leading-6 text-transparent caret-slate-950 outline-none selection:bg-amber-200/70 tabular-nums whitespace-pre-wrap" placeholder={"Write pseudocode here...\nUse Tab to indent."} />
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
        <p className="font-bold text-slate-950">Syntax hints (guidance only)</p>
        {hints.length === 0 ? <p className="mt-1 text-slate-600">No Cambridge 9618 syntax hints for this draft.</p> : <ul className="mt-2 grid gap-1 text-amber-950">{hints.map((hint, index) => <li key={`${hint.line}-${index}`}>Line {hint.line}: {hint.message}</li>)}</ul>}
      </div>
    </div>
  );
}
