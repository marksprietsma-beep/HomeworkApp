"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import type { StaffSummary, SubjectYearSummary, TimetableAnalysis, TimetableImportWarning, YearGroupSummary } from "../../../lib/timetable-analyser";
import { analyseTimetableUpload, saveTimetableImport } from "./actions";

type SortDirection = "asc" | "desc";
type SortState<K extends string> = { key: K; direction: SortDirection };
type StaffSortKey = "name" | "code" | "load" | "tutor" | "leadership";
type SavedTimetableImport = { id: number; name: string; sourceFilename: string; isActive: boolean; createdAt: string; updatedAt: string; analysis: TimetableAnalysis };
type ViewState = { mode: "empty" | "preview" | "saved"; saved?: Omit<SavedTimetableImport, "analysis"> };
type SubjectSortKey = "subject" | "yearGroup" | "lessons" | "teachers";
type YearGroupSortKey = "yearGroup" | "subjects";
type WarningSortKey = "staff" | "day" | "period" | "rawValue" | "reason";

function join(values: string[]) { return values.length ? values.join(", ") : "—"; }
function teacherText(staffName?: string, staffCode?: string) { return staffName ? `${staffName}${staffCode ? ` (${staffCode})` : ""}` : "—"; }
function compareText(a: string, b: string) { return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }); }
function compareValues(a: string | number | boolean | undefined, b: string | number | boolean | undefined) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  return compareText(String(a ?? ""), String(b ?? ""));
}
function sortRows<T, K extends string>(rows: T[], sort: SortState<K>, valueFor: (row: T, key: K) => string | number | boolean | undefined) {
  return [...rows].sort((a, b) => (sort.direction === "asc" ? 1 : -1) * compareValues(valueFor(a, sort.key), valueFor(b, sort.key)));
}
function nextSort<K extends string>(current: SortState<K>, key: K): SortState<K> { return { key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" }; }
function csvEscape(value: string | number | boolean | undefined) { const text = String(value ?? ""); return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }

function uniqueSorted(values: (string | undefined)[]) { return [...new Set(values.filter((value): value is string => Boolean(value)))].sort(compareText); }
function removeStaffFromAnalysis(analysis: TimetableAnalysis, staffCode: string): TimetableAnalysis {
  const remainingStaff = analysis.staff.filter(staff => staff.staffCode !== staffCode);
  const staffFlags = new Map(remainingStaff.map(staff => [staff.staffCode, { isTutor: staff.isTutor, isLeadership: staff.isLeadership }]));
  const parsedLessons = analysis.parsedLessons.filter(entry => entry.staffCode !== staffCode);
  const rawCells = analysis.rawCells.filter(cell => cell.staffCode !== staffCode);
  const warnings = analysis.warnings.filter(warning => warning.staffCode !== staffCode && !warning.reason.includes("has inconsistent group lesson counts"));
  const staff = remainingStaff.map(staff => {
    const entries = parsedLessons.filter(entry => entry.staffCode === staff.staffCode);
    const teachingEntries = entries.filter(entry => entry.isTeachingLesson && !entry.isTutorEntry);
    const tutorGroups = uniqueSorted(entries.filter(entry => entry.isTutorEntry).map(entry => entry.classGroup));
    const flags = staffFlags.get(staff.staffCode);
    return {
      ...staff,
      teachingLessonCount: teachingEntries.length,
      isTutor: flags?.isTutor ?? tutorGroups.length > 0,
      isLeadership: flags?.isLeadership ?? false,
      tutorGroups,
      subjects: uniqueSorted(teachingEntries.map(entry => entry.subject)),
      yearGroups: uniqueSorted(entries.map(entry => entry.yearGroup)),
      classGroups: uniqueSorted(teachingEntries.map(entry => entry.classGroup)),
    };
  });
  const teachingLessons = parsedLessons.filter(entry => entry.isTeachingLesson && !entry.isTutorEntry);
  const subjectNames = uniqueSorted(teachingLessons.map(entry => entry.subject));
  const subjects = subjectNames.map(subject => {
    const entries = teachingLessons.filter(entry => entry.subject === subject);
    return { subject, lessonCount: entries.length, yearGroups: uniqueSorted(entries.map(entry => entry.yearGroup)), classGroups: uniqueSorted(entries.map(entry => entry.classGroup)), teachers: uniqueSorted(entries.map(entry => `${entry.staffName} (${entry.staffCode})`)) };
  });
  const yearGroups = uniqueSorted(subjects.flatMap(subject => subject.yearGroups)).map(yearGroup => ({ yearGroup, subjects: uniqueSorted(subjects.filter(subject => subject.yearGroups.includes(yearGroup)).map(subject => subject.subject)) }));
  const subjectYearKeys = uniqueSorted(teachingLessons.map(entry => `${entry.subject}|||${entry.yearGroup ?? "Unknown"}`));
  const subjectYearGroups = subjectYearKeys.map(key => {
    const [subject, yearGroup] = key.split("|||");
    const entries = teachingLessons.filter(entry => entry.subject === subject && (entry.yearGroup ?? "Unknown") === yearGroup);
    const classGroups = uniqueSorted(entries.map(entry => entry.classGroup));
    const groupLessonCounts = classGroups.map(classGroup => ({ classGroup, lessonCount: entries.filter(entry => entry.classGroup === classGroup).length }));
    const counts = groupLessonCounts.map(group => group.lessonCount);
    const uniqueCounts = [...new Set(counts)].sort((a, b) => a - b);
    const frequencies = new Map<number, number>();
    for (const count of counts) frequencies.set(count, (frequencies.get(count) ?? 0) + 1);
    const lessonCount = [...frequencies.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? 0;
    const hasInconsistentGroupCounts = uniqueCounts.length > 1;
    return { subject, yearGroup, lessonCount, lessonCountLabel: hasInconsistentGroupCounts ? `${uniqueCounts[0]}–${uniqueCounts[uniqueCounts.length - 1]}` : `${lessonCount}`, classGroups, teachers: uniqueSorted(entries.map(entry => `${entry.staffName} (${entry.staffCode})`)), groupLessonCounts, hasInconsistentGroupCounts };
  });
  return { rawCells, parsedLessons, staff, subjects, yearGroups, subjectYearGroups, warnings, totals: { staffDetected: staff.length, subjectsDetected: subjects.length, yearGroupsDetected: yearGroups.length, teachingLessonsCounted: subjects.reduce((total, subject) => total + subject.lessonCount, 0), warningCount: warnings.length } };
}
function exportCsv(fileName: string, headers: string[], rows: (string | number | boolean | undefined)[][]) {
  const csv = [headers, ...rows].map(row => row.map(csvEscape).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
function SortHeader<K extends string>({ label, sortKey, sort, onSort }: { label: string; sortKey: K; sort: SortState<K>; onSort: (key: K) => void }) {
  const active = sort.key === sortKey;
  return <th className="px-4 py-3"><button type="button" onClick={() => onSort(sortKey)} className="flex items-center gap-1 font-bold uppercase tracking-[0.14em] hover:text-slate-950">{label}<span>{active ? (sort.direction === "asc" ? "↑" : "↓") : "↕"}</span></button></th>;
}
function TableShell({ title, exportLabel = "Export CSV", onExport, children }: { title: string; exportLabel?: string; onExport?: () => void; children: React.ReactNode }) { return <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-2xl font-bold text-slate-950">{title}</h2>{onExport ? <button type="button" onClick={onExport} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">{exportLabel}</button> : null}</div><div className="mt-5 max-h-[34rem] overflow-auto rounded-2xl border border-slate-200">{children}</div></section>; }

export function TimetableAnalyserForm({ initialActiveTimetable }: { initialActiveTimetable: SavedTimetableImport | null }) {
  const [analysis, setAnalysis] = useState<TimetableAnalysis | null>(initialActiveTimetable?.analysis ?? null);
  const [viewState, setViewState] = useState<ViewState>(initialActiveTimetable ? { mode: "saved", saved: { id: initialActiveTimetable.id, name: initialActiveTimetable.name, sourceFilename: initialActiveTimetable.sourceFilename, isActive: initialActiveTimetable.isActive, createdAt: initialActiveTimetable.createdAt, updatedAt: initialActiveTimetable.updatedAt } } : { mode: "empty" });
  const [timetableName, setTimetableName] = useState(initialActiveTimetable?.name ?? "");
  const [saveAsActive, setSaveAsActive] = useState(initialActiveTimetable?.isActive ?? true);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [teacherFilter, setTeacherFilter] = useState("");
  const [staffSort, setStaffSort] = useState<SortState<StaffSortKey>>({ key: "name", direction: "asc" });
  const [subjectSort, setSubjectSort] = useState<SortState<SubjectSortKey>>({ key: "subject", direction: "asc" });
  const [yearGroupSort, setYearGroupSort] = useState<SortState<YearGroupSortKey>>({ key: "yearGroup", direction: "asc" });
  const [warningSort, setWarningSort] = useState<SortState<WarningSortKey>>({ key: "staff", direction: "asc" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  function resetParseState() { setError(null); setAnalysis(null); setTeacherFilter(""); setViewState({ mode: "empty" }); setSaveMessage(null); }
  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) { resetParseState(); setSelectedFileName(event.currentTarget.files?.[0]?.name ?? null); }
  function clearFile() { if (fileInputRef.current) fileInputRef.current.value = ""; setSelectedFileName(null); resetParseState(); }
  function onSubmit(formData: FormData) { setError(null); setSaveMessage(null); startTransition(async () => { const result = await analyseTimetableUpload(formData); if (result.ok) { setAnalysis(result.analysis); setViewState({ mode: "preview" }); setTimetableName(result.sourceFilename.replace(/\.xlsx$/i, "")); setSaveAsActive(true); } else { setAnalysis(null); setViewState({ mode: "empty" }); setError(result.error); } }); }
  function markUnsaved() { setViewState(current => current.mode === "saved" ? { mode: "preview", saved: current.saved } : current); setSaveMessage(null); }
  function updateStaffFlag(staffCode: string, field: "isTutor" | "isLeadership") { setAnalysis(current => current ? { ...current, staff: current.staff.map(staff => staff.staffCode === staffCode ? { ...staff, [field]: !staff[field] } : staff) } : current); markUnsaved(); }
  function removeStaff(staff: StaffSummary) { if (!window.confirm(`Remove ${staff.staffName} (${staff.staffCode}) from this timetable import?\n\nThis only removes the staff member from this saved/imported timetable analysis. It does not delete any app user account. Save the timetable afterwards to persist this removal.`)) return; setAnalysis(current => current ? removeStaffFromAnalysis(current, staff.staffCode) : current); if (teacherFilter.includes(`(${staff.staffCode})`)) setTeacherFilter(""); markUnsaved(); setSaveMessage(`Removed ${staff.staffName} (${staff.staffCode}) from this timetable analysis. Save the timetable to persist this removal.`); }
  function saveCurrentTimetable() { if (!analysis) return; setError(null); setSaveMessage(null); startTransition(async () => { const result = await saveTimetableImport({ id: viewState.saved?.id, name: timetableName, sourceFilename: selectedFileName ?? viewState.saved?.sourceFilename ?? "Parsed timetable", isActive: saveAsActive, analysis }); if (result.ok) { setAnalysis(result.timetable.analysis); setViewState({ mode: "saved", saved: { id: result.timetable.id, name: result.timetable.name, sourceFilename: result.timetable.sourceFilename, isActive: result.timetable.isActive, createdAt: result.timetable.createdAt, updatedAt: result.timetable.updatedAt } }); setTimetableName(result.timetable.name); setSaveAsActive(result.timetable.isActive); setSaveMessage(`Saved ${result.timetable.isActive ? "and marked active" : "as inactive"}.`); } else setError(result.error); }); }

  const teacherOptions = useMemo(() => analysis ? analysis.staff.map(s => `${s.staffName} (${s.staffCode})`).sort(compareText) : [], [analysis]);
  const selectedStaffCode = teacherFilter.match(/\(([^)]+)\)$/)?.[1];
  const teacherNeedle = teacherFilter.toLowerCase().trim();
  const teacherMatches = useCallback((teacher: string) => !teacherNeedle || teacher.toLowerCase().includes(teacherNeedle) || (selectedStaffCode ? teacher.includes(`(${selectedStaffCode})`) : false), [teacherNeedle, selectedStaffCode]);
  const filteredStaff = useMemo(() => analysis ? sortRows(analysis.staff.filter(s => !teacherNeedle || teacherMatches(`${s.staffName} (${s.staffCode})`)), staffSort, (s, key) => key === "name" ? s.staffName : key === "code" ? s.staffCode : key === "load" ? s.teachingLessonCount : key === "leadership" ? s.isLeadership : s.isTutor) : [], [analysis, teacherNeedle, teacherMatches, staffSort]);
  const filteredSubjects = useMemo(() => analysis ? sortRows(analysis.subjectYearGroups.filter(s => !teacherNeedle || s.teachers.some(teacherMatches)), subjectSort, (s, key) => key === "subject" ? s.subject : key === "yearGroup" ? s.yearGroup : key === "lessons" ? s.lessonCount : s.teachers.join(", ")) : [], [analysis, teacherNeedle, teacherMatches, subjectSort]);
  const filteredYearGroups = useMemo(() => analysis ? sortRows(analysis.yearGroups.filter(y => !teacherNeedle || filteredSubjects.some(s => s.yearGroup === y.yearGroup)), yearGroupSort, (y, key) => key === "yearGroup" ? y.yearGroup : y.subjects.join(", ")) : [], [analysis, teacherNeedle, filteredSubjects, yearGroupSort]);
  const filteredWarnings = useMemo(() => analysis ? sortRows(analysis.warnings.filter(w => !teacherNeedle || teacherMatches(teacherText(w.staffName, w.staffCode))), warningSort, (w, key) => key === "staff" ? teacherText(w.staffName, w.staffCode) : w[key] ?? "") : [], [analysis, teacherNeedle, teacherMatches, warningSort]);

  const staffRows = (rows: StaffSummary[]) => rows.map(s => [s.staffName, s.staffCode, s.teachingLessonCount, s.isTutor ? "Yes" : "No", s.isLeadership ? "Yes" : "No", join(s.tutorGroups), join(s.subjects), join([...s.yearGroups, ...s.classGroups])]);
  const subjectRows = (rows: SubjectYearSummary[]) => rows.map(s => [s.subject, s.yearGroup, s.lessonCountLabel ?? s.lessonCount, join(s.classGroups), join(s.teachers), s.hasInconsistentGroupCounts ? s.groupLessonCounts.map(g => `${g.classGroup} = ${g.lessonCount}`).join(", ") : ""]);
  const yearRows = (rows: YearGroupSummary[]) => rows.map(y => [y.yearGroup, join(y.subjects)]);
  const warningRows = (rows: TimetableImportWarning[]) => rows.map(w => [teacherText(w.staffName, w.staffCode), w.day ?? "—", w.period ?? "—", w.rawValue ?? "—", w.reason]);

  return <div className="mt-8 grid gap-8">
    <form action={onSubmit} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Upload workbook</p><h2 className="mt-2 text-2xl font-bold text-slate-950">Analyse timetable preview</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Upload the school timetable .xlsx workbook. This preview extracts staff, teaching loads, subjects and warnings only; it does not create or update database records.</p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center"><input ref={fileInputRef} name="timetable" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={onFileChange} className="block w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700 file:mr-4 file:rounded-full file:border-0 file:bg-slate-950 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white" /><button type="button" onClick={clearFile} disabled={isPending || !selectedFileName} className="rounded-full border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">Clear</button><button type="submit" disabled={isPending} className="rounded-full bg-amber-500 px-5 py-3 text-sm font-bold text-slate-950 shadow-sm hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60">{isPending ? "Analysing…" : "Parse/analyse"}</button></div>
      <p className="mt-3 text-sm font-medium text-slate-600">Selected file: <span className="font-bold text-slate-950">{selectedFileName ?? "No workbook selected"}</span></p>{isPending ? <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">Reading the selected workbook as an ArrayBuffer and analysing worksheet names…</p> : null}{analysis ? <p className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Workbook parsed successfully. Review-only preview generated; no database records were created or updated.</p> : null}{saveMessage ? <p className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{saveMessage}</p> : null}{error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"><p className="font-bold">The workbook could not be analysed.</p><p className="mt-1 whitespace-pre-wrap font-medium">{error}</p></div> : null}
    </form>
    {analysis ? <>
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Timetable status</p><div className="mt-3 flex flex-wrap gap-2"><span className={`rounded-full px-3 py-1 text-xs font-bold ${viewState.mode === "saved" ? "bg-sky-100 text-sky-800" : "bg-amber-100 text-amber-800"}`}>{viewState.mode === "saved" ? "Saved timetable" : "Unsaved changes - save to persist"}</span>{viewState.saved?.isActive ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">Active/current</span> : null}</div>{viewState.saved ? <p className="mt-2 text-sm text-slate-600">Source: <span className="font-semibold">{viewState.saved.sourceFilename}</span> · Updated {new Date(viewState.saved.updatedAt).toLocaleString()}</p> : <p className="mt-2 text-sm text-slate-600">Saving is explicit. A new active save deactivates the previous active timetable.</p>}</div><div className="grid flex-1 gap-3 sm:grid-cols-[1fr_auto_auto]"><label className="text-sm font-bold text-slate-700">Timetable name<input value={timetableName} onChange={e => setTimetableName(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm font-normal" /></label><label className="flex items-center gap-2 self-end rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700"><input type="checkbox" checked={saveAsActive} onChange={e => setSaveAsActive(e.target.checked)} /> Save as active</label><button type="button" onClick={saveCurrentTimetable} disabled={isPending} className="self-end rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">Save timetable</button></div></div></section>
      <div className="grid gap-4 md:grid-cols-5">{[["Staff detected", analysis.totals.staffDetected], ["Subjects detected", analysis.totals.subjectsDetected], ["Year groups", analysis.totals.yearGroupsDetected], ["Teaching lessons", analysis.totals.teachingLessonsCounted], ["Warnings", analysis.totals.warningCount]].map(([label, value]) => <div key={label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p><p className="mt-2 text-3xl font-black text-slate-950">{value}</p></div>)}</div>
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><label className="text-sm font-bold text-slate-700" htmlFor="teacher-filter">Teacher filter</label><div className="mt-3 flex flex-col gap-3 sm:flex-row"><input id="teacher-filter" list="teacher-options" value={teacherFilter} onChange={e => setTeacherFilter(e.target.value)} placeholder="Search or select a teacher…" className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm" /><datalist id="teacher-options">{teacherOptions.map(t => <option key={t} value={t} />)}</datalist><button type="button" onClick={() => setTeacherFilter("")} className="rounded-full border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">Clear filter</button></div></section>
      <TableShell title="Staff teaching loads" onExport={() => exportCsv("timetable-staff-overview.csv", ["Name", "Code", "Load", "Tutor", "Leadership", "Tutor groups", "Subjects", "Year groups/classes"], staffRows(filteredStaff))}><table className="min-w-[1100px] text-left text-sm"><thead className="sticky top-0 bg-slate-50 text-xs text-slate-500"><tr><SortHeader label="Name" sortKey="name" sort={staffSort} onSort={k => setStaffSort(nextSort(staffSort, k))}/><SortHeader label="Code" sortKey="code" sort={staffSort} onSort={k => setStaffSort(nextSort(staffSort, k))}/><th className="px-4 py-3">Actions</th><SortHeader label="Load" sortKey="load" sort={staffSort} onSort={k => setStaffSort(nextSort(staffSort, k))}/><SortHeader label="Tutor" sortKey="tutor" sort={staffSort} onSort={k => setStaffSort(nextSort(staffSort, k))}/><SortHeader label="Leadership" sortKey="leadership" sort={staffSort} onSort={k => setStaffSort(nextSort(staffSort, k))}/><th className="px-4 py-3">Tutor groups</th><th className="px-4 py-3">Subjects</th><th className="px-4 py-3">Year groups/classes</th></tr></thead><tbody>{filteredStaff.map(s => <tr key={s.staffCode} className="border-t border-slate-100"><td className="px-4 py-3 font-semibold text-slate-900">{s.staffName}</td><td className="px-4 py-3">{s.staffCode}</td><td className="px-4 py-3"><button type="button" onClick={() => removeStaff(s)} className="rounded-full border border-rose-200 px-3 py-1 text-xs font-bold text-rose-700 hover:bg-rose-50" aria-label={`Remove ${s.staffName} (${s.staffCode}) from this timetable import`}>Remove</button></td><td className="px-4 py-3 font-bold">{s.teachingLessonCount}</td><td className="px-4 py-3"><button type="button" onClick={() => updateStaffFlag(s.staffCode, "isTutor")} className={`rounded-full px-3 py-1 text-xs font-bold ${s.isTutor ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{s.isTutor ? "Yes" : "No"}</button></td><td className="px-4 py-3"><button type="button" onClick={() => updateStaffFlag(s.staffCode, "isLeadership")} className={`rounded-full px-3 py-1 text-xs font-bold ${s.isLeadership ? "bg-purple-100 text-purple-800" : "bg-slate-100 text-slate-600"}`}>{s.isLeadership ? "Yes" : "No"}</button></td><td className="px-4 py-3">{join(s.tutorGroups)}</td><td className="px-4 py-3">{join(s.subjects)}</td><td className="px-4 py-3">{join([...s.yearGroups, ...s.classGroups])}</td></tr>)}</tbody></table></TableShell>
      <TableShell title="Subject overview" onExport={() => exportCsv("timetable-subject-year-overview.csv", ["Subject", "Year group", "Lessons per group", "Classes/groups", "Teachers", "Group lesson counts"], subjectRows(filteredSubjects))}><table className="min-w-[1000px] text-left text-sm"><thead className="sticky top-0 bg-slate-50 text-xs text-slate-500"><tr><SortHeader label="Subject" sortKey="subject" sort={subjectSort} onSort={k => setSubjectSort(nextSort(subjectSort, k))}/><SortHeader label="Year group" sortKey="yearGroup" sort={subjectSort} onSort={k => setSubjectSort(nextSort(subjectSort, k))}/><SortHeader label="Lessons" sortKey="lessons" sort={subjectSort} onSort={k => setSubjectSort(nextSort(subjectSort, k))}/><th className="px-4 py-3">Classes/groups</th><SortHeader label="Teachers" sortKey="teachers" sort={subjectSort} onSort={k => setSubjectSort(nextSort(subjectSort, k))}/></tr></thead><tbody>{filteredSubjects.map(s => <tr key={`${s.subject}-${s.yearGroup}`} className="border-t border-slate-100"><td className="px-4 py-3 font-semibold">{s.subject}</td><td className="px-4 py-3">{s.yearGroup}</td><td className="px-4 py-3 font-bold">{s.lessonCountLabel ?? s.lessonCount}{s.hasInconsistentGroupCounts ? <span className="ml-2 rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-800">Inconsistent</span> : null}</td><td className="px-4 py-3">{join(s.classGroups)}</td><td className="px-4 py-3">{join(s.teachers)}</td></tr>)}</tbody></table></TableShell>
      <TableShell title="Year-group subjects" onExport={() => exportCsv("timetable-year-group-subjects.csv", ["Year group", "Subjects"], yearRows(filteredYearGroups))}><table className="min-w-[680px] text-left text-sm"><thead className="sticky top-0 bg-slate-50 text-xs text-slate-500"><tr><SortHeader label="Year group" sortKey="yearGroup" sort={yearGroupSort} onSort={k => setYearGroupSort(nextSort(yearGroupSort, k))}/><SortHeader label="Subjects" sortKey="subjects" sort={yearGroupSort} onSort={k => setYearGroupSort(nextSort(yearGroupSort, k))}/></tr></thead><tbody>{filteredYearGroups.map(y => <tr key={y.yearGroup} className="border-t border-slate-100"><td className="px-4 py-3 font-semibold">{y.yearGroup}</td><td className="px-4 py-3">{join(y.subjects)}</td></tr>)}</tbody></table></TableShell>
      <TableShell title="Warnings" onExport={() => exportCsv("timetable-warnings.csv", ["Staff", "Day", "Period", "Raw cell", "Reason"], warningRows(filteredWarnings))}><table className="min-w-[900px] text-left text-sm"><thead className="sticky top-0 bg-slate-50 text-xs text-slate-500"><tr><SortHeader label="Staff" sortKey="staff" sort={warningSort} onSort={k => setWarningSort(nextSort(warningSort, k))}/><SortHeader label="Day" sortKey="day" sort={warningSort} onSort={k => setWarningSort(nextSort(warningSort, k))}/><SortHeader label="Period" sortKey="period" sort={warningSort} onSort={k => setWarningSort(nextSort(warningSort, k))}/><SortHeader label="Raw cell" sortKey="rawValue" sort={warningSort} onSort={k => setWarningSort(nextSort(warningSort, k))}/><SortHeader label="Reason" sortKey="reason" sort={warningSort} onSort={k => setWarningSort(nextSort(warningSort, k))}/></tr></thead><tbody>{filteredWarnings.length ? filteredWarnings.map((w, i) => <tr key={i} className="border-t border-slate-100"><td className="px-4 py-3">{teacherText(w.staffName, w.staffCode)}</td><td className="px-4 py-3">{w.day ?? "—"}</td><td className="px-4 py-3">{w.period ?? "—"}</td><td className="whitespace-pre-line px-4 py-3">{w.rawValue ?? "—"}</td><td className="px-4 py-3 font-semibold text-amber-700">{w.reason}</td></tr>) : <tr><td colSpan={5} className="px-4 py-6 text-center font-semibold text-slate-500">No warnings found.</td></tr>}</tbody></table></TableShell>
    </> : null}
  </div>;
}
