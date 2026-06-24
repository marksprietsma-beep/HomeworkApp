import type { ParsedLessonEntry, StaffSummary, TimetableAnalysis } from "./timetable-analyser";

export const DUTY_TIME_OPTIONS = ["Breaktime", "Lunch A", "Lunch B"] as const;
export const DUTY_SCHOOL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;
export type DutyTime = (typeof DUTY_TIME_OPTIONS)[number];
export type DutySchoolDay = (typeof DUTY_SCHOOL_DAYS)[number];
export type DutyDefinitionRow = { id: string; description: string; time: DutyTime };
export type DutyAssignmentSlot = DutyDefinitionRow & { slotId: string; day: DutySchoolDay; assignedStaffCode: string };
export type DutyRow = DutyAssignmentSlot;
export type DutyTargetReason = "normal-load" | "high-effective-load" | "p5-every-day" | "leadership-moderate-high-load";
export type DutySchedulerStaff = StaffSummary & { manualLoadAdjustment: number; effectiveLoad: number; teachesP2ByDay: Record<DutySchoolDay, boolean>; teachesP5ByDay: Record<DutySchoolDay, boolean>; teachesP5EveryDay: boolean; dutyTarget: number; targetReason: DutyTargetReason };
export type DutyCountDistribution = { "0": number; "1": number; "2": number; "3": number; "4+": number };
export type DutyScheduleSummary = { totalDuties: number; staffConsidered: number; twoDutyMinimumApplies: boolean; dutyCountDistribution: DutyCountDistribution; staffBelowTwoDuties: DutySchedulerStaff[]; staffWithNoBreakDuty: DutySchedulerStaff[]; staffWithNoLunchDuty: DutySchedulerStaff[]; leadershipStaffWithExtraDuties: DutySchedulerStaff[]; staffOverTarget: DutySchedulerStaff[]; staffUnderTarget: DutySchedulerStaff[]; warnings: string[] };
export type DutyScheduleResult = { duties: DutyAssignmentSlot[]; summary: DutyScheduleSummary };

type AssignmentState = { total: number; breakCount: number; lunchCount: number };

export const DUTY_SCHEDULER_SCORING_CONSTANTS = {
  belowTwoDutyMinimumBonus: -4000,
  thirdDutyBeforeFourthPenalty: 2600,
  existingDutyPenalty: 140,
  teachingLessonLoadPenalty: 4,
  tutorPenalty: 6,
  repeatDutyTypePenaltyWhenMinimumSlotsAllow: 900,
  repeatDutyTypePenaltyWhenMinimumSlotsDoNotAllow: 80,
  missingDutyTypeBonusWhenMinimumSlotsAllow: -900,
  missingDutyTypeBonusWhenMinimumSlotsDoNotAllow: -120,
  belowDutyTargetBonus: -1200,
  atOrAboveDutyTargetPenalty: 1800,
  fourthDutyBeforeTargetsMetPenalty: 4200,
  leadershipExtraDutyPenalty: 220,
  p2OrP5PreferenceBreachPenalty: 320,
} as const;

function isLunchDuty(time: DutyTime) { return time === "Lunch A" || time === "Lunch B"; }
function staffLabel(staff: StaffSummary) { return `${staff.staffName} (${staff.staffCode})`; }
function emptyCountMap() { return Object.fromEntries(DUTY_SCHOOL_DAYS.map(day => [day, 0])) as Record<DutySchoolDay, number>; }
function teachesPeriodOnDay(entries: ParsedLessonEntry[], staffCode: string, day: DutySchoolDay, period: "P2" | "P5") { return entries.some(entry => entry.staffCode === staffCode && entry.day === day && entry.period === period && entry.isTeachingLesson); }
function preferencePeriod(time: DutyTime) { return time === "Breaktime" ? "P2" : "P5"; }
function hasPreferredFreePeriod(staff: DutySchedulerStaff, duty: DutyAssignmentSlot) { return duty.time === "Breaktime" ? !staff.teachesP2ByDay[duty.day] : !staff.teachesP5ByDay[duty.day]; }
function sameTimeKey(duty: Pick<DutyAssignmentSlot, "day" | "time">) { return `${duty.day} ${duty.time}`; }
function teachesP5EveryDay(teachesP5ByDay: Record<DutySchoolDay, boolean>) { return DUTY_SCHOOL_DAYS.every(day => teachesP5ByDay[day]); }

