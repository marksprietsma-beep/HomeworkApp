"use client";

import { TextSizePreference, ThemePreference } from "@prisma/client";
import { useActionState } from "react";
import { initialAppearanceActionState, updateOwnAppearance } from "./actions";

const themes = [
  { value: ThemePreference.LIGHT, label: "Light", description: "Always use Clarion's light appearance." },
  { value: ThemePreference.DARK, label: "Dark", description: "Always use Clarion's dark appearance." },
  { value: ThemePreference.SYSTEM, label: "System / device", description: "Follow this device's light or dark preference." },
];

const textSizes = [
  { value: TextSizePreference.STANDARD, label: "Standard", description: "Use Clarion's regular text size." },
  { value: TextSizePreference.LARGE, label: "Large", description: "Increase reading and interface text throughout Clarion." },
];

export function AppearanceForm({ themePreference, textSizePreference }: { themePreference: ThemePreference; textSizePreference: TextSizePreference }) {
  const [state, formAction, pending] = useActionState(updateOwnAppearance, initialAppearanceActionState);
  return (
    <form action={formAction} className="mt-6 grid gap-7">
      <fieldset>
        <legend className="text-base font-bold text-slate-950">Theme</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {themes.map((option) => <label key={option.value} className="cursor-pointer rounded-2xl border border-slate-300 bg-slate-50 p-4 has-[:checked]:border-cyan-400 has-[:checked]:ring-2 has-[:checked]:ring-cyan-100"><span className="flex items-center gap-2 font-semibold text-slate-950"><input type="radio" name="themePreference" value={option.value} defaultChecked={themePreference === option.value} className="h-4 w-4 accent-cyan-700" />{option.label}</span><span className="mt-2 block text-sm leading-5 text-slate-600">{option.description}</span></label>)}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-base font-bold text-slate-950">Text size</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {textSizes.map((option) => <label key={option.value} className="cursor-pointer rounded-2xl border border-slate-300 bg-slate-50 p-4 has-[:checked]:border-cyan-400 has-[:checked]:ring-2 has-[:checked]:ring-cyan-100"><span className="flex items-center gap-2 font-semibold text-slate-950"><input type="radio" name="textSizePreference" value={option.value} defaultChecked={textSizePreference === option.value} className="h-4 w-4 accent-cyan-700" />{option.label}</span><span className="mt-2 block text-sm leading-5 text-slate-600">{option.description}</span></label>)}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400">{pending ? "Saving…" : "Save appearance"}</button>
        <p aria-live="polite" className={`text-sm font-semibold ${state.error ? "text-red-700" : "text-emerald-700"}`}>{state.error ?? state.success}</p>
      </div>
    </form>
  );
}
