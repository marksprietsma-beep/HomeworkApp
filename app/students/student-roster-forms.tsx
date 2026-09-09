"use client";

import { useActionState } from "react";
import { enrollStudentByEmail, initialPasswordResetActionState, initialStudentRosterActionState, removeStudentEnrollment, resetStudentPassword } from "./actions";

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

export function ResetStudentPasswordForm({ studentId, studentName }: { studentId: number; studentName: string }) {
  const [state, action, pending] = useActionState(resetStudentPassword, initialPasswordResetActionState);
  return (
    <div className="mt-4 border-t border-slate-200 pt-4">
      <form
        action={action}
        onSubmit={(event) => {
          if (!window.confirm(`Reset ${studentName}'s password? Their current sessions will end immediately.`)) event.preventDefault();
        }}
        className="flex flex-wrap items-center gap-3"
      >
        <input type="hidden" name="studentId" value={studentId} />
        <input type="hidden" name="confirmation" value="RESET_PASSWORD" />
        <button disabled={pending} className="rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-bold text-red-800 hover:bg-red-50 disabled:text-slate-400">
          {pending ? "Resetting…" : "Reset password"}
        </button>
        <span className="text-xs text-slate-500">Ends existing sessions and requires a password change.</span>
      </form>
      {state.error ? <p role="alert" className="mt-3 text-sm font-medium text-red-700">{state.error}</p> : null}
      {state.temporaryPassword ? (
        <div role="status" className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-bold">Copy this temporary password now. It will not be shown again.</p>
          <code className="mt-2 block break-all rounded-lg bg-white px-3 py-2 text-base font-bold ring-1 ring-amber-200">{state.temporaryPassword}</code>
          <p className="mt-2">Give it securely to {state.studentName}. It is not stored as plaintext.</p>
        </div>
      ) : null}
    </div>
  );
}