export function getStaffDutyTarget(staff: Pick<DutySchedulerStaff, "effectiveLoad" | "isLeadership" | "teachesP5EveryDay">): { dutyTarget: number; targetReason: DutyTargetReason } {
  if (staff.effectiveLoad >= 22) return { dutyTarget: 2, targetReason: "high-effective-load" };
  if (staff.teachesP5EveryDay) return { dutyTarget: 2, targetReason: "p5-every-day" };
  if (staff.isLeadership && staff.effectiveLoad >= 18) return { dutyTarget: 2, targetReason: "leadership-moderate-high-load" };
  return { dutyTarget: 3, targetReason: "normal-load" };
}

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
    .map(staff => {
      const manualLoadAdjustment = manualLoadAdjustments[staff.staffCode] ?? 0;
      const effectiveLoad = staff.teachingLessonCount + manualLoadAdjustment;
      const teachesP2ByDay = Object.fromEntries(DUTY_SCHOOL_DAYS.map(day => [day, teachesPeriodOnDay(analysis.parsedLessons, staff.staffCode, day, "P2")])) as Record<DutySchoolDay, boolean>;
      const teachesP5ByDay = Object.fromEntries(DUTY_SCHOOL_DAYS.map(day => [day, teachesPeriodOnDay(analysis.parsedLessons, staff.staffCode, day, "P5")])) as Record<DutySchoolDay, boolean>;
      const target = getStaffDutyTarget({ effectiveLoad, isLeadership: staff.isLeadership, teachesP5EveryDay: teachesP5EveryDay(teachesP5ByDay) });
      return { ...staff, manualLoadAdjustment, effectiveLoad, teachesP2ByDay, teachesP5ByDay, teachesP5EveryDay: teachesP5EveryDay(teachesP5ByDay), ...target };
    });
}

export function countStaffTeachingPeriodByDay(staff: DutySchedulerStaff[], period: "P2" | "P5") {
  const counts = emptyCountMap();
  for (const member of staff) for (const day of DUTY_SCHOOL_DAYS) if (period === "P2" ? member.teachesP2ByDay[day] : member.teachesP5ByDay[day]) counts[day] += 1;
  return counts;
}

function initialState(staff: DutySchedulerStaff[]) {
  return new Map(staff.map(member => [member.staffCode, { total: 0, breakCount: 0, lunchCount: 0 } satisfies AssignmentState]));
}

