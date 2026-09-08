"use client";

import { useActionState } from "react";
import { enrollStudentByEmail, initialStudentRosterActionState, removeStudentEnrollment } from "./actions";

function Result({ state }: { state: typeof initialStudentRosterActionState }) {
  if (!state.error && !state.success) return null;
  return <p role="status" className={`mt-3 text-sm font-medium ${state.error ? "text-red-700" : "text-emerald-700"}`}>{state.error ?? state.success}</p>;
}

export function EnrollStudentForm({ classes }: { classes: { id: number; name: string }[] }) {
  const [state, action, pending] = useActionState(enrollStudentByEmail, initialStudentRosterActionState);
  return (
    <form action={action} className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
      <label className="text-sm font-semibold text-slate-700">School email
        <input type="email" name="email" required placeholder="student@school.example" className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm" />
      </label>
      <label className="text-sm font-semibold text-slate-700">Class
        <select name="classId" required className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm">
          <option value="">Choose a class</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <button disabled={pending || classes.length === 0} className="rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white disabled:bg-slate-400">{pending ? "Enrolling…" : "Enrol student"}</button>
      <div className="md:col-span-3"><Result state={state} /></div>
    </form>
  );
}

export function RemoveEnrollmentForm({ classId, studentId, className }: { classId: number; studentId: number; className: string }) {
  const [state, action, pending] = useActionState(removeStudentEnrollment, initialStudentRosterActionState);
  return (
    <form action={action} className="flex flex-col items-end">
      <input type="hidden" name="classId" value={classId} /><input type="hidden" name="studentId" value={studentId} />
      <button disabled={pending} aria-label={`Remove from ${className}`} className="text-xs font-semibold text-red-700 underline decoration-red-200 underline-offset-4 hover:text-red-900 disabled:text-slate-400">{pending ? "Removing…" : "Remove"}</button>
      <Result state={state} />
    </form>
  );
}
