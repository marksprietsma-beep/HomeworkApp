"use client";

import { useActionState } from "react";
import { sendHomeworkReminders } from "./actions";

export function ReminderForm({ runKey, students, assignments }: { runKey: string; students: number; assignments: number }) {
  const [state, action, pending] = useActionState(sendHomeworkReminders, null);
  return <form action={action} onSubmit={(event) => { if (!window.confirm(`This will email ${students} students about ${assignments} unfinished assignments. Continue?`)) event.preventDefault(); }}>
    <input type="hidden" name="runKey" value={runKey} />
    <button disabled={pending || students === 0} className="rounded-full bg-amber-500 px-6 py-3 font-bold text-slate-950 shadow-sm disabled:cursor-not-allowed disabled:opacity-50">{pending ? "Queueing reminders…" : "Send homework reminders"}</button>
    <p className="mt-3 text-sm text-slate-600">One consolidated email will be queued per student. The button is disabled while processing, and retrying this preview cannot create duplicates.</p>
    {state ? <p className={`mt-4 rounded-xl p-3 text-sm ${state.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{state.message}</p> : null}
  </form>;
}
