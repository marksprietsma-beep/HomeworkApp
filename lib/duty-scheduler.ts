import type { ParsedLessonEntry, StaffSummary, TimetableAnalysis } from "./timetable-analyser";

export const DUTY_TIME_OPTIONS = ["Breaktime", "Lunch A", "Lunch B"] as const;
export type DutyTime = (typeof DUTY_TIME_OPTIONS)[number];
export type DutyRow = { id: string; description: string; time: DutyTime; assignedStaffCode: string };
export type DutySchedulerStaff = StaffSummary & { teachesP2: boolean; teachesP5: boolean };
export type DutyScheduleSummary = { totalDuties: number; staffConsidered: number; staffWithNoBreakDuty: DutySchedulerStaff[]; staffWithNoLunchDuty: DutySchedulerStaff[]; leadershipStaffWithExtraDuties: DutySchedulerStaff[]; warnings: string[] };
export type DutyScheduleResult = { duties: DutyRow[]; summary: DutyScheduleSummary };

type AssignmentState = { total: number; breakCount: number; lunchCount: number };

function isLunchDuty(time: DutyTime) { return time === "Lunch A" || time === "Lunch B"; }
function staffLabel(staff: StaffSummary) { return `${staff.staffName} (${staff.staffCode})`; }
function teachesPeriod(entries: ParsedLessonEntry[], staffCode: string, period: "P2" | "P5") { return entries.some(entry => entry.staffCode === staffCode && entry.period === period && entry.isTeachingLesson); }

export function getDutySchedulerStaff(analysis: TimetableAnalysis): DutySchedulerStaff[] {
  return [...analysis.staff]
    .sort((a, b) => a.staffName.localeCompare(b.staffName, undefined, { numeric: true, sensitivity: "base" }))
    .map(staff => ({ ...staff, teachesP2: teachesPeriod(analysis.parsedLessons, staff.staffCode, "P2"), teachesP5: teachesPeriod(analysis.parsedLessons, staff.staffCode, "P5") }));
}

function initialState(staff: DutySchedulerStaff[]) {
  return new Map(staff.map(member => [member.staffCode, { total: 0, breakCount: 0, lunchCount: 0 } satisfies AssignmentState]));
}

function scoreCandidate(staff: DutySchedulerStaff, duty: DutyRow, state: AssignmentState, slotsAllowMinimum: boolean) {
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
  if (duty.time === "Breaktime" && staff.teachesP2) score += 90;
  if (isLunch && staff.teachesP5) score += 90;
  return score;
}

function buildSummary(duties: DutyRow[], staff: DutySchedulerStaff[], warnings: string[]): DutyScheduleSummary {
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
  if (staff.length && duties.filter(d => d.time === "Breaktime").length < staff.length) warnings.push("There are fewer Breaktime duties than eligible staff, so not every staff member can receive a Breaktime duty.");
  if (staff.length && duties.filter(d => isLunchDuty(d.time)).length < staff.length) warnings.push("There are fewer Lunch duties than eligible staff, so not every staff member can receive a Lunch duty.");
  if (staffWithNoBreakDuty.length) warnings.push(`${staffWithNoBreakDuty.length} staff member(s) currently have no Breaktime duty.`);
  if (staffWithNoLunchDuty.length) warnings.push(`${staffWithNoLunchDuty.length} staff member(s) currently have no Lunch duty.`);
  if (leadershipStaffWithExtraDuties.length) warnings.push(`${leadershipStaffWithExtraDuties.length} leadership staff member(s) have more than the two minimum expected duties.`);
  return { totalDuties: duties.length, staffConsidered: staff.length, staffWithNoBreakDuty, staffWithNoLunchDuty, leadershipStaffWithExtraDuties, warnings: [...new Set(warnings)] };
}

export function autoScheduleDuties(duties: DutyRow[], staff: DutySchedulerStaff[]): DutyScheduleResult {
  const warnings: string[] = [];
  if (!staff.length) return { duties: duties.map(duty => ({ ...duty, assignedStaffCode: "" })), summary: buildSummary(duties, staff, ["No eligible staff were found in the active timetable."]) };
  const scheduled = duties.map(duty => ({ ...duty, assignedStaffCode: "" }));
  const counts = initialState(staff);
  const breakSlotsAllowMinimum = scheduled.filter(duty => duty.time === "Breaktime").length >= staff.length;
  const lunchSlotsAllowMinimum = scheduled.filter(duty => isLunchDuty(duty.time)).length >= staff.length;

  for (const duty of scheduled) {
    const slotsAllowMinimum = duty.time === "Breaktime" ? breakSlotsAllowMinimum : lunchSlotsAllowMinimum;
    const ranked = staff.map(member => ({ member, score: scoreCandidate(member, duty, counts.get(member.staffCode)!, slotsAllowMinimum) }))
      .sort((a, b) => a.score - b.score || a.member.teachingLessonCount - b.member.teachingLessonCount || a.member.staffName.localeCompare(b.member.staffName));
    const selected = ranked[0]?.member;
    if (!selected) { warnings.push(`Could not assign duty "${duty.description || duty.time}".`); continue; }
    duty.assignedStaffCode = selected.staffCode;
    const state = counts.get(selected.staffCode)!;
    state.total += 1;
    if (duty.time === "Breaktime") state.breakCount += 1; else state.lunchCount += 1;
    if (duty.time === "Breaktime" && selected.teachesP2) warnings.push(`${staffLabel(selected)} was assigned a Breaktime duty despite teaching P2 because the scheduler could not find a better weighted option.`);
    if (isLunchDuty(duty.time) && selected.teachesP5) warnings.push(`${staffLabel(selected)} was assigned a Lunch duty despite teaching P5 because the scheduler could not find a better weighted option.`);
  }
  return { duties: scheduled, summary: buildSummary(scheduled, staff, warnings) };
}

export function summariseManualSchedule(duties: DutyRow[], staff: DutySchedulerStaff[]) { return buildSummary(duties, staff, []); }
