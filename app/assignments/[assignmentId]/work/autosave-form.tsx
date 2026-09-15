"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

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
  const revisionRef = useRef(0);
  const savedRevisionRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [draftConfirmation, setDraftConfirmation] = useState(false);

  const save = useCallback(async () => {
    const form = formRef.current;
    if (!enabled || !form || !dirtyRef.current) return;
    if (inFlightRef.current) { followUpRef.current = true; return; }
    inFlightRef.current = true;
    const revision = revisionRef.current;
    setSaveState("saving");
    try {
      const response = await fetch(`/api/assignments/${assignmentId}/autosave`, {
        method: "POST", body: new FormData(form), keepalive: true,
      });
      if (!response.ok) throw new Error("Autosave failed");
      savedRevisionRef.current = Math.max(savedRevisionRef.current, revision);
      dirtyRef.current = revisionRef.current > savedRevisionRef.current;
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

  const flushFinal = useCallback(async () => {
    const form = formRef.current;
    if (!enabled || !form || !dirtyRef.current) return;
    // Do not wait for a normal request: hand the latest snapshot to the server
    // immediately while the browser can still dispatch a keepalive request.
    const revision = revisionRef.current;
    try {
      const response = await fetch(`/api/assignments/${assignmentId}/autosave`, {
        method: "POST", body: new FormData(form), keepalive: true,
      });
      if (!response.ok) throw new Error("Final autosave failed");
      savedRevisionRef.current = Math.max(savedRevisionRef.current, revision);
      dirtyRef.current = revisionRef.current > savedRevisionRef.current;
      if (!dirtyRef.current) setSaveState("saved");
    } catch {
      dirtyRef.current = true;
      setSaveState("failed");
    }
  }, [assignmentId, enabled]);

  function markDirty() {
    if (!enabled) return;
    revisionRef.current += 1;
    dirtyRef.current = true;
    if (inFlightRef.current) followUpRef.current = true;
    setSaveState("dirty");
    setDraftConfirmation(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void save(), 1500);
  }

  async function saveDraft(event: FormEvent<HTMLFormElement>) {
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.value !== "DRAFT") {
      dirtyRef.current = false;
      return;
    }

    event.preventDefault();
    const form = formRef.current;
    if (!enabled || !form) return;
    if (timerRef.current) clearTimeout(timerRef.current);

    const revision = revisionRef.current;
    setSaveState("saving");
    setDraftConfirmation(false);
    try {
      const response = await fetch(`/api/assignments/${assignmentId}/autosave`, {
        method: "POST", body: new FormData(form), keepalive: true,
      });
      if (!response.ok) throw new Error("Draft save failed");
      savedRevisionRef.current = Math.max(savedRevisionRef.current, revision);
      dirtyRef.current = revisionRef.current > savedRevisionRef.current;
      setSaveState(dirtyRef.current ? "dirty" : "saved");
      setDraftConfirmation(true);
    } catch {
      dirtyRef.current = true;
      setSaveState("failed");
    }
  }

  useEffect(() => {
    if (!enabled) return;
    const flush = () => {
      if (document.visibilityState === "hidden" && dirtyRef.current) void flushFinal();
    };
    const pageHide = () => { if (dirtyRef.current) void flushFinal(); };
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
  }, [enabled, flushFinal]);

  const label = saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved just now" : saveState === "failed" ? "Autosave failed — keep this page open and use Save draft" : saveState === "dirty" ? "Unsaved changes" : "Autosave ready";
  const color = saveState === "failed" ? "text-red-700" : saveState === "saved" ? "text-emerald-700" : "text-slate-600";

  return <form ref={formRef} action={action} onInput={markDirty} onChange={markDirty} onSubmit={saveDraft} className="mt-6 grid gap-5">
    {children}
    <div className="sticky bottom-4 z-30 rounded-3xl border border-slate-200 bg-white p-4 shadow-lg">
      <div className="flex min-h-12 flex-col gap-3 sm:flex-row sm:items-center">
        {enabled ? <button type="submit" name="submissionIntent" value="DRAFT" className="w-full rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 sm:w-auto">Save draft</button> : null}
        <button type="submit" name="submissionIntent" value="SUBMITTED" className="w-full rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 sm:w-auto">Submit response</button>
        <p aria-live="polite" role="status" className={`min-h-5 text-sm font-medium sm:ml-auto ${color}`}>
          {draftConfirmation
            ? dirtyRef.current ? "Draft saved; newer changes are waiting to autosave" : "Draft saved"
            : enabled ? label : "Autosave is off for submitted work"}
        </p>
      </div>
    </div>
  </form>;
}
