"use client";

import { useRef } from "react";

type PseudocodeAnswerEditorProps = {
  id: string;
  name: string;
  defaultValue: string;
};

function formatPseudocode(value: string) {
  const lines = value.replace(/\t/g, "  ").split("\n");
  let indentLevel = 0;

  return lines
    .map((line) => {
      const trimmed = line.trim();
      const upper = trimmed.toUpperCase();

      if (/^(END|ENDIF|END IF|NEXT|UNTIL|ELSE|ELSEIF|ELSE IF)\b/.test(upper)) {
        indentLevel = Math.max(0, indentLevel - 1);
      }

      const formattedLine = trimmed.length === 0 ? "" : `${"  ".repeat(indentLevel)}${trimmed}`;

      if (/\b(THEN|DO)$/.test(upper) || /^(IF|FOR|WHILE|REPEAT|CASE|FUNCTION|PROCEDURE|RECORD|TYPE)\b/.test(upper)) {
        if (!/^(END|ENDIF|END IF)\b/.test(upper)) {
          indentLevel += 1;
        }
      }

      if (/^(ELSE|ELSEIF|ELSE IF)\b/.test(upper)) {
        indentLevel += 1;
      }

      return formattedLine;
    })
    .join("\n");
}

export function PseudocodeAnswerEditor({ id, name, defaultValue }: PseudocodeAnswerEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Tab") {
      return;
    }

    event.preventDefault();
    const textarea = event.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;

    if (start !== end) {
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const selectedText = value.slice(lineStart, end);
      const selectedLines = selectedText.split("\n");
      const adjustedLines = selectedLines.map((line) => {
        if (!event.shiftKey) {
          return `  ${line}`;
        }

        if (line.startsWith("  ")) {
          return line.slice(2);
        }

        if (line.startsWith("\t")) {
          return line.slice(1);
        }

        return line;
      });
      const nextSelectedText = adjustedLines.join("\n");
      const nextValue = `${value.slice(0, lineStart)}${nextSelectedText}${value.slice(end)}`;
      const selectionDelta = nextSelectedText.length - selectedText.length;

      textarea.value = nextValue;
      textarea.selectionStart = lineStart;
      textarea.selectionEnd = end + selectionDelta;
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }

    if (event.shiftKey) {
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const beforeCursor = value.slice(lineStart, start);
      const removableIndent = beforeCursor.match(/(?:  |\t)$/)?.[0];

      if (!removableIndent) {
        return;
      }

      const removalStart = start - removableIndent.length;
      const nextValue = `${value.slice(0, removalStart)}${value.slice(start)}`;

      textarea.value = nextValue;
      textarea.selectionStart = removalStart;
      textarea.selectionEnd = removalStart;
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }

    const nextValue = `${value.slice(0, start)}  ${value.slice(end)}`;

    textarea.value = nextValue;
    textarea.selectionStart = start + 2;
    textarea.selectionEnd = start + 2;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function handleFormat() {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.value = formatPseudocode(textarea.value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }

  return (
    <div className="mt-5 grid gap-3">
      <div className="flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-medium">Pseudocode mode preserves spacing and uses a larger monospace editor.</p>
        <button
          type="button"
          onClick={handleFormat}
          className="rounded-full border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-amber-950 shadow-sm transition hover:border-amber-400 hover:bg-amber-100"
        >
          Format pseudocode
        </button>
      </div>
      <textarea
        ref={textareaRef}
        id={id}
        name={name}
        defaultValue={defaultValue}
        rows={12}
        spellCheck={false}
        onKeyDown={handleKeyDown}
        className="min-h-80 w-full whitespace-pre-wrap rounded-2xl border border-slate-300 bg-white px-4 py-3 font-mono text-sm leading-6 text-slate-950 shadow-sm tabular-nums focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
        placeholder={"Write pseudocode here...\nUse Tab to indent."}
      />
    </div>
  );
}
