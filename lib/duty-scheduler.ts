import type { ParsedLessonEntry, StaffSummary, TimetableAnalysis } from "./timetable-analyser";

export const DUTY_TIME_OPTIONS = ["Breaktime", "Lunch A", "Lunch B"] as const;
export const DUTY_SCHOOL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;
export type DutyTime = (typeof DUTY_TIME_OPTIONS)[number];
export type DutySchoolDay = (typeof DUTY_SCHOOL_DAYS)[number];
export type DutyDefinitionRow = { id: string; description: string; time: DutyTime };
export type DutyAssignmentSlot = DutyDefinitionRow & { slotId: string; day: DutySchoolDay; assignedStaffCode: string };
export type DutyRow = DutyAssignmentSlot;
export type DutySchedulerStaff = StaffSummary & { teachesP2ByDay: Record<DutySchoolDay, boolean>; teachesP5ByDay: Record<DutySchoolDay, boolean> };
export type DutyScheduleSummary = { totalDuties: number; staffConsidered: number; staffWithNoBreakDuty: DutySchedulerStaff[]; staffWithNoLunchDuty: DutySchedulerStaff[]; leadershipStaffWithExtraDuties: DutySchedulerStaff[]; warnings: string[] };
export type DutyScheduleResult = { duties: DutyAssignmentSlot[]; summary: DutyScheduleSummary };

type AssignmentState = { total: number; breakCount: number; lunchCount: number };

function isLunchDuty(time: DutyTime) { return time === "Lunch A" || time === "Lunch B"; }
function staffLabel(staff: StaffSummary) { return `${staff.staffName} (${staff.staffCode})`; }
function emptyCountMap() { return Object.fromEntries(DUTY_SCHOOL_DAYS.map(day => [day, 0])) as Record<DutySchoolDay, number>; }
function teachesPeriodOnDay(entries: ParsedLessonEntry[], staffCode: string, day: DutySchoolDay, period: "P2" | "P5") { return entries.some(entry => entry.staffCode === staffCode && entry.day === day && entry.period === period && entry.isTeachingLesson); }
function preferencePeriod(time: DutyTime) { return time === "Breaktime" ? "P2" : "P5"; }
function hasPreferredFreePeriod(staff: DutySchedulerStaff, duty: DutyAssignmentSlot) { return duty.time === "Breaktime" ? !staff.teachesP2ByDay[duty.day] : !staff.teachesP5ByDay[duty.day]; }

export function expandDutyDefinitions(definitions: DutyDefinitionRow[], existingAssignments: DutyAssignmentSlot[] = []): DutyAssignmentSlot[] {
  const assignedBySlotId = new Map(existingAssignments.map(slot => [slot.slotId, slot.assignedStaffCode]));
  return definitions.flatMap(definition => DUTY_SCHOOL_DAYS.map(day => {
    const slotId = `${definition.id}-${day}`;
    return { ...definition, slotId, day, assignedStaffCode: assignedBySlotId.get(slotId) ?? "" };
  }));
}

export function getDutySchedulerStaff(analysis: TimetableAnalysis): DutySchedulerStaff[] {
  return [...analysis.staff]
    .sort((a, b) => a.staffName.localeCompare(b.staffName, undefined, { numeric: true, sensitivity: "base" }))
    .map(staff => ({
      ...staff,
      teachesP2ByDay: Object.fromEntries(DUTY_SCHOOL_DAYS.map(day => [day, teachesPeriodOnDay(analysis.parsedLessons, staff.staffCode, day, "P2")])) as Record<DutySchoolDay, boolean>,
      teachesP5ByDay: Object.fromEntries(DUTY_SCHOOL_DAYS.map(day => [day, teachesPeriodOnDay(analysis.parsedLessons, staff.staffCode, day, "P5")])) as Record<DutySchoolDay, boolean>,
    }));
}

export function countStaffTeachingPeriodByDay(staff: DutySchedulerStaff[], period: "P2" | "P5") {
  const counts = emptyCountMap();
  for (const member of staff) for (const day of DUTY_SCHOOL_DAYS) if (period === "P2" ? member.teachesP2ByDay[day] : member.teachesP5ByDay[day]) counts[day] += 1;
  return counts;
}

function initialState(staff: DutySchedulerStaff[]) {
  return new Map(staff.map(member => [member.staffCode, { total: 0, breakCount: 0, lunchCount: 0 } satisfies AssignmentState]));
}

