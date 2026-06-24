import type { ParsedLessonEntry, StaffSummary, TimetableAnalysis } from "./timetable-analyser";

export const DUTY_TIME_OPTIONS = ["Breaktime", "Lunch A", "Lunch B"] as const;
export const DUTY_SCHOOL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;
export type DutyTime = (typeof DUTY_TIME_OPTIONS)[number];
export type DutySchoolDay = (typeof DUTY_SCHOOL_DAYS)[number];
export type DutyDefinitionRow = { id: string; description: string; time: DutyTime };
export type DutyAssignmentSlot = DutyDefinitionRow & { slotId: string; day: DutySchoolDay; assignedStaffCode: string };
export type DutyRow = DutyAssignmentSlot;
export type DutySchedulerStaff = StaffSummary & { manualLoadAdjustment: number; effectiveLoad: number; teachesP2ByDay: Record<DutySchoolDay, boolean>; teachesP5ByDay: Record<DutySchoolDay, boolean> };
export type DutyScheduleSummary = { totalDuties: number; staffConsidered: number; staffWithNoBreakDuty: DutySchedulerStaff[]; staffWithNoLunchDuty: DutySchedulerStaff[]; leadershipStaffWithExtraDuties: DutySchedulerStaff[]; warnings: string[] };
export type DutyScheduleResult = { duties: DutyAssignmentSlot[]; summary: DutyScheduleSummary };

type AssignmentState = { total: number; breakCount: number; lunchCount: number };

export const DUTY_SCHEDULER_SCORING_CONSTANTS = {
  existingDutyPenalty: 140,
  teachingLessonLoadPenalty: 4,
  tutorPenalty: 6,
  repeatDutyTypePenaltyWhenMinimumSlotsAllow: 900,
  repeatDutyTypePenaltyWhenMinimumSlotsDoNotAllow: 80,
  missingDutyTypeBonusWhenMinimumSlotsAllow: -900,
  missingDutyTypeBonusWhenMinimumSlotsDoNotAllow: -120,
  leadershipExtraDutyPenalty: 650,
  p2OrP5PreferenceBreachPenalty: 320,
} as const;

function isLunchDuty(time: DutyTime) { return time === "Lunch A" || time === "Lunch B"; }
function staffLabel(staff: StaffSummary) { return `${staff.staffName} (${staff.staffCode})`; }
function emptyCountMap() { return Object.fromEntries(DUTY_SCHOOL_DAYS.map(day => [day, 0])) as Record<DutySchoolDay, number>; }
function teachesPeriodOnDay(entries: ParsedLessonEntry[], staffCode: string, day: DutySchoolDay, period: "P2" | "P5") { return entries.some(entry => entry.staffCode === staffCode && entry.day === day && entry.period === period && entry.isTeachingLesson); }
function preferencePeriod(time: DutyTime) { return time === "Breaktime" ? "P2" : "P5"; }
function hasPreferredFreePeriod(staff: DutySchedulerStaff, duty: DutyAssignmentSlot) { return duty.time === "Breaktime" ? !staff.teachesP2ByDay[duty.day] : !staff.teachesP5ByDay[duty.day]; }
function sameTimeKey(duty: Pick<DutyAssignmentSlot, "day" | "time">) { return `${duty.day} ${duty.time}`; }

export function expandDutyDefinitions(definitions: DutyDefinitionRow[], existingAssignments: DutyAssignmentSlot[] = []): DutyAssignmentSlot[] {
  const assignedBySlotId = new Map(existingAssignments.map(slot => [slot.slotId, slot.assignedStaffCode]));
  return definitions.flatMap(definition => DUTY_SCHOOL_DAYS.map(day => {
    const slotId = `${definition.id}-${day}`;
    return { ...definition, slotId, day, assignedStaffCode: assignedBySlotId.get(slotId) ?? "" };
  }));
}

