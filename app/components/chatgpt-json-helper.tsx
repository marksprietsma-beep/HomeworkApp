"use client";

import { useState } from "react";

type CopyStatus = "idle" | "success" | "error";

type ChatGptJsonHelperProps = {
  title: string;
  eyebrow?: string;
  description: string;
  prompt: string;
  docsHref?: string;
  docsLabel?: string;
};

export function ChatGptJsonHelper({
  title,
  eyebrow = "ChatGPT helper",
  description,
  prompt,
  docsHref,
  docsLabel = "Read JSON docs",
}: ChatGptJsonHelperProps) {
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopyStatus("success");
    } catch {
      setCopyStatus("error");
    }
  }

  const statusMessage =
    copyStatus === "success"
      ? "Prompt copied to clipboard."
      : copyStatus === "error"
        ? "Could not copy the prompt. Select the text and copy it manually."
        : null;

  return (
    <details className="mt-5 rounded-2xl border border-dashed border-amber-300 bg-amber-50/70 p-4 text-sm text-slate-700 open:border-amber-400 open:bg-amber-50">
      <summary className="cursor-pointer list-none">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">
              {eyebrow}
            </p>
            <h3 className="mt-1 font-bold text-slate-950">{title}</h3>
            <p className="mt-1 leading-6 text-slate-600">{description}</p>
          </div>
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-amber-800">
            Open helper
          </span>
        </div>
      </summary>

      <div className="mt-4 border-t border-amber-200 pt-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-slate-900">
            Copy this prompt into ChatGPT, then paste the JSON result here.
          </p>
          <button
            type="button"
            onClick={copyPrompt}
            className="inline-flex rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-2"
          >
            Copy prompt
          </button>
        </div>
        {statusMessage ? (
          <p
            role="status"
            className={
              copyStatus === "success"
                ? "mt-3 font-medium text-emerald-700"
                : "mt-3 font-medium text-rose-700"
            }
          >
            {statusMessage}
          </p>
        ) : null}
        <textarea
          className="mt-4 h-80 w-full rounded-2xl border border-amber-200 bg-white p-4 font-mono text-xs leading-6 text-slate-900 shadow-inner outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
          readOnly
          spellCheck={false}
          value={prompt}
        />
        {docsHref ? (
          <a
            className="mt-3 inline-flex text-sm font-semibold text-amber-800 underline-offset-4 hover:underline"
            href={docsHref}
          >
            {docsLabel}
          </a>
        ) : null}
      </div>
    </details>
  );
}
