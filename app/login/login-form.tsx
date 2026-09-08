"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

export function LoginForm() {
  const [state, action, pending] = useActionState(login, initialState);
  return (
    <form action={action} className="mt-8 space-y-5">
      <label className="block text-sm font-semibold text-slate-700">Email
        <input name="email" type="email" autoComplete="username" required className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-950" />
      </label>
      <label className="block text-sm font-semibold text-slate-700">Password
        <input name="password" type="password" autoComplete="current-password" required className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-950" />
      </label>
      {state.error ? <p role="alert" className="text-sm text-red-700">{state.error}</p> : null}
      <button disabled={pending} className="w-full rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white disabled:opacity-60">{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