function scoreCandidate(staff: DutySchedulerStaff, duty: DutyAssignmentSlot, state: AssignmentState, slotsAllowDutyMinimum: boolean, slotsAllowTypeMinimum: boolean, staffStillBelowTwoDuties: number, feasibleStaffBelowTarget: number) {
  const isLunch = isLunchDuty(duty.time);
  const hasMinimumForType = isLunch ? state.lunchCount > 0 : state.breakCount > 0;
  const hasBothMinimums = state.breakCount > 0 && state.lunchCount > 0;
  let score = 0;

  // Priority order after hard constraints: first move everyone to two total duties,
  // then prefer third duties before fourth duties. Workload only breaks ties inside
  // the same duty-count band.
  if (slotsAllowDutyMinimum && state.total < 2) score += DUTY_SCHEDULER_SCORING_CONSTANTS.belowTwoDutyMinimumBonus * (2 - state.total);
  if (slotsAllowDutyMinimum && state.total >= 3 && staffStillBelowTwoDuties > 0) score += DUTY_SCHEDULER_SCORING_CONSTANTS.thirdDutyBeforeFourthPenalty * 2;
  if (state.total >= 3) score += DUTY_SCHEDULER_SCORING_CONSTANTS.thirdDutyBeforeFourthPenalty;
  if (state.total < staff.dutyTarget) score += DUTY_SCHEDULER_SCORING_CONSTANTS.belowDutyTargetBonus * (staff.dutyTarget - state.total);
  if (state.total >= staff.dutyTarget) score += DUTY_SCHEDULER_SCORING_CONSTANTS.atOrAboveDutyTargetPenalty * (state.total - staff.dutyTarget + 1);
  if (state.total >= 3 && feasibleStaffBelowTarget > 0) score += DUTY_SCHEDULER_SCORING_CONSTANTS.fourthDutyBeforeTargetsMetPenalty;
  score += state.total * DUTY_SCHEDULER_SCORING_CONSTANTS.existingDutyPenalty;
  score += staff.effectiveLoad * DUTY_SCHEDULER_SCORING_CONSTANTS.teachingLessonLoadPenalty;
  if (staff.isTutor) score += DUTY_SCHEDULER_SCORING_CONSTANTS.tutorPenalty;
  if (hasMinimumForType) score += slotsAllowTypeMinimum ? DUTY_SCHEDULER_SCORING_CONSTANTS.repeatDutyTypePenaltyWhenMinimumSlotsAllow : DUTY_SCHEDULER_SCORING_CONSTANTS.repeatDutyTypePenaltyWhenMinimumSlotsDoNotAllow;
  if (!hasMinimumForType) score += slotsAllowTypeMinimum ? DUTY_SCHEDULER_SCORING_CONSTANTS.missingDutyTypeBonusWhenMinimumSlotsAllow : DUTY_SCHEDULER_SCORING_CONSTANTS.missingDutyTypeBonusWhenMinimumSlotsDoNotAllow;
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
  const twoDutyMinimumApplies = duties.length >= staff.length * 2;
  const dutyCountDistribution: DutyCountDistribution = { "0": 0, "1": 0, "2": 0, "3": 0, "4+": 0 };
  for (const member of staff) {
    const total = counts.get(member.staffCode)?.total ?? 0;
    dutyCountDistribution[total >= 4 ? "4+" : String(total) as "0" | "1" | "2" | "3"] += 1;
  }
  const staffBelowTwoDuties = staff.filter(member => (counts.get(member.staffCode)?.total ?? 0) < 2);
  const staffWithFourOrMoreDuties = staff.filter(member => (counts.get(member.staffCode)?.total ?? 0) >= 4);
  const leadershipStaffWithExtraDuties = staff.filter(member => member.isLeadership && (counts.get(member.staffCode)?.total ?? 0) > 2);
  const staffOverTarget = staff.filter(member => (counts.get(member.staffCode)?.total ?? 0) > member.dutyTarget);
  const staffUnderTarget = staff.filter(member => (counts.get(member.staffCode)?.total ?? 0) < member.dutyTarget);
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
  if (twoDutyMinimumApplies && staffBelowTwoDuties.length) warnings.push(`${staffBelowTwoDuties.length} eligible staff member(s) have fewer than two duties even though ${duties.length} total slots should allow two each: ${staffBelowTwoDuties.map(staffLabel).join(", ")}. Review hard constraints such as same day/time clashes.`);
  if (staffBelowTwoDuties.length && staffWithFourOrMoreDuties.length >= Math.max(2, Math.ceil(staff.length * 0.15))) warnings.push(`${staffWithFourOrMoreDuties.length} staff member(s) have 4+ duties while ${staffBelowTwoDuties.length} staff member(s) remain below two duties.`);
  if (staff.length && duties.filter(d => d.time === "Breaktime").length < staff.length) warnings.push("There are fewer Breaktime duty slots than eligible staff, so not every staff member can receive a Breaktime duty.");
  if (staff.length && duties.filter(d => isLunchDuty(d.time)).length < staff.length) warnings.push("There are fewer Lunch duty slots than eligible staff, so not every staff member can receive a Lunch duty.");
  if (staffWithNoBreakDuty.length) warnings.push(`${staffWithNoBreakDuty.length} staff member(s) currently have no Breaktime duty.`);
  if (staffWithNoLunchDuty.length) warnings.push(`${staffWithNoLunchDuty.length} staff member(s) currently have no Lunch duty.`);
  if (leadershipStaffWithExtraDuties.length) warnings.push(`${leadershipStaffWithExtraDuties.length} leadership staff member(s) have more than the two minimum expected duties.`);
  if (staffOverTarget.length) warnings.push(`${staffOverTarget.length} staff member(s) are over their duty target: ${staffOverTarget.map(member => `${staffLabel(member)} ${counts.get(member.staffCode)?.total ?? 0}/${member.dutyTarget} (${member.targetReason})`).join(", ")}.`);
  const protectedAtThree = staff.filter(member => member.dutyTarget === 2 && (counts.get(member.staffCode)?.total ?? 0) >= 3);
  if (protectedAtThree.length) warnings.push(`${protectedAtThree.length} high-load, P5-heavy or moderate/high-load leadership staff member(s) received 3+ duties despite a target of 2: ${protectedAtThree.map(member => `${staffLabel(member)} (${member.targetReason})`).join(", ")}.`);
  return { totalDuties: duties.length, staffConsidered: staff.length, twoDutyMinimumApplies, dutyCountDistribution, staffBelowTwoDuties, staffWithNoBreakDuty, staffWithNoLunchDuty, leadershipStaffWithExtraDuties, staffOverTarget, staffUnderTarget, warnings: [...new Set(warnings)] };
}

