"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "failed";

export function AutosaveForm({ assignmentId, enabled, action, children }: {
  assignmentId: number;
  enabled: boolean;
  action: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const dirtyRef = useRef(false);
  const inFlightRef = useRef(false);
  const followUpRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const save = useCallback(async () => {
    const form = formRef.current;
    if (!enabled || !form || !dirtyRef.current) return;
    if (inFlightRef.current) { followUpRef.current = true; return; }
    inFlightRef.current = true;
    dirtyRef.current = false;
    setSaveState("saving");
    try {
      const response = await fetch(`/api/assignments/${assignmentId}/autosave`, {
        method: "POST", body: new FormData(form), keepalive: true,
      });
      if (!response.ok) throw new Error("Autosave failed");
      setSaveState(dirtyRef.current ? "dirty" : "saved");
    } catch {
      dirtyRef.current = true;
      setSaveState("failed");
    } finally {
      inFlightRef.current = false;
      if (followUpRef.current) {
        followUpRef.current = false;
        void save();
      }
    }
  }, [assignmentId, enabled]);

  function markDirty() {
    if (!enabled) return;
    dirtyRef.current = true;
    if (inFlightRef.current) followUpRef.current = true;
    setSaveState("dirty");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void save(), 1500);
  }

  useEffect(() => {
    if (!enabled) return;
    const flush = () => {
      if (document.visibilityState === "hidden" && dirtyRef.current) void save();
    };
    const pageHide = () => { if (dirtyRef.current) void save(); };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", pageHide);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", pageHide);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [enabled, save]);

  const label = saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved just now" : saveState === "failed" ? "Autosave failed — keep this page open and use Save draft" : saveState === "dirty" ? "Unsaved changes" : "Autosave ready";
  const color = saveState === "failed" ? "text-red-700" : saveState === "saved" ? "text-emerald-700" : "text-slate-600";

  return <form ref={formRef} action={action} onInput={markDirty} onChange={markDirty} onSubmit={() => { dirtyRef.current = false; }} className="mt-6 grid gap-5">
    {children}
    <div className="sticky bottom-4 z-30 rounded-3xl border border-slate-200 bg-white p-4 shadow-lg">
      <div className="flex min-h-12 flex-col gap-3 sm:flex-row sm:items-center">
        {enabled ? <button type="submit" name="submissionIntent" value="DRAFT" className="w-full rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 sm:w-auto">Save draft</button> : null}
        <button type="submit" name="submissionIntent" value="SUBMITTED" className="w-full rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 sm:w-auto">Submit response</button>
        <p aria-live="polite" role="status" className={`min-h-5 text-sm font-medium sm:ml-auto ${color}`}>{enabled ? label : "Autosave is off for submitted work"}</p>
      </div>
    </div>
  </form>;
}
