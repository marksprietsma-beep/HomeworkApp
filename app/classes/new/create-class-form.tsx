"use client";

import { useActionState } from "react";
import { createClassForSelectedTeacher, type CreateClassFormState } from "./actions";

export function CreateClassForm() {
  const initialState: CreateClassFormState = { error: null };
  const [formState, formAction, isPending] = useActionState(
    createClassForSelectedTeacher,
    initialState,
  );

  return (
    <form action={formAction} className="mt-6 grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700">
          Class name
          <input
            name="name"
            required
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
            placeholder="e.g. Year 8 Maths"
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Subject
          <input
            name="subject"
            required
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
            placeholder="e.g. Maths"
          />
        </label>
      </div>

      <label className="text-sm font-semibold text-slate-700">
        Description / notes (optional)
        <textarea
          name="description"
          rows={4}
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
          placeholder="Short notes to help identify this class locally."
        />
      </label>

      {formState.error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {formState.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400 sm:justify-self-start"
      >
        {isPending ? "Creating class…" : "Create class"}
      </button>
    </form>
  );
}