export function autoScheduleDuties(duties: DutyAssignmentSlot[], staff: DutySchedulerStaff[]): DutyScheduleResult {
  const warnings: string[] = [];
  if (!staff.length) return { duties: duties.map(duty => ({ ...duty, assignedStaffCode: "" })), summary: buildSummary(duties, staff, ["No eligible staff were found in the active saved timetable."]) };
  const scheduled = duties.map(duty => ({ ...duty, assignedStaffCode: "" }));
  const counts = initialState(staff);
  const breakSlotsAllowMinimum = scheduled.filter(duty => duty.time === "Breaktime").length >= staff.length;
  const lunchSlotsAllowMinimum = scheduled.filter(duty => isLunchDuty(duty.time)).length >= staff.length;

  for (const duty of scheduled) {
    const slotsAllowTypeMinimum = duty.time === "Breaktime" ? breakSlotsAllowMinimum : lunchSlotsAllowMinimum;
    const slotsAllowDutyMinimum = scheduled.length >= staff.length * 2;
    const staffStillBelowTwoDuties = staff.filter(member => (counts.get(member.staffCode)?.total ?? 0) < 2).length;
    const alreadyAssignedAtSameTime = new Set(scheduled.filter(slot => slot.slotId !== duty.slotId && slot.day === duty.day && slot.time === duty.time && slot.assignedStaffCode).map(slot => slot.assignedStaffCode));
    const feasibleStaffBelowTarget = staff.filter(member => !alreadyAssignedAtSameTime.has(member.staffCode) && (counts.get(member.staffCode)?.total ?? 0) < member.dutyTarget).length;
    const ranked = staff
      .filter(member => !alreadyAssignedAtSameTime.has(member.staffCode))
      .map(member => ({ member, score: scoreCandidate(member, duty, counts.get(member.staffCode)!, slotsAllowDutyMinimum, slotsAllowTypeMinimum, staffStillBelowTwoDuties, feasibleStaffBelowTarget) }))
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
