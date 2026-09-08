"use client";

import { useActionState } from "react";
import { changePasswordAction } from "./actions";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, { error: null });
  return (
    <form action={action} className="mt-8 space-y-5">
      <label className="block text-sm font-semibold text-slate-800">
        New password
        <input name="password" type="password" minLength={8} required autoComplete="new-password" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal" />
      </label>
      <label className="block text-sm font-semibold text-slate-800">
        Confirm new password
        <input name="confirmation" type="password" minLength={8} required autoComplete="new-password" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal" />
      </label>
      {state.error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{state.error}</p> : null}
      <button disabled={pending} className="w-full rounded-xl bg-teal-700 px-4 py-3 font-semibold text-white hover:bg-teal-800 disabled:opacity-60">
        {pending ? "Changing password…" : "Set permanent password"}
      </button>
    </form>
  );
}