function scoreCandidate(staff: DutySchedulerStaff, duty: DutyAssignmentSlot, state: AssignmentState, slotsAllowMinimum: boolean) {
  const isLunch = isLunchDuty(duty.time);
  const hasMinimumForType = isLunch ? state.lunchCount > 0 : state.breakCount > 0;
  const hasBothMinimums = state.breakCount > 0 && state.lunchCount > 0;
  let score = 0;

  score += state.total * 140;
  score += staff.teachingLessonCount * 4;
  if (staff.isTutor) score += 6;
  if (hasMinimumForType) score += slotsAllowMinimum ? 900 : 80;
  if (!hasMinimumForType) score -= slotsAllowMinimum ? 900 : 120;
  if (staff.isLeadership && hasBothMinimums) score += 650;
  if (!hasPreferredFreePeriod(staff, duty)) score += 90;
  return score;
}

function buildSummary(duties: DutyAssignmentSlot[], staff: DutySchedulerStaff[], warnings: string[]): DutyScheduleSummary {
  const counts = initialState(staff);
  for (const duty of duties) {
    if (!duty.assignedStaffCode) continue;
    const state = counts.get(duty.assignedStaffCode);
    if (!state) continue;
    state.total += 1;
    if (duty.time === "Breaktime") state.breakCount += 1;
    else state.lunchCount += 1;
  }
  const staffWithNoBreakDuty = staff.filter(member => (counts.get(member.staffCode)?.breakCount ?? 0) === 0);
  const staffWithNoLunchDuty = staff.filter(member => (counts.get(member.staffCode)?.lunchCount ?? 0) === 0);
  const leadershipStaffWithExtraDuties = staff.filter(member => member.isLeadership && (counts.get(member.staffCode)?.total ?? 0) > 2);
  if (staff.length && duties.filter(d => d.time === "Breaktime").length < staff.length) warnings.push("There are fewer Breaktime duty slots than eligible staff, so not every staff member can receive a Breaktime duty.");
  if (staff.length && duties.filter(d => isLunchDuty(d.time)).length < staff.length) warnings.push("There are fewer Lunch duty slots than eligible staff, so not every staff member can receive a Lunch duty.");
  if (staffWithNoBreakDuty.length) warnings.push(`${staffWithNoBreakDuty.length} staff member(s) currently have no Breaktime duty.`);
  if (staffWithNoLunchDuty.length) warnings.push(`${staffWithNoLunchDuty.length} staff member(s) currently have no Lunch duty.`);
  if (leadershipStaffWithExtraDuties.length) warnings.push(`${leadershipStaffWithExtraDuties.length} leadership staff member(s) have more than the two minimum expected duties.`);
  return { totalDuties: duties.length, staffConsidered: staff.length, staffWithNoBreakDuty, staffWithNoLunchDuty, leadershipStaffWithExtraDuties, warnings: [...new Set(warnings)] };
}

export function autoScheduleDuties(duties: DutyAssignmentSlot[], staff: DutySchedulerStaff[]): DutyScheduleResult {
  const warnings: string[] = [];
  if (!staff.length) return { duties: duties.map(duty => ({ ...duty, assignedStaffCode: "" })), summary: buildSummary(duties, staff, ["No eligible staff were found in the active saved timetable."]) };
  const scheduled = duties.map(duty => ({ ...duty, assignedStaffCode: "" }));
  const counts = initialState(staff);
  const breakSlotsAllowMinimum = scheduled.filter(duty => duty.time === "Breaktime").length >= staff.length;
  const lunchSlotsAllowMinimum = scheduled.filter(duty => isLunchDuty(duty.time)).length >= staff.length;

  for (const duty of scheduled) {
    const slotsAllowMinimum = duty.time === "Breaktime" ? breakSlotsAllowMinimum : lunchSlotsAllowMinimum;
    const ranked = staff.map(member => ({ member, score: scoreCandidate(member, duty, counts.get(member.staffCode)!, slotsAllowMinimum) }))
      .sort((a, b) => a.score - b.score || a.member.teachingLessonCount - b.member.teachingLessonCount || a.member.staffName.localeCompare(b.member.staffName));
    const selected = ranked[0]?.member;
    if (!selected) { warnings.push(`Could not assign ${duty.day} ${duty.time} duty "${duty.description || duty.time}".`); continue; }
    duty.assignedStaffCode = selected.staffCode;
    const state = counts.get(selected.staffCode)!;
    state.total += 1;
    if (duty.time === "Breaktime") state.breakCount += 1; else state.lunchCount += 1;
    if (!hasPreferredFreePeriod(selected, duty)) warnings.push(`${staffLabel(selected)} was assigned ${duty.day} ${duty.time} despite teaching ${duty.day} ${preferencePeriod(duty.time)} because the scheduler could not find a better weighted option.`);
  }
  return { duties: scheduled, summary: buildSummary(scheduled, staff, warnings) };
}

export function summariseManualSchedule(duties: DutyAssignmentSlot[], staff: DutySchedulerStaff[]) { return buildSummary(duties, staff, []); }
