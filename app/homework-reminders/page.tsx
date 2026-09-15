import { randomUUID } from "node:crypto";
import Link from "next/link";
import { UserRole } from "@prisma/client";
import { requireRole } from "../../lib/auth";
import { getReminderCandidates } from "../../lib/homework-reminders";
import { ReminderForm } from "./reminder-form";

export const dynamic = "force-dynamic";

export default async function HomeworkRemindersPage() {
  const caller = await requireRole(UserRole.ADMIN, UserRole.TEACHER);
  const candidates = await getReminderCandidates(caller);
  const taskCount = candidates.reduce((sum, candidate) => sum + candidate.tasks.length, 0);
  return <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
    <Link href="/" className="text-sm font-semibold text-amber-700">← Back to dashboard</Link>
    <header className="mt-8 rounded-3xl bg-slate-950 p-8 text-white"><p className="text-xs font-bold uppercase tracking-widest text-amber-300">Staff action</p><h1 className="mt-3 text-4xl font-bold">Homework reminders</h1><p className="mt-3 text-slate-300">Review currently published, unfinished homework in your permitted classes before queueing email reminders.</p></header>
    <section className="mt-8 rounded-3xl border bg-white p-6 shadow-sm"><h2 className="text-2xl font-bold">Confirmation preview</h2><p className="mt-3 text-lg">This will email <strong>{candidates.length} students</strong> about <strong>{taskCount} unfinished assignments</strong>.</p><div className="mt-6"><ReminderForm runKey={randomUUID()} students={candidates.length} assignments={taskCount} /></div></section>
    <section className="mt-8 rounded-3xl border bg-white p-6"><h2 className="text-xl font-bold">Recipients and tasks</h2><div className="mt-4 grid gap-4">{candidates.map(({ student, tasks }) => <article key={student.id} className="rounded-2xl bg-slate-50 p-4"><h3 className="font-bold">{student.displayName}</h3><p className="text-sm text-slate-500">{student.email}</p><ul className="mt-2 list-disc pl-5 text-sm">{tasks.map((task) => <li key={task.id}>{task.className} — {task.title}{task.dueAt ? ` · due ${task.dueAt.toLocaleString()}` : ""}</li>)}</ul></article>)}</div>{!candidates.length ? <p className="mt-4 text-slate-500">There is no unfinished published homework in your scope.</p> : null}</section>
  </main>;
}
