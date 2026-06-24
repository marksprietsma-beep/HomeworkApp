"use client";

import { useMemo, useRef, useState } from "react";
import { saveDutySchedule, type SavedDutySchedule } from "./actions";
import type { TimetableAnalysis } from "../../../lib/timetable-analyser";
import { autoScheduleDuties, countStaffTeachingPeriodByDay, DUTY_SCHEDULER_SCORING_CONSTANTS, DUTY_SCHOOL_DAYS, DUTY_TIME_OPTIONS, expandDutyDefinitions, getDutySchedulerStaff, summariseManualSchedule, type DutyAssignmentSlot, type DutyDefinitionRow, type DutyTime } from "../../../lib/duty-scheduler";

type SavedTimetableImport = { id: number; name: string; sourceFilename: string; isActive: boolean; createdAt: string; updatedAt: string; analysis: TimetableAnalysis };
type DutySchedulerExport = ReturnType<typeof buildExportPayload>;
type ViewingSchedule = Pick<SavedDutySchedule, "id" | "name" | "isActive" | "sourceTimetableImportId" | "sourceTimetableName" | "updatedAt">;

type ImportValidationResult = { ok: true; data: DutySchedulerExport } | { ok: false; error: string };

const EXPORT_TYPE = "duty-scheduler-analysis";
const EXPORT_VERSION = 2;

function newDuty(index: number): DutyDefinitionRow { return { id: `duty-${Date.now()}-${index}`, description: "", time: "Breaktime" }; }
function staffDisplay(staff: { staffName: string; staffCode: string }) { return `${staff.staffName} (${staff.staffCode})`; }
function names(rows: { staffName: string; staffCode: string }[]) { return rows.length ? rows.map(staffDisplay).join(", ") : "None"; }
function dayCountsText(counts: Record<string, number>) { return DUTY_SCHOOL_DAYS.map(day => `${day.slice(0, 3)} ${counts[day]}`).join(" · "); }
function manualAdjustmentsFromPayload(payload: DutySchedulerExport | null) { return Object.fromEntries((payload?.staff ?? []).map(member => [member.staffCode, Number(member.manualLoadAdjustment ?? 0)])); }