export function getDutySchedulerStaff(analysis: TimetableAnalysis, manualLoadAdjustments: Record<string, number> = {}): DutySchedulerStaff[] {
  return [...analysis.staff]
    .sort((a, b) => a.staffName.localeCompare(b.staffName, undefined, { numeric: true, sensitivity: "base" }))
    .map(staff => ({
      ...staff,
      manualLoadAdjustment: manualLoadAdjustments[staff.staffCode] ?? 0,
      effectiveLoad: staff.teachingLessonCount + (manualLoadAdjustments[staff.staffCode] ?? 0),
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

  score += state.total * DUTY_SCHEDULER_SCORING_CONSTANTS.existingDutyPenalty;
  score += staff.effectiveLoad * DUTY_SCHEDULER_SCORING_CONSTANTS.teachingLessonLoadPenalty;
  if (staff.isTutor) score += DUTY_SCHEDULER_SCORING_CONSTANTS.tutorPenalty;
  if (hasMinimumForType) score += slotsAllowMinimum ? DUTY_SCHEDULER_SCORING_CONSTANTS.repeatDutyTypePenaltyWhenMinimumSlotsAllow : DUTY_SCHEDULER_SCORING_CONSTANTS.repeatDutyTypePenaltyWhenMinimumSlotsDoNotAllow;
  if (!hasMinimumForType) score += slotsAllowMinimum ? DUTY_SCHEDULER_SCORING_CONSTANTS.missingDutyTypeBonusWhenMinimumSlotsAllow : DUTY_SCHEDULER_SCORING_CONSTANTS.missingDutyTypeBonusWhenMinimumSlotsDoNotAllow;
  if (staff.isLeadership && hasBothMinimums) score += DUTY_SCHEDULER_SCORING_CONSTANTS.leadershipExtraDutyPenalty;
  if (!hasPreferredFreePeriod(staff, duty)) score += DUTY_SCHEDULER_SCORING_CONSTANTS.p2OrP5PreferenceBreachPenalty;
  return score;
}

function buildSummary(duties: DutyAssignmentSlot[], staff: DutySchedulerStaff[], warnings: string[]): DutyScheduleSummary {
  const staffByCode = new Map(staff.map(member => [member.staffCode, member]));
  const sameTimeAssignments = new Map<string, DutyAssignmentSlot[]>();
  const counts = initialState(staff);
  for (const duty of duties) {
    if (!duty.assignedStaffCode) continue;
    const duplicateKey = `${duty.assignedStaffCode}|${sameTimeKey(duty)}`;
    sameTimeAssignments.set(duplicateKey, [...(sameTimeAssignments.get(duplicateKey) ?? []), duty]);
    const state = counts.get(duty.assignedStaffCode);
    if (!state) continue;
    state.total += 1;
    if (duty.time === "Breaktime") state.breakCount += 1;
    else state.lunchCount += 1;
  }
  const staffWithNoBreakDuty = staff.filter(member => (counts.get(member.staffCode)?.breakCount ?? 0) === 0);
  const staffWithNoLunchDuty = staff.filter(member => (counts.get(member.staffCode)?.lunchCount ?? 0) === 0);
  const leadershipStaffWithExtraDuties = staff.filter(member => member.isLeadership && (counts.get(member.staffCode)?.total ?? 0) > 2);
  for (const [key, duplicates] of sameTimeAssignments) {
    if (duplicates.length < 2) continue;
    const [staffCode, timeKey] = key.split("|");
    const member = staffByCode.get(staffCode);
    warnings.push(`${member ? staffLabel(member) : staffCode} is assigned to ${duplicates.length} duties at the same time (${timeKey}): ${duplicates.map(duty => duty.description || duty.time).join(", ")}.`);
  }
  for (const duty of duties) {
    if (!duty.assignedStaffCode) continue;
    const member = staffByCode.get(duty.assignedStaffCode);
    if (member && !hasPreferredFreePeriod(member, duty)) warnings.push(`${staffLabel(member)} has a ${preferencePeriod(duty.time)} preference breach on ${duty.day} ${duty.time}: they teach ${duty.day} ${preferencePeriod(duty.time)}.`);
  }
  for (const member of staff) {
    const state = counts.get(member.staffCode);
    if (state && member.effectiveLoad <= 2 && state.total >= 3) warnings.push(`${staffLabel(member)} has low effective load (${member.effectiveLoad}) but ${state.total} duties; check whether the manual workload adjustment is correct.`);
  }
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
    const alreadyAssignedAtSameTime = new Set(scheduled.filter(slot => slot.slotId !== duty.slotId && slot.day === duty.day && slot.time === duty.time && slot.assignedStaffCode).map(slot => slot.assignedStaffCode));
    const ranked = staff
      .filter(member => !alreadyAssignedAtSameTime.has(member.staffCode))
      .map(member => ({ member, score: scoreCandidate(member, duty, counts.get(member.staffCode)!, slotsAllowMinimum) }))
      .sort((a, b) => a.score - b.score || a.member.effectiveLoad - b.member.effectiveLoad || a.member.staffName.localeCompare(b.member.staffName));
    const selected = ranked[0]?.member;
    if (!selected) { warnings.push(`Could not assign ${duty.day} ${duty.time} duty "${duty.description || duty.time}" because every eligible staff member was already assigned to another duty at that same time.`); continue; }
    duty.assignedStaffCode = selected.staffCode;
    const state = counts.get(selected.staffCode)!;
    state.total += 1;
    if (duty.time === "Breaktime") state.breakCount += 1; else state.lunchCount += 1;
    if (!hasPreferredFreePeriod(selected, duty)) warnings.push(`${staffLabel(selected)} was assigned ${duty.day} ${duty.time} despite teaching ${duty.day} ${preferencePeriod(duty.time)} because the scheduler could not find a better weighted option.`);
  }
  return { duties: scheduled, summary: buildSummary(scheduled, staff, warnings) };
}

export function summariseManualSchedule(duties: DutyAssignmentSlot[], staff: DutySchedulerStaff[]) { return buildSummary(duties, staff, []); }
