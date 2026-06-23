"use client";

import { useActionState } from "react";
import { createInitialAdmin, type FirstRunSetupState } from "./actions";

const initialState: FirstRunSetupState = { error: null };

export function FirstRunSetupForm() {
  const [state, formAction, isPending] = useActionState(createInitialAdmin, initialState);

  return (
    <form action={formAction} className="mt-8 grid gap-5 rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-sm">
      <label className="text-sm font-semibold text-slate-700">Admin display name
        <input name="displayName" required className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm" placeholder="e.g. Mark Sprietsma" />
      </label>
      <label className="text-sm font-semibold text-slate-700">Email / login identifier
        <input name="email" type="email" required className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm" placeholder="mark@example.com" />
      </label>
      <label className="text-sm font-semibold text-slate-700">Password
        <input name="password" type="password" required minLength={8} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm" placeholder="At least 8 characters" />
      </label>
      {state.error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{state.error}</p> : null}
      <button type="submit" disabled={isPending} className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400">{isPending ? "Creating admin…" : "Create initial admin"}</button>
    </form>
  );
}
