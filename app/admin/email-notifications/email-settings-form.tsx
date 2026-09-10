"use client";

import { useActionState, useMemo, useState } from "react";
import { saveEmailSettings, sendTestEmail, type EmailAdminState } from "./actions";

type Settings = { homeworkEnabled: boolean; feedbackEnabled: boolean; homeworkSubjectTemplate: string; homeworkBodyTemplate: string; feedbackSubjectTemplate: string; feedbackBodyTemplate: string };
const sample: Record<string, string> = { studentName: "Alex Student", className: "Year 9 Mathematics", assignmentTitle: "Fractions review", dueDate: "Due: 18 September 2026, 16:00 UTC", clarionLink: "https://clarion.school.example/assignments/123/work" };
function preview(value: string) { return value.replace(/{{\s*([^{}]+?)\s*}}/g, (_, key) => sample[key] ?? `{{${key}}}`).replace(/^\s*\n/gm, "\n"); }
function Message({ state }: { state: EmailAdminState }) { return state ? <p className={`mt-3 rounded-xl p-3 text-sm ${state.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{state.message}</p> : null; }

export function EmailSettingsForm({ settings }: { settings: Settings }) {
  const [state, action, pending] = useActionState(saveEmailSettings, null);
  const [values, setValues] = useState(settings);
  const previews = useMemo(() => ({ homework: preview(`${values.homeworkSubjectTemplate}\n\n${values.homeworkBodyTemplate}`), feedback: preview(`${values.feedbackSubjectTemplate}\n\n${values.feedbackBodyTemplate}`) }), [values]);
  const field = (name: keyof Settings) => ({ name, value: String(values[name]), onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValues({ ...values, [name]: event.target.value }) });
  return <form action={action} className="grid gap-6">
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Notification controls</h2><div className="mt-4 grid gap-3"><label className="flex gap-3"><input name="homeworkEnabled" type="checkbox" checked={values.homeworkEnabled} onChange={(e) => setValues({ ...values, homeworkEnabled: e.target.checked })} /> Email students when homework is published</label><label className="flex gap-3"><input name="feedbackEnabled" type="checkbox" checked={values.feedbackEnabled} onChange={(e) => setValues({ ...values, feedbackEnabled: e.target.checked })} /> Email students when feedback is released</label></div></section>
    {(["homework", "feedback"] as const).map((type) => <section key={type} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">{type === "homework" ? "Homework Assigned" : "Feedback Ready"} template</h2><label className="mt-4 block text-sm font-semibold">Subject<input {...field(`${type}SubjectTemplate`)} className="mt-2 w-full rounded-xl border p-3 font-normal" /></label><label className="mt-4 block text-sm font-semibold">Message body<textarea {...field(`${type}BodyTemplate`)} rows={10} className="mt-2 w-full rounded-xl border p-3 font-mono text-sm font-normal" /></label><div className="mt-4 rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Live sample preview — does not send</p><pre className="mt-3 whitespace-pre-wrap font-sans text-sm">{previews[type]}</pre></div></section>)}
    <p className="text-sm text-slate-600">Allowed placeholders: {Object.keys(sample).map((key) => `{{${key}}}`).join(", ")}</p><button disabled={pending} className="rounded-full bg-amber-500 px-5 py-3 font-bold disabled:opacity-50">{pending ? "Saving…" : "Save settings"}</button><Message state={state} />
  </form>;
}

export function TestEmailForm() { const [state, action, pending] = useActionState(sendTestEmail, null); return <form action={action} className="mt-4"><label className="block text-sm font-semibold">Trusted test recipient<input name="recipient" type="email" required className="mt-2 w-full rounded-xl border p-3 font-normal" placeholder="trusted.test@example.org" /></label><button disabled={pending} className="mt-3 rounded-full bg-slate-950 px-5 py-2 text-sm font-bold text-white">{pending ? "Sending…" : "Send test email"}</button><Message state={state} /></form>; }
