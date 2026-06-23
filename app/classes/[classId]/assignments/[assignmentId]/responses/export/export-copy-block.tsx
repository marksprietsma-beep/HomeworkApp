"use client";

import { useState } from "react";

type CopyStatus = "idle" | "success" | "error";

type ExportCopyBlockProps = {
  label: string;
  value: string;
  copyLabel: string;
  description?: string;
};

export function ExportCopyBlock({ label, value, copyLabel, description }: ExportCopyBlockProps) {
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");

  async function copyExport() {
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus("success");
    } catch {
      setCopyStatus("error");
    }
  }

  const statusMessage =
    copyStatus === "success"
      ? `${label} copied to clipboard.`
      : copyStatus === "error"
        ? `Could not copy ${label.toLowerCase()}. Select the text below and copy it manually.`
        : null;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
            {label}
          </p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">Copy-ready export</h2>
          <p className="mt-2 text-sm text-slate-600">
            {description ?? "Use the button to copy everything, or select the text below as a fallback."}
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <button
            type="button"
            onClick={copyExport}
            className="inline-flex rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-2"
          >
            {copyLabel}
          </button>
          {statusMessage ? (
            <p
              role="status"
              className={
                copyStatus === "success"
                  ? "text-sm font-medium text-emerald-700"
                  : "text-sm font-medium text-rose-700"
              }
            >
              {statusMessage}
            </p>
          ) : null}
        </div>
      </div>
      <textarea
        className="mt-5 h-[32rem] w-full rounded-2xl border border-slate-200 bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-50 shadow-inner outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
        readOnly
        spellCheck={false}
        value={value}
      />
    </section>
  );
}