function isDutyTime(value: unknown): value is DutyTime { return typeof value === "string" && DUTY_TIME_OPTIONS.includes(value as DutyTime); }
function isSchoolDay(value: unknown) { return typeof value === "string" && DUTY_SCHOOL_DAYS.includes(value as (typeof DUTY_SCHOOL_DAYS)[number]); }
function safeFilenamePart(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "duty-schedule"; }
function downloadTextFile(filename: string, contents: string, mimeType: string) {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
function getStaffCounts(assignments: DutyAssignmentSlot[]) {
  const counts = new Map<string, { breakDutyCount: number; lunchDutyCount: number; totalDutyCount: number }>();
  for (const assignment of assignments) {
    if (!assignment.assignedStaffCode) continue;
    const current = counts.get(assignment.assignedStaffCode) ?? { breakDutyCount: 0, lunchDutyCount: 0, totalDutyCount: 0 };
    current.totalDutyCount += 1;
    if (assignment.time === "Breaktime") current.breakDutyCount += 1; else current.lunchDutyCount += 1;
    counts.set(assignment.assignedStaffCode, current);
  }
  return counts;
}
function buildExportPayload(timetable: SavedTimetableImport, definitions: DutyDefinitionRow[], assignments: DutyAssignmentSlot[], staff: ReturnType<typeof getDutySchedulerStaff>, summary: ReturnType<typeof summariseManualSchedule>) {
  const staffByCode = new Map(staff.map(member => [member.staffCode, member]));
  const counts = getStaffCounts(assignments);
  return {
    exportType: EXPORT_TYPE,
    version: EXPORT_VERSION,
    generatedAt: new Date().toISOString(),
    sourceTimetable: { id: String(timetable.id), name: timetable.name, isActive: timetable.isActive, sourceFilename: timetable.sourceFilename, updatedAt: timetable.updatedAt },
    dutyDefinitions: definitions.map(definition => ({ id: definition.id, description: definition.description, time: definition.time })),
    assignments: assignments.map(assignment => {
      const assignedStaff = staffByCode.get(assignment.assignedStaffCode);
      return { day: assignment.day, time: assignment.time, description: assignment.description, dutyDefinitionId: assignment.id, slotId: assignment.slotId, assignedStaffCode: assignment.assignedStaffCode, assignedStaffName: assignedStaff?.staffName ?? "" };
    }),
    staff: staff.map(member => ({
      staffName: member.staffName,
      staffCode: member.staffCode,
      teachingLoad: member.teachingLessonCount,
      manualLoadAdjustment: member.manualLoadAdjustment,
      effectiveLoad: member.effectiveLoad,
      isTutor: member.isTutor,
      isLeadership: member.isLeadership,
      teachesP2ByDay: member.teachesP2ByDay,
      teachesP5ByDay: member.teachesP5ByDay,
      breakDutyCount: counts.get(member.staffCode)?.breakDutyCount ?? 0,
      lunchDutyCount: counts.get(member.staffCode)?.lunchDutyCount ?? 0,
      totalDutyCount: counts.get(member.staffCode)?.totalDutyCount ?? 0,
    })),
    logic: {
      minimumExpectation: "Every eligible staff member should receive at least one Breaktime duty and one Lunch duty if slots allow.",
      lunchDefinition: "Lunch A and Lunch B both count as lunch duty.",
      p2Preference: "Breaktime duties prefer staff who do not teach P2 on the same day.",
      p5Preference: "Lunch duties prefer staff who do not teach P5 on the same day.",
      workloadRule: "Remaining duties favour lower effective-load staff, where effectiveLoad = teachingLoad + manualLoadAdjustment.",
      leadershipRule: "Leadership staff receive minimum expected duties, then are deprioritised for extra duties.",
      tutorRule: "Tutor status counts lightly as workload weighting.",
      scoringConstants: DUTY_SCHEDULER_SCORING_CONSTANTS,
    },
    summary: {
      totalDuties: summary.totalDuties,
      staffConsidered: summary.staffConsidered,
      staffWithNoBreakDuty: summary.staffWithNoBreakDuty.map(staffDisplay),
      staffWithNoLunchDuty: summary.staffWithNoLunchDuty.map(staffDisplay),
      leadershipStaffWithExtraDuties: summary.leadershipStaffWithExtraDuties.map(staffDisplay),
      warnings: summary.warnings,
    },
  };
}
function validateImportJson(value: unknown): ImportValidationResult {
  if (!value || typeof value !== "object") return { ok: false, error: "The imported file must contain a JSON object." };
  const data = value as DutySchedulerExport;
  if (data.exportType !== EXPORT_TYPE || ![1, 2].includes(Number(data.version))) return { ok: false, error: `Expected ${EXPORT_TYPE} version 1 or 2.` };
  if (!Array.isArray(data.dutyDefinitions) || !Array.isArray(data.assignments)) return { ok: false, error: "The JSON must include dutyDefinitions and assignments arrays." };
  for (const definition of data.dutyDefinitions) {
    if (!definition || typeof definition.id !== "string" || typeof definition.description !== "string" || !isDutyTime(definition.time)) return { ok: false, error: "Each duty definition must include id, description and a valid time." };
  }
  for (const assignment of data.assignments) {
    if (!assignment || !isSchoolDay(assignment.day) || !isDutyTime(assignment.time) || typeof assignment.description !== "string" || typeof assignment.assignedStaffCode !== "string") return { ok: false, error: "Each assignment must include day, time, description and assignedStaffCode." };
  }
  return { ok: true, data };
}
function escapeXml(value: unknown) { return String(value ?? "").replace(/[<>&'"]/g, character => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", "\"": "&quot;" })[character]!); }
function worksheetXml(name: string, rows: unknown[][]) { return `<Worksheet ss:Name="${escapeXml(name)}"><Table>${rows.map(row => `<Row>${row.map(cell => `<Cell><Data ss:Type="String">${escapeXml(cell)}</Data></Cell>`).join("")}</Row>`).join("")}</Table></Worksheet>`; }
function buildExcelXml(payload: DutySchedulerExport) {
  const days = DUTY_SCHOOL_DAYS;
  const assignmentRows = [["Day", "Time", "Description", "Assigned staff", "Staff code"], ...payload.assignments.map(assignment => [assignment.day, assignment.time, assignment.description, assignment.assignedStaffName, assignment.assignedStaffCode])];
  const staffRows = [["Staff name", "Staff code", "Teaching load", "Manual load adjustment", "Effective load", "Tutor", "Leadership", "Break duties", "Lunch duties", "Total duties", ...days.map(day => `Teaches P2 ${day}`), ...days.map(day => `Teaches P5 ${day}`)], ...payload.staff.map(member => [member.staffName, member.staffCode, member.teachingLoad, member.manualLoadAdjustment ?? 0, member.effectiveLoad ?? member.teachingLoad, member.isTutor ? "Yes" : "No", member.isLeadership ? "Yes" : "No", member.breakDutyCount, member.lunchDutyCount, member.totalDutyCount, ...days.map(day => member.teachesP2ByDay[day] ? "Yes" : "No"), ...days.map(day => member.teachesP5ByDay[day] ? "Yes" : "No")])];
  const warningRows = [["Warning"], ...(payload.summary.warnings.length ? payload.summary.warnings : ["No warnings for the current proposed assignments."]).map(warning => [warning])];
  return `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">${worksheetXml("Duty Assignments", assignmentRows)}${worksheetXml("Staff Summary", staffRows)}${worksheetXml("Warnings Notes", warningRows)}</Workbook>`;
}


export function DutySchedulerForm({ timetable, initialSchedules }: { timetable: SavedTimetableImport; initialSchedules: SavedDutySchedule[] }) {
  const activeSavedSchedule = useMemo(() => initialSchedules.find(schedule => schedule.isActive) ?? null, [initialSchedules]);
  const loadedPayload = activeSavedSchedule?.scheduleJson && validateImportJson(activeSavedSchedule.scheduleJson).ok ? (activeSavedSchedule.scheduleJson as DutySchedulerExport) : null;
  const [manualLoadAdjustments, setManualLoadAdjustments] = useState<Record<string, number>>(() => manualAdjustmentsFromPayload(loadedPayload));
  const staff = useMemo(() => getDutySchedulerStaff(timetable.analysis, manualLoadAdjustments), [timetable.analysis, manualLoadAdjustments]);
  const p2Counts = useMemo(() => countStaffTeachingPeriodByDay(staff, "P2"), [staff]);
  const p5Counts = useMemo(() => countStaffTeachingPeriodByDay(staff, "P5"), [staff]);
  const validStaffCodes = useMemo(() => new Set(staff.map(member => member.staffCode)), [staff]);
  const [definitions, setDefinitions] = useState<DutyDefinitionRow[]>(() => loadedPayload?.dutyDefinitions.map(definition => ({ id: definition.id, description: definition.description, time: definition.time })) ?? [newDuty(1)]);
  const [assignments, setAssignments] = useState<DutyAssignmentSlot[]>(() => loadedPayload ? loadedPayload.assignments.map(assignment => ({ id: assignment.dutyDefinitionId || `saved-${assignment.slotId}`, slotId: assignment.slotId || `${assignment.dutyDefinitionId}-${assignment.day}`, day: assignment.day, time: assignment.time, description: assignment.description, assignedStaffCode: validStaffCodes.has(assignment.assignedStaffCode) ? assignment.assignedStaffCode : "" })) : []);
  const [savedSchedules, setSavedSchedules] = useState<SavedDutySchedule[]>(initialSchedules);
  const [viewingSchedule, setViewingSchedule] = useState<ViewingSchedule | null>(activeSavedSchedule);
  const [scheduleName, setScheduleName] = useState(activeSavedSchedule?.name ?? `${timetable.name} duties`);
  const [dirty, setDirty] = useState(false);
  const [saveAsActive, setSaveAsActive] = useState(activeSavedSchedule?.isActive ?? false);
  const [isSaving, setIsSaving] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState<string | null>(activeSavedSchedule ? `Loaded active duty schedule: ${activeSavedSchedule.name}.` : null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const expandedAssignments = useMemo(() => expandDutyDefinitions(definitions, assignments), [definitions, assignments]);
  const summary = useMemo(() => summariseManualSchedule(expandedAssignments, staff), [expandedAssignments, staff]);

  function addDuty() { setDefinitions(current => [...current, newDuty(current.length + 1)]); markEdited(); setScheduleMessage(null); }
  function removeDuty(id: string) { setDefinitions(current => current.length === 1 ? current : current.filter(duty => duty.id !== id)); setAssignments(current => current.filter(slot => slot.id !== id)); markEdited(); setScheduleMessage(null); }
  function clearAssignments() { setAssignments(current => current.map(duty => ({ ...duty, assignedStaffCode: "" }))); markEdited(); setScheduleMessage("Assignments cleared. Duty definitions have been kept for editing."); }
  function updateDuty(id: string, patch: Partial<DutyDefinitionRow>) { setDefinitions(current => current.map(duty => duty.id === id ? { ...duty, ...patch } : duty)); markEdited(); setScheduleMessage(null); }
  function hasSameTimeConflict(slot: DutyAssignmentSlot, assignedStaffCode: string) { return !!assignedStaffCode && expandedAssignments.some(other => other.slotId !== slot.slotId && other.day === slot.day && other.time === slot.time && other.assignedStaffCode === assignedStaffCode); }
  function updateManualLoadAdjustment(staffCode: string, adjustment: number) { setManualLoadAdjustments(current => ({ ...current, [staffCode]: Number.isFinite(adjustment) ? adjustment : 0 })); markEdited(); setScheduleMessage(null); }
  function updateAssignment(slotId: string, assignedStaffCode: string) {
    const slot = expandedAssignments.find(item => item.slotId === slotId);
    if (slot && hasSameTimeConflict(slot, assignedStaffCode)) { setScheduleMessage(`Manual assignment blocked: that staff member already has another ${slot.day} ${slot.time} duty.`); return; }
    setAssignments(current => expandDutyDefinitions(definitions, current).map(item => item.slotId === slotId ? { ...item, assignedStaffCode } : item)); markEdited(); setScheduleMessage(null);
  }
  function runScheduler() { const result = autoScheduleDuties(expandDutyDefinitions(definitions, assignments), staff); setAssignments(result.duties); markEdited(); setScheduleMessage(result.summary.warnings.length ? "Auto-schedule completed with warnings. Review the summary before relying on it." : "Auto-schedule completed. Review the proposed assignments before relying on them."); }
  function currentExportPayload() { return buildExportPayload(timetable, definitions, expandedAssignments, staff, summary); }
  function markEdited() { setDirty(true); }
  function applyImportedSchedule(imported: DutySchedulerExport, sourceLabel: string, saved?: ViewingSchedule) {
    const activeSourceId = String(timetable.id);
    const importedSourceId = imported.sourceTimetable?.id ? String(imported.sourceTimetable.id) : "";
    const timetableWarning = importedSourceId && importedSourceId !== activeSourceId ? ` Source timetable (${imported.sourceTimetable.name || importedSourceId}) differs from the active timetable (${timetable.name}).` : "";
    const invalidCodes = [...new Set(imported.assignments.map(assignment => assignment.assignedStaffCode).filter(code => code && !validStaffCodes.has(code)))];
    const nextDefinitions = imported.dutyDefinitions.map(definition => ({ id: definition.id, description: definition.description, time: definition.time }));
    const definitionById = new Map(nextDefinitions.map(definition => [definition.id, definition]));
    const nextAssignments = imported.assignments.map(assignment => {
      const definition = definitionById.get(assignment.dutyDefinitionId || "") ?? nextDefinitions.find(item => item.description === assignment.description && item.time === assignment.time);
      const id = definition?.id ?? `imported-${assignment.slotId || `${assignment.day}-${assignment.time}-${assignment.description}`}`;
      return { id, slotId: assignment.slotId || `${id}-${assignment.day}`, day: assignment.day, time: assignment.time, description: assignment.description, assignedStaffCode: validStaffCodes.has(assignment.assignedStaffCode) ? assignment.assignedStaffCode : "" };
    });
    setDefinitions(nextDefinitions.length ? nextDefinitions : [{ id: `imported-duty-${Date.now()}`, description: "", time: "Breaktime" }]);
    setAssignments(nextAssignments);
    setManualLoadAdjustments(manualAdjustmentsFromPayload(imported));
    setViewingSchedule(saved ?? null);
    if (saved) { setScheduleName(saved.name); setSaveAsActive(saved.isActive); }
    setDirty(!saved);
    setScheduleMessage(`${sourceLabel} ${nextAssignments.length} duty assignment slot(s).${invalidCodes.length ? ` Cleared unknown staff code(s): ${invalidCodes.join(", ")}.` : ""}${timetableWarning}`);
  }
  async function saveCurrentSchedule() {
    setIsSaving(true);
    const result = await saveDutySchedule({ id: viewingSchedule?.id, name: scheduleName, isActive: saveAsActive, sourceTimetableImportId: timetable.id, sourceTimetableName: timetable.name, scheduleJson: currentExportPayload() });
    setIsSaving(false);
    if (!result.ok) { setScheduleMessage(`Save failed: ${result.error}`); return; }
    setViewingSchedule(result.schedule);
    setDirty(false);
    setSaveAsActive(result.schedule.isActive);
    setSavedSchedules(current => [result.schedule, ...current.filter(schedule => schedule.id !== result.schedule.id)].map(schedule => ({ ...schedule, isActive: result.schedule.isActive ? schedule.id === result.schedule.id : schedule.isActive })));
    setScheduleMessage(`Saved duty schedule: ${result.schedule.name}${result.schedule.isActive ? " and marked it active." : "."}`);
  }
  function loadSavedSchedule(scheduleId: string) {
    const saved = savedSchedules.find(schedule => String(schedule.id) === scheduleId);
    if (!saved) return;
    const validation = validateImportJson(saved.scheduleJson);
    if (!validation.ok) { setScheduleMessage(`Could not load saved schedule: ${validation.error}`); return; }
    applyImportedSchedule(validation.data, `Loaded saved duty schedule: ${saved.name}.`, saved);
  }
  function exportJson() { downloadTextFile(`${safeFilenamePart(timetable.name)}-duty-scheduler.json`, JSON.stringify(currentExportPayload(), null, 2), "application/json"); }
  function exportExcel() { downloadTextFile(`${safeFilenamePart(timetable.name)}-duty-scheduler.xls`, buildExcelXml(currentExportPayload()), "application/vnd.ms-excel"); }
  async function importJsonFile(file: File) {
    let parsed: unknown;
    try { parsed = JSON.parse(await file.text()); } catch { setScheduleMessage("Import failed: the selected file is not valid JSON."); return; }
    const validation = validateImportJson(parsed);
    if (!validation.ok) { setScheduleMessage(`Import failed: ${validation.error}`); return; }
    if (!window.confirm("Importing this JSON will overwrite all current duty definitions and assignments. Continue?")) return;
    applyImportedSchedule(validation.data, "Imported", undefined);
  }

  return <div className="mt-8 grid gap-8">
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Active saved timetable</p><h2 className="mt-2 text-2xl font-bold text-slate-950">{timetable.name}</h2><p className="mt-2 text-sm text-slate-600">Source: <span className="font-semibold">{timetable.sourceFilename}</span> · Updated {new Date(timetable.updatedAt).toLocaleString()}</p></div><div className="grid gap-3 text-sm sm:grid-cols-3"><div className="rounded-2xl bg-slate-50 p-4"><p className="font-bold text-slate-500">Staff considered</p><p className="mt-1 text-2xl font-black text-slate-950">{staff.length}</p></div><div className="rounded-2xl bg-slate-50 p-4"><p className="font-bold text-slate-500">P2 teachers by day</p><p className="mt-1 text-xs font-bold text-slate-950">{dayCountsText(p2Counts)}</p></div><div className="rounded-2xl bg-slate-50 p-4"><p className="font-bold text-slate-500">P5 teachers by day</p><p className="mt-1 text-xs font-bold text-slate-950">{dayCountsText(p5Counts)}</p></div></div></div><p className="mt-4 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-900">This scheduler uses only the active saved timetable staff rows, including saved Tutor/Leadership edits and excluding staff removed before saving. Each duty definition below expands into Monday-Friday assignment slots, and Breaktime/Lunch preferences check P2/P5 on the same day as the slot.</p></section>

    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Duty schedule persistence</p><h2 className="mt-2 text-2xl font-bold text-slate-950">{viewingSchedule ? viewingSchedule.name : "Unsaved draft"}</h2><p className="mt-2 text-sm font-semibold text-slate-700">Status: {viewingSchedule ? `${viewingSchedule.isActive ? "Active/current schedule" : "Saved schedule"}${dirty ? " with unsaved edits" : ""}` : "Unsaved draft"}</p>{viewingSchedule && viewingSchedule.sourceTimetableImportId !== timetable.id ? <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">This saved schedule was created from {viewingSchedule.sourceTimetableName ?? "another timetable"}. The active timetable is now {timetable.name}; unknown staff assignments are cleared when loaded.</p> : null}</div><div className="grid gap-3 sm:min-w-[24rem]"><label className="text-sm font-bold text-slate-700">Schedule name<input value={scheduleName} onChange={event => { setScheduleName(event.target.value); markEdited(); }} className="mt-1 w-full rounded-2xl border border-slate-300 px-3 py-2 font-normal" /></label><label className="flex items-center gap-2 text-sm font-bold text-slate-700"><input type="checkbox" checked={saveAsActive} onChange={event => { setSaveAsActive(event.target.checked); markEdited(); }} /> Mark as active/current</label><div className="flex flex-wrap gap-2"><button type="button" onClick={saveCurrentSchedule} disabled={isSaving} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50">{isSaving ? "Saving…" : "Save duty schedule"}</button>{savedSchedules.length ? <select value={viewingSchedule?.id ?? ""} onChange={event => loadSavedSchedule(event.target.value)} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700"><option value="">Load saved…</option>{savedSchedules.map(schedule => <option key={schedule.id} value={schedule.id}>{schedule.isActive ? "Active: " : ""}{schedule.name}</option>)}</select> : null}</div></div></div></section>

    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Staff workload adjustments</p><h2 className="mt-2 text-2xl font-bold text-slate-950">Manual load adjustments</h2><p className="mt-2 text-sm text-slate-600">Use this to account for non-teaching workload. The scheduler weights staff by effective load = teaching load + manual adjustment.</p><div className="mt-5 overflow-auto rounded-2xl border border-slate-200"><table className="min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-500"><tr><th className="px-4 py-3">Staff</th><th className="px-4 py-3">Teaching load</th><th className="px-4 py-3">Manual adjustment</th><th className="px-4 py-3">Effective load</th></tr></thead><tbody>{staff.map(member => <tr key={member.staffCode} className="border-t border-slate-100"><td className="px-4 py-3 font-semibold text-slate-900">{staffDisplay(member)}</td><td className="px-4 py-3">{member.teachingLessonCount}</td><td className="px-4 py-3"><div className="flex items-center gap-2"><button type="button" onClick={() => updateManualLoadAdjustment(member.staffCode, member.manualLoadAdjustment - 1)} className="rounded-full border border-slate-300 px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50">−</button><input type="number" value={member.manualLoadAdjustment} onChange={event => updateManualLoadAdjustment(member.staffCode, Number(event.target.value))} className="w-24 rounded-2xl border border-slate-300 px-3 py-2" /><button type="button" onClick={() => updateManualLoadAdjustment(member.staffCode, member.manualLoadAdjustment + 1)} className="rounded-full border border-slate-300 px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50">+</button></div></td><td className="px-4 py-3 font-bold text-slate-950">{member.effectiveLoad}</td></tr>)}</tbody></table></div></section>

    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Duty definition table</p><h2 className="mt-2 text-2xl font-bold text-slate-950">Define repeating duties</h2><p className="mt-2 text-sm text-slate-600">Add each duty once. The scheduler automatically creates Monday-Friday assignment slots.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={addDuty} className="rounded-full bg-amber-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-400">+ Add duty</button><button type="button" onClick={runScheduler} disabled={!staff.length || !definitions.length} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">Auto-schedule duties</button><button type="button" onClick={clearAssignments} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Clear assignments</button><button type="button" onClick={exportJson} className="rounded-full border border-sky-300 px-4 py-2 text-sm font-bold text-sky-800 hover:bg-sky-50">Export JSON</button><button type="button" onClick={exportExcel} className="rounded-full border border-emerald-300 px-4 py-2 text-sm font-bold text-emerald-800 hover:bg-emerald-50">Export Excel</button><button type="button" onClick={() => importInputRef.current?.click()} className="rounded-full border border-purple-300 px-4 py-2 text-sm font-bold text-purple-800 hover:bg-purple-50">Import JSON</button><input ref={importInputRef} type="file" accept="application/json,.json" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) void importJsonFile(file); event.target.value = ""; }} /></div></div>{scheduleMessage ? <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{scheduleMessage}</p> : null}<div className="mt-5 overflow-auto rounded-2xl border border-slate-200"><table className="min-w-[720px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-500"><tr><th className="px-4 py-3">Description</th><th className="px-4 py-3">Time</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody>{definitions.map((duty, index) => <tr key={duty.id} className="border-t border-slate-100"><td className="px-4 py-3"><input value={duty.description} onChange={event => updateDuty(duty.id, { description: event.target.value })} placeholder={`Duty ${index + 1} location/description`} className="w-full rounded-2xl border border-slate-300 px-3 py-2" /></td><td className="px-4 py-3"><select value={duty.time} onChange={event => updateDuty(duty.id, { time: event.target.value as DutyTime })} className="w-full rounded-2xl border border-slate-300 px-3 py-2">{DUTY_TIME_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}</select></td><td className="px-4 py-3 text-right"><button type="button" onClick={() => removeDuty(duty.id)} disabled={definitions.length === 1} className="rounded-full border border-rose-200 px-3 py-1 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40">Remove</button></td></tr>)}</tbody></table></div></section>

    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Generated assignment view</p><h2 className="mt-2 text-2xl font-bold text-slate-950">Monday-Friday duty slots</h2><div className="mt-5 overflow-auto rounded-2xl border border-slate-200"><table className="min-w-[1000px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-500"><tr><th className="px-4 py-3">Day</th><th className="px-4 py-3">Time</th><th className="px-4 py-3">Description</th><th className="px-4 py-3">Assigned staff</th></tr></thead><tbody>{expandedAssignments.map(slot => <tr key={slot.slotId} className="border-t border-slate-100"><td className="px-4 py-3 font-semibold text-slate-900">{slot.day}</td><td className="px-4 py-3">{slot.time}</td><td className="px-4 py-3">{slot.description || "—"}</td><td className="px-4 py-3"><select value={slot.assignedStaffCode} onChange={event => updateAssignment(slot.slotId, event.target.value)} className="w-full rounded-2xl border border-slate-300 px-3 py-2"><option value="">Unassigned</option>{staff.map(member => { const blocked = hasSameTimeConflict(slot, member.staffCode); return <option key={member.staffCode} value={member.staffCode} disabled={blocked}>{staffDisplay(member)} · effective load {member.effectiveLoad} (teaching {member.teachingLessonCount}, manual {member.manualLoadAdjustment}){blocked ? " · already assigned at this time" : ""}{member.isLeadership ? " · leadership" : ""}{member.isTutor ? " · tutor" : ""}</option>; })}</select></td></tr>)}</tbody></table></div></section>

    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Review summary</p><h2 className="mt-2 text-2xl font-bold text-slate-950">Proposed schedule checks</h2><div className="mt-5 grid gap-4 md:grid-cols-5"><div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase text-slate-500">Slots</p><p className="mt-1 text-3xl font-black">{summary.totalDuties}</p></div><div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase text-slate-500">Staff</p><p className="mt-1 text-3xl font-black">{summary.staffConsidered}</p></div><div className="rounded-2xl bg-amber-50 p-4"><p className="text-xs font-bold uppercase text-amber-700">No break</p><p className="mt-1 text-3xl font-black">{summary.staffWithNoBreakDuty.length}</p></div><div className="rounded-2xl bg-amber-50 p-4"><p className="text-xs font-bold uppercase text-amber-700">No lunch</p><p className="mt-1 text-3xl font-black">{summary.staffWithNoLunchDuty.length}</p></div><div className="rounded-2xl bg-purple-50 p-4"><p className="text-xs font-bold uppercase text-purple-700">Leadership extra</p><p className="mt-1 text-3xl font-black">{summary.leadershipStaffWithExtraDuties.length}</p></div></div><div className="mt-5 grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-slate-200 p-4"><h3 className="font-bold text-slate-950">Minimum expectation gaps</h3><p className="mt-2 text-sm text-slate-700"><span className="font-semibold">No Breaktime duty:</span> {names(summary.staffWithNoBreakDuty)}</p><p className="mt-2 text-sm text-slate-700"><span className="font-semibold">No Lunch duty:</span> {names(summary.staffWithNoLunchDuty)}</p><p className="mt-2 text-sm text-slate-700"><span className="font-semibold">Leadership with extra duties:</span> {names(summary.leadershipStaffWithExtraDuties)}</p></div><div className="rounded-2xl border border-slate-200 p-4"><h3 className="font-bold text-slate-950">Warnings / review notes</h3>{summary.warnings.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm font-medium text-amber-800">{summary.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul> : <p className="mt-2 text-sm font-medium text-emerald-700">No warnings for the current proposed assignments.</p>}</div></div></section>
  </div>;
}
