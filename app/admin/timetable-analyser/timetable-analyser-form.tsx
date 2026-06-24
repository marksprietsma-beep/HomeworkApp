"use client";

import { useRef, useState, useTransition } from "react";
import type { TimetableAnalysis } from "../../../lib/timetable-analyser";
import { analyseTimetableUpload } from "./actions";

function join(values: string[]) { return values.length ? values.join(", ") : "—"; }
function TableShell({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-2xl font-bold text-slate-950">{title}</h2><div className="mt-5 max-h-[34rem] overflow-auto rounded-2xl border border-slate-200">{children}</div></section>; }

export function TimetableAnalyserForm() {
  const [analysis, setAnalysis] = useState<TimetableAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  function resetParseState() {
    setError(null);
    setAnalysis(null);
  }

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    resetParseState();
    setSelectedFileName(event.currentTarget.files?.[0]?.name ?? null);
  }

  function clearFile() {
    if (fileInputRef.current) fileInputRef.current.value = "";
    setSelectedFileName(null);
    resetParseState();
  }

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await analyseTimetableUpload(formData);
      if (result.ok) setAnalysis(result.analysis); else { setAnalysis(null); setError(result.error); }
    });
  }

  return <div className="mt-8 grid gap-8">
    <form action={onSubmit} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Upload workbook</p>
      <h2 className="mt-2 text-2xl font-bold text-slate-950">Analyse timetable preview</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Upload the school timetable .xlsx workbook. This preview extracts staff, teaching loads, subjects and warnings only; it does not create or update database records.</p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center"><input ref={fileInputRef} name="timetable" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={onFileChange} className="block w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700 file:mr-4 file:rounded-full file:border-0 file:bg-slate-950 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white" /><button type="button" onClick={clearFile} disabled={isPending || !selectedFileName} className="rounded-full border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">Clear</button><button type="submit" disabled={isPending} className="rounded-full bg-amber-500 px-5 py-3 text-sm font-bold text-slate-950 shadow-sm hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60">{isPending ? "Analysing…" : "Parse/analyse"}</button></div>
      <p className="mt-3 text-sm font-medium text-slate-600">Selected file: <span className="font-bold text-slate-950">{selectedFileName ?? "No workbook selected"}</span></p>
      {isPending ? <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">Reading the selected workbook as an ArrayBuffer and analysing worksheet names…</p> : null}
      {analysis ? <p className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Workbook parsed successfully. Review-only preview generated; no database records were created or updated.</p> : null}
      {error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"><p className="font-bold">The workbook could not be analysed.</p><p className="mt-1 whitespace-pre-wrap font-medium">{error}</p></div> : null}
    </form>
    {analysis ? <>
      <div className="grid gap-4 md:grid-cols-5">{[["Staff detected", analysis.totals.staffDetected], ["Subjects detected", analysis.totals.subjectsDetected], ["Year groups", analysis.totals.yearGroupsDetected], ["Teaching lessons", analysis.totals.teachingLessonsCounted], ["Warnings", analysis.totals.warningCount]].map(([label, value]) => <div key={label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p><p className="mt-2 text-3xl font-black text-slate-950">{value}</p></div>)}</div>
      <TableShell title="Staff teaching loads"><table className="min-w-[1100px] text-left text-sm"><thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-500"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Code</th><th className="px-4 py-3">Load</th><th className="px-4 py-3">Tutor</th><th className="px-4 py-3">Tutor groups</th><th className="px-4 py-3">Subjects</th><th className="px-4 py-3">Year groups/classes</th></tr></thead><tbody>{analysis.staff.map(s => <tr key={s.staffCode} className="border-t border-slate-100"><td className="px-4 py-3 font-semibold text-slate-900">{s.staffName}</td><td className="px-4 py-3">{s.staffCode}</td><td className="px-4 py-3 font-bold">{s.teachingLessonCount}</td><td className="px-4 py-3">{s.isTutor ? "Yes" : "No"}</td><td className="px-4 py-3">{join(s.tutorGroups)}</td><td className="px-4 py-3">{join(s.subjects)}</td><td className="px-4 py-3">{join([...s.yearGroups, ...s.classGroups])}</td></tr>)}</tbody></table></TableShell>
      <TableShell title="Subject overview"><table className="min-w-[1000px] text-left text-sm"><thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-500"><tr><th className="px-4 py-3">Subject</th><th className="px-4 py-3">Year group</th><th className="px-4 py-3">Lessons</th><th className="px-4 py-3">Classes/groups</th><th className="px-4 py-3">Teachers</th></tr></thead><tbody>{analysis.subjectYearGroups.map(s => <tr key={`${s.subject}-${s.yearGroup}`} className="border-t border-slate-100"><td className="px-4 py-3 font-semibold">{s.subject}</td><td className="px-4 py-3">{s.yearGroup}</td><td className="px-4 py-3 font-bold">{s.lessonCount}</td><td className="px-4 py-3">{join(s.classGroups)}</td><td className="px-4 py-3">{join(s.teachers)}</td></tr>)}</tbody></table></TableShell>
      <TableShell title="Year-group subjects"><table className="min-w-[680px] text-left text-sm"><thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-500"><tr><th className="px-4 py-3">Year group</th><th className="px-4 py-3">Subjects</th></tr></thead><tbody>{analysis.yearGroups.map(y => <tr key={y.yearGroup} className="border-t border-slate-100"><td className="px-4 py-3 font-semibold">{y.yearGroup}</td><td className="px-4 py-3">{join(y.subjects)}</td></tr>)}</tbody></table></TableShell>
      <TableShell title="Warnings"><table className="min-w-[900px] text-left text-sm"><thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-500"><tr><th className="px-4 py-3">Staff</th><th className="px-4 py-3">Day</th><th className="px-4 py-3">Period</th><th className="px-4 py-3">Raw cell</th><th className="px-4 py-3">Reason</th></tr></thead><tbody>{analysis.warnings.length ? analysis.warnings.map((w, i) => <tr key={i} className="border-t border-slate-100"><td className="px-4 py-3">{w.staffName ? `${w.staffName} (${w.staffCode})` : "—"}</td><td className="px-4 py-3">{w.day ?? "—"}</td><td className="px-4 py-3">{w.period ?? "—"}</td><td className="whitespace-pre-line px-4 py-3">{w.rawValue ?? "—"}</td><td className="px-4 py-3 font-semibold text-amber-700">{w.reason}</td></tr>) : <tr><td colSpan={5} className="px-4 py-6 text-center font-semibold text-slate-500">No warnings found.</td></tr>}</tbody></table></TableShell>
    </> : null}
  </div>;
}
