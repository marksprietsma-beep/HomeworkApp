"use client";

import Link from "next/link";
import { ClassStatus } from "@prisma/client";
import { useActionState } from "react";
import { createAdminClass, updateAdminClass, type AdminClassFormState } from "./actions";

type TeacherOption = { id: number; displayName: string; email: string };
type ManagedClass = {
  id: number;
  name: string;
  subject: string;
  description: string;
  teacherId: number;
  status: ClassStatus;
  enrollmentCount: number;
  assignmentCount: number;
};

const initialState: AdminClassFormState = { error: null, success: null };

function FormMessage({ state }: { state: AdminClassFormState }) {
  if (state.error) return <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{state.error}</p>;
  if (state.success) return <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{state.success}</p>;
  return null;
}

function TeacherSelect({ teachers, defaultValue }: { teachers: TeacherOption[]; defaultValue?: number }) {
  return (
    <select name="teacherId" required defaultValue={defaultValue ?? ""} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm disabled:bg-slate-100" disabled={teachers.length === 0}>
      <option value="" disabled>Choose active teacher</option>
      {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.displayName} — {teacher.email}</option>)}
    </select>
  );
}

export function CreateAdminClassForm({ teachers }: { teachers: TeacherOption[] }) {
  const [state, formAction, isPending] = useActionState(createAdminClass, initialState);
  return (
    <form action={formAction} className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Create class</p><h2 className="mt-2 text-2xl font-bold text-slate-950">Manual class setup</h2><p className="mt-2 text-sm leading-6 text-slate-600">Create a class, assign an active teacher, and leave it inactive if it is not ready for classroom workflows yet.</p></div>
      <label className="text-sm font-semibold text-slate-700">Class name<input name="name" required className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm" placeholder="e.g. Year 7 Maths A" /></label>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700">Subject<input name="subject" required defaultValue="General" className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm" /></label>
        <label className="text-sm font-semibold text-slate-700">Status<select name="status" required defaultValue={ClassStatus.ACTIVE} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm"><option value={ClassStatus.ACTIVE}>Active</option><option value={ClassStatus.INACTIVE}>Inactive / archived</option></select></label>
      </div>
      <label className="text-sm font-semibold text-slate-700">Assigned teacher<TeacherSelect teachers={teachers} /></label>
      <label className="text-sm font-semibold text-slate-700">Description / notes<textarea name="description" rows={4} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm" placeholder="Optional setup notes" /></label>
      {teachers.length === 0 ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">Create or reactivate a TEACHER account before creating classes.</p> : null}
      <FormMessage state={state} />
      <button type="submit" disabled={isPending || teachers.length === 0} className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400 md:justify-self-start">{isPending ? "Creating…" : "Create class"}</button>
    </form>
  );
}

export function EditableClassRow({ classItem, teachers }: { classItem: ManagedClass; teachers: TeacherOption[] }) {
  const [state, formAction, isPending] = useActionState(updateAdminClass, initialState);
  return (
    <tr className="border-t border-slate-200 align-top"><td colSpan={8} className="px-4 py-4"><form action={formAction} className="grid gap-3 lg:grid-cols-[1fr_0.8fr_1.2fr_0.8fr_0.7fr_0.7fr_auto] lg:items-end">
      <input type="hidden" name="classId" value={classItem.id} />
      <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Name<input name="name" required defaultValue={classItem.name} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-950" /></label>
      <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Subject<input name="subject" required defaultValue={classItem.subject} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-950" /></label>
      <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Notes<input name="description" defaultValue={classItem.description} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-950" /></label>
      <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Teacher<select name="teacherId" defaultValue={classItem.teacherId} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-950">{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.displayName}</option>)}</select></label>
      <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Status<select name="status" defaultValue={classItem.status} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-950"><option value={ClassStatus.ACTIVE}>Active</option><option value={ClassStatus.INACTIVE}>Inactive</option></select></label>
      <p className="text-xs font-semibold text-slate-500">{classItem.enrollmentCount} enrolled<br />{classItem.assignmentCount} assignments</p>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={isPending || teachers.length === 0} className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-sm disabled:bg-slate-300">{isPending ? "Saving…" : "Save"}</button>
        <Link href={`/classes/${classItem.id}`} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950">Manage roster</Link>
      </div>
      <div className="lg:col-span-7"><FormMessage state={state} /></div>
    </form></td></tr>
  );
}
