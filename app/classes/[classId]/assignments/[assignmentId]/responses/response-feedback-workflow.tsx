"use client";

import { useState } from "react";
import type { FeedbackLanguageMode } from "../../../../../../lib/feedback-helper-prompt";
import { FeedbackImportForm } from "../feedback/import/feedback-import-form";

type Props = {
  classId: number;
  assignmentId: number;
  feedbackPrompts: {
    english: string;
    bilingual: string;
    defaultMode: FeedbackLanguageMode;
  };
  importContext: Record<string, unknown>;
  existingImportCount: number;
};

type CopyStatus = "idle" | "success" | "error";

export function ResponseFeedbackWorkflow({
  classId,
  assignmentId,
  feedbackPrompts,
  importContext,
  existingImportCount,
}: Props) {
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const [feedbackLanguageMode, setFeedbackLanguageMode] = useState<FeedbackLanguageMode>(feedbackPrompts.defaultMode);
  const [importOpen, setImportOpen] = useState(false);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(feedbackPrompts[feedbackLanguageMode]);
      setCopyStatus("success");
    } catch {
      setCopyStatus("error");
    }
  }

  return (
    <section id="feedback-workflow" className="mt-8 scroll-mt-8 rounded-3xl border border-amber-200 bg-amber-50/80 p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">
            Feedback workflow
          </p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">
            Generate, import, review, and release feedback
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            Copy the complete ChatGPT-ready prompt, paste the returned JSON back
            into Clarion here, then review draft feedback before releasing it to
            students. No data is sent to ChatGPT automatically.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
          <fieldset className="rounded-2xl border border-amber-200 bg-white/80 p-3">
            <legend className="px-1 text-xs font-bold uppercase tracking-[0.16em] text-amber-800">
              Feedback language
            </legend>
            <div className="mt-2 grid gap-2 text-sm font-semibold text-slate-800">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="feedback-language-mode"
                  value="english"
                  checked={feedbackLanguageMode === "english"}
                  onChange={() => setFeedbackLanguageMode("english")}
                  className="h-4 w-4 accent-slate-950"
                />
                English only
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="feedback-language-mode"
                  value="bilingual"
                  checked={feedbackLanguageMode === "bilingual"}
                  onChange={() => setFeedbackLanguageMode("bilingual")}
                  className="h-4 w-4 accent-slate-950"
                />
                Bilingual English + 中文
              </label>
            </div>
          </fieldset>
          <button
            type="button"
            onClick={copyPrompt}
            className="rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-2"
          >
            Copy feedback prompt
          </button>
          <button
            type="button"
            onClick={() => setImportOpen((open) => !open)}
            className="rounded-full border border-amber-300 bg-white px-5 py-3 text-sm font-semibold text-amber-950 shadow-sm transition hover:border-amber-400"
            aria-expanded={importOpen}
          >
            {importOpen ? "Hide feedback JSON import" : "Paste/import feedback JSON"}
          </button>
        </div>
      </div>

      {copyStatus !== "idle" ? (
        <p
          role="status"
          className={`mt-4 rounded-2xl border p-3 text-sm font-semibold ${copyStatus === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"}`}
        >
          {copyStatus === "success"
            ? `Feedback prompt copied (${feedbackLanguageMode === "bilingual" ? "bilingual English + 中文" : "English only"}). Paste it into ChatGPT, then return here with the JSON.`
            : "Could not copy automatically. Open the manual prompt below, select all, and copy it into ChatGPT."}
        </p>
      ) : null}

      <details className="mt-5 rounded-2xl border border-amber-200 bg-white/80 p-4 text-sm leading-6 text-amber-950">
        <summary className="cursor-pointer font-bold text-slate-950">Manual prompt copy fallback</summary>
        <p className="mt-2 text-slate-700">If clipboard copy is unavailable, select and copy this complete prompt for the selected language mode.</p>
        <textarea
          readOnly
          value={feedbackPrompts[feedbackLanguageMode]}
          className="mt-3 min-h-72 w-full rounded-2xl border border-amber-200 bg-white p-3 font-mono text-xs text-slate-900 shadow-inner"
          aria-label="Complete feedback prompt"
        />
      </details>

      <div className="mt-5 rounded-2xl border border-amber-200 bg-white/80 p-4 text-sm leading-6 text-amber-950">
        Paste the JSON returned by ChatGPT. IDs must be preserved. Review feedback before release.
      </div>

      {importOpen ? (
        <div className="mt-6 border-t border-amber-200 pt-6">
          <FeedbackImportForm
            classId={classId}
            assignmentId={assignmentId}
            context={importContext}
            existingImportCount={existingImportCount}
            compact
          />
        </div>
      ) : null}
    </section>
  );
}
