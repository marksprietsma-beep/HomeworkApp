import type { ParsedLessonEntry, StaffSummary, TimetableAnalysis } from "./timetable-analyser";

export const DUTY_TIME_OPTIONS = ["Breaktime", "Lunch A", "Lunch B"] as const;
export const DUTY_SCHOOL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;
export type DutyTime = (typeof DUTY_TIME_OPTIONS)[number];
export type DutySchoolDay = (typeof DUTY_SCHOOL_DAYS)[number];
export type DutyDefinitionRow = { id: string; description: string; time: DutyTime };
export type DutyAssignmentSlot = DutyDefinitionRow & { slotId: string; day: DutySchoolDay; assignedStaffCode: string };
export type DutyRow = DutyAssignmentSlot;
export type DutyTargetReason = "normal-load" | "high-effective-load" | "p5-every-day" | "leadership";
export type DutySchedulerStaff = StaffSummary & { manualLoadAdjustment: number; effectiveLoad: number; teachesP2ByDay: Record<DutySchoolDay, boolean>; teachesP4ByDay: Record<DutySchoolDay, boolean>; teachesP5ByDay: Record<DutySchoolDay, boolean>; teachesP5EveryDay: boolean; calculatedDutyTarget: number; dutyTargetOverride: number | null; dutyTarget: number; targetReason: DutyTargetReason };
export type DutyCountDistribution = { "0": number; "1": number; "2": number; "3": number; "4+": number };
export type DutyScheduleSummary = { totalDuties: number; staffConsidered: number; twoDutyMinimumApplies: boolean; dutyCountDistribution: DutyCountDistribution; staffBelowTwoDuties: DutySchedulerStaff[]; staffWithNoBreakDuty: DutySchedulerStaff[]; staffWithNoLunchDuty: DutySchedulerStaff[]; leadershipStaffWithExtraDuties: DutySchedulerStaff[]; staffOverTarget: DutySchedulerStaff[]; staffUnderTarget: DutySchedulerStaff[]; controlledFourthDutyStaff: DutySchedulerStaff[]; protectedStaffOverTarget: DutySchedulerStaff[]; targetBreachReasons: string[]; warnings: string[] };
export type DutyScheduleResult = { duties: DutyAssignmentSlot[]; summary: DutyScheduleSummary };

type AssignmentState = { total: number; breakCount: number; lunchCount: number };

export const DUTY_SCHEDULER_SCORING_CONSTANTS = {
  belowTwoDutyMinimumBonus: -4000,
  thirdDutyBeforeFourthPenalty: 2600,
  suitableFourthDutyPenalty: 900,
  protectedFourthDutyPenalty: 5200,
  existingDutyPenalty: 140,
  teachingLessonLoadPenalty: 4,
  tutorPenalty: 6,
  repeatDutyTypePenaltyWhenMinimumSlotsAllow: 900,
  repeatDutyTypePenaltyWhenMinimumSlotsDoNotAllow: 80,
  missingDutyTypeBonusWhenMinimumSlotsAllow: -900,
  missingDutyTypeBonusWhenMinimumSlotsDoNotAllow: -120,
  belowDutyTargetBonus: -1200,
  atOrAboveDutyTargetPenalty: 1800,
  protectedTargetBreachPenalty: 5200,
  fourthDutyBeforeTargetsMetPenalty: 4200,
  leadershipExtraDutyPenalty: 220,
  p2OrP5PreferenceBreachPenalty: 320,
} as const;

function isLunchDuty(time: DutyTime) { return time === "Lunch A" || time === "Lunch B"; }
function staffLabel(staff: StaffSummary) { return `${staff.staffName} (${staff.staffCode})`; }
function emptyCountMap() { return Object.fromEntries(DUTY_SCHOOL_DAYS.map(day => [day, 0])) as Record<DutySchoolDay, number>; }
function teachesPeriodOnDay(entries: ParsedLessonEntry[], staffCode: string, day: DutySchoolDay, period: "P2" | "P4" | "P5") { return entries.some(entry => entry.staffCode === staffCode && entry.day === day && entry.period === period && entry.isTeachingLesson); }
function preferencePeriod(time: DutyTime) { return time === "Breaktime" ? "P2" : "P4 and P5"; }
/** The single source of truth used by allocation, review warnings and exports. */
export function hasDutyTimetableClash(staff: DutySchedulerStaff, duty: Pick<DutyAssignmentSlot, "day" | "time">) {
  return duty.time === "Breaktime"
    ? staff.teachesP2ByDay[duty.day]
    : staff.teachesP4ByDay[duty.day] && staff.teachesP5ByDay[duty.day];
}
function hasPreferredFreePeriod(staff: DutySchedulerStaff, duty: DutyAssignmentSlot) { return !hasDutyTimetableClash(staff, duty); }
function sameTimeKey(duty: Pick<DutyAssignmentSlot, "day" | "time">) { return `${duty.day} ${duty.time}`; }
function teachesP5EveryDay(teachesP5ByDay: Record<DutySchoolDay, boolean>) { return DUTY_SCHOOL_DAYS.every(day => teachesP5ByDay[day]); }

function isProtectedTargetTwoStaff(staff: DutySchedulerStaff) {
  return staff.dutyTarget === 2 && (staff.effectiveLoad >= 22 || staff.teachesP5EveryDay || (staff.isLeadership && staff.effectiveLoad >= 18));
}

function hasSignificantPreferenceBreaches(staff: DutySchedulerStaff, state: AssignmentState) {
  // A staff member with several current duties and no balance across break/lunch is
  // more likely to be carrying P2/P5 preference compromises already. Keep them out
  // of the preferred fourth-duty pool unless unavoidable.
  return state.total >= 3 && (state.breakCount === 0 || state.lunchCount === 0);
}

function isSuitableFourthDutyCandidate(staff: DutySchedulerStaff, state: AssignmentState, duty?: DutyAssignmentSlot) {
  if (staff.dutyTarget !== 3) return false;
  if (staff.effectiveLoad >= 22 || staff.teachesP5EveryDay) return false;
  if (staff.isLeadership && staff.effectiveLoad >= 18) return false;
  if (hasSignificantPreferenceBreaches(staff, state)) return false;
  if (duty && !hasPreferredFreePeriod(staff, duty)) return false;
  return true;
}

export function getStaffDutyTarget(staff: Pick<DutySchedulerStaff, "effectiveLoad" | "isLeadership" | "teachesP5EveryDay">): { dutyTarget: number; targetReason: DutyTargetReason } {
  if (staff.isLeadership) return { dutyTarget: 2, targetReason: "leadership" };
  if (staff.effectiveLoad >= 22) return { dutyTarget: 2, targetReason: "high-effective-load" };
  if (staff.teachesP5EveryDay) return { dutyTarget: 2, targetReason: "p5-every-day" };
  return { dutyTarget: 3, targetReason: "normal-load" };
}

export function expandDutyDefinitions(definitions: DutyDefinitionRow[], existingAssignments: DutyAssignmentSlot[] = []): DutyAssignmentSlot[] {
  const assignedBySlotId = new Map(existingAssignments.map(slot => [slot.slotId, slot.assignedStaffCode]));
  return definitions.flatMap(definition => DUTY_SCHOOL_DAYS.map(day => {
    const slotId = `${definition.id}-${day}`;
    return { ...definition, slotId, day, assignedStaffCode: assignedBySlotId.get(slotId) ?? "" };
  }));
}

export function getDutySchedulerStaff(analysis: TimetableAnalysis, manualLoadAdjustments: Record<string, number> = {}, dutyTargetOverrides: Record<string, number> = {}): DutySchedulerStaff[] {
  return [...analysis.staff]
    .sort((a, b) => a.staffName.localeCompare(b.staffName, undefined, { numeric: true, sensitivity: "base" }))
    .map(staff => {
      const manualLoadAdjustment = manualLoadAdjustments[staff.staffCode] ?? 0;
      const effectiveLoad = staff.teachingLessonCount + manualLoadAdjustment;
      const teachesP2ByDay = Object.fromEntries(DUTY_SCHOOL_DAYS.map(day => [day, teachesPeriodOnDay(analysis.parsedLessons, staff.staffCode, day, "P2")])) as Record<DutySchoolDay, boolean>;
      const teachesP4ByDay = Object.fromEntries(DUTY_SCHOOL_DAYS.map(day => [day, teachesPeriodOnDay(analysis.parsedLessons, staff.staffCode, day, "P4")])) as Record<DutySchoolDay, boolean>;
      const teachesP5ByDay = Object.fromEntries(DUTY_SCHOOL_DAYS.map(day => [day, teachesPeriodOnDay(analysis.parsedLessons, staff.staffCode, day, "P5")])) as Record<DutySchoolDay, boolean>;
      const target = getStaffDutyTarget({ effectiveLoad, isLeadership: staff.isLeadership, teachesP5EveryDay: teachesP5EveryDay(teachesP5ByDay) });
      const savedOverride = dutyTargetOverrides[staff.staffCode];
      const dutyTargetOverride = Number.isInteger(savedOverride) && savedOverride >= 0 ? savedOverride : null;
      return { ...staff, manualLoadAdjustment, effectiveLoad, teachesP2ByDay, teachesP4ByDay, teachesP5ByDay, teachesP5EveryDay: teachesP5EveryDay(teachesP5ByDay), calculatedDutyTarget: target.dutyTarget, dutyTargetOverride, dutyTarget: dutyTargetOverride ?? target.dutyTarget, targetReason: target.targetReason };
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
  const staffBelowTwoDuties = staff.filter(member => (counts.get(member.staffCode)?.total ?? 0) < Math.min(2, member.dutyTarget));
  const staffWithFourOrMoreDuties = staff.filter(member => (counts.get(member.staffCode)?.total ?? 0) >= 4);
  const controlledFourthDutyStaff = staffWithFourOrMoreDuties.filter(member => isSuitableFourthDutyCandidate(member, counts.get(member.staffCode)!));
  const leadershipStaffWithExtraDuties = staff.filter(member => member.isLeadership && (counts.get(member.staffCode)?.total ?? 0) > member.dutyTarget);
  const staffOverTarget = staff.filter(member => (counts.get(member.staffCode)?.total ?? 0) > member.dutyTarget);
  const staffUnderTarget = staff.filter(member => (counts.get(member.staffCode)?.total ?? 0) < member.dutyTarget);
  const protectedStaffOverTarget = staffOverTarget.filter(isProtectedTargetTwoStaff);
  const targetBreachReasons = staffOverTarget.map(member => {
    const total = counts.get(member.staffCode)?.total ?? 0;
    return `${staffLabel(member)} is ${total}/${member.dutyTarget} duties because hard timetable/preference constraints or insufficient suitable target-3 capacity required a target breach (${member.targetReason}).`;
  });
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
  const effectiveTargetTotal = staff.reduce((total, member) => total + member.dutyTarget, 0);
  if (effectiveTargetTotal !== duties.length) warnings.push(`Effective duty targets total ${effectiveTargetTotal}, but ${duties.length} duty slots are available (${Math.abs(effectiveTargetTotal - duties.length)} ${effectiveTargetTotal < duties.length ? "more slot(s) than targets" : "more target duty/duties than slots"}).`);
  if (leadershipStaffWithExtraDuties.length) warnings.push(`${leadershipStaffWithExtraDuties.length} leadership staff member(s) are over their effective duty target.`);
  if (controlledFourthDutyStaff.length) warnings.push(`${controlledFourthDutyStaff.length} suitable target-3 staff member(s) received controlled 4th duties to protect high-load/P5-heavy target-2 staff: ${controlledFourthDutyStaff.map(member => `${staffLabel(member)} ${counts.get(member.staffCode)?.total ?? 0}/${member.dutyTarget}`).join(", ")}.`);
  if (staffOverTarget.length) warnings.push(`${staffOverTarget.length} staff member(s) are over their duty target: ${staffOverTarget.map(member => `${staffLabel(member)} ${counts.get(member.staffCode)?.total ?? 0}/${member.dutyTarget} (${member.targetReason})`).join(", ")}.`);
  if (protectedStaffOverTarget.length) warnings.push(`${protectedStaffOverTarget.length} protected target-2 staff member(s) are over target and should be reviewed before relying on this schedule: ${protectedStaffOverTarget.map(member => `${staffLabel(member)} ${counts.get(member.staffCode)?.total ?? 0}/${member.dutyTarget} (${member.targetReason})`).join(", ")}.`);
  const protectedAtThree = staff.filter(member => member.dutyTarget === 2 && (counts.get(member.staffCode)?.total ?? 0) >= 3);
  if (protectedAtThree.length) warnings.push(`${protectedAtThree.length} high-load, P5-heavy or moderate/high-load leadership staff member(s) received 3+ duties despite a target of 2: ${protectedAtThree.map(member => `${staffLabel(member)} (${member.targetReason})`).join(", ")}.`);
  return { totalDuties: duties.length, staffConsidered: staff.length, twoDutyMinimumApplies, dutyCountDistribution, staffBelowTwoDuties, staffWithNoBreakDuty, staffWithNoLunchDuty, leadershipStaffWithExtraDuties, staffOverTarget, staffUnderTarget, controlledFourthDutyStaff, protectedStaffOverTarget, targetBreachReasons, warnings: [...new Set(warnings)] };
}

type FlowEdge = { to: number; rev: number; capacity: number; cost: number; slotIndex?: number; staffCode?: string };

/** Min-cost max-flow makes timetable clashes a schedule-wide objective, rather than
 * allowing duty-definition order to decide which staff absorb them. */
export function autoScheduleDuties(
  duties: DutyAssignmentSlot[],
  staff: DutySchedulerStaff[],
  options: { leadershipDutyCap?: number; staffDutyCaps?: Record<string, number> } = {},
): DutyScheduleResult {
  const warnings: string[] = [];
  if (!staff.length) return { duties: duties.map(duty => ({ ...duty, assignedStaffCode: "" })), summary: buildSummary(duties, staff, ["No eligible staff were found in the active saved timetable."]) };
  const scheduled = duties.map(duty => ({ ...duty, assignedStaffCode: "" }));
  const graph: FlowEdge[][] = [];
  const node = () => (graph.push([]), graph.length - 1);
  const source = node();
  const sink = node();
  const addEdge = (from: number, to: number, capacity: number, cost: number, metadata: Partial<FlowEdge> = {}) => {
    graph[from].push({ to, rev: graph[to].length, capacity, cost, ...metadata });
    graph[to].push({ to: from, rev: graph[from].length - 1, capacity: 0, cost: -cost });
  };
  const staffNodes = new Map(staff.map(member => [member.staffCode, node()]));
  const timeNodes = new Map<string, number>();
  for (const [slotIndex, duty] of scheduled.entries()) {
    const slotNode = node();
    addEdge(source, slotNode, 1, 0);
    for (const member of staff) {
      const key = `${member.staffCode}|${sameTimeKey(duty)}`;
      let timeNode = timeNodes.get(key);
      if (timeNode === undefined) {
        timeNode = node();
        timeNodes.set(key, timeNode);
        addEdge(timeNode, staffNodes.get(member.staffCode)!, 1, 0);
      }
      // One clash outweighs every possible secondary fairness difference.
      const clashCost = hasDutyTimetableClash(member, duty) ? 1_000_000 : 0;
      addEdge(slotNode, timeNode, 1, clashCost, { slotIndex, staffCode: member.staffCode });
    }
  }
  for (const member of staff) {
    const configuredCap = options.staffDutyCaps?.[member.staffCode];
    // A manual target is authoritative: the legacy leadership cap may constrain the
    // calculated default, but must never prevent an explicitly raised target.
    const cap = configuredCap ?? (member.isLeadership ? Math.max(options.leadershipDutyCap ?? 2, member.dutyTarget) : scheduled.length);
    for (let dutyNumber = 1; dutyNumber <= cap; dutyNumber += 1) {
      const targetPenalty = dutyNumber <= member.dutyTarget ? 0 : 10_000 * (dutyNumber - member.dutyTarget);
      addEdge(staffNodes.get(member.staffCode)!, sink, 1, targetPenalty + dutyNumber * 100 + member.effectiveLoad);
    }
  }
  let flow = 0;
  while (flow < scheduled.length) {
    const distance = graph.map(() => Number.POSITIVE_INFINITY);
    const previousNode = graph.map(() => -1);
    const previousEdge = graph.map(() => -1);
    const queued = graph.map(() => false);
    const queue = [source]; distance[source] = 0; queued[source] = true;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const from = queue[cursor]; queued[from] = false;
      graph[from].forEach((edge, edgeIndex) => {
        if (edge.capacity && distance[edge.to] > distance[from] + edge.cost) {
          distance[edge.to] = distance[from] + edge.cost; previousNode[edge.to] = from; previousEdge[edge.to] = edgeIndex;
          if (!queued[edge.to]) { queue.push(edge.to); queued[edge.to] = true; }
        }
      });
    }
    if (previousNode[sink] < 0) break;
    for (let current = sink; current !== source; current = previousNode[current]) {
      const edge = graph[previousNode[current]][previousEdge[current]];
      edge.capacity -= 1; graph[current][edge.rev].capacity += 1;
    }
    flow += 1;
  }
  for (const edges of graph) for (const edge of edges) {
    if (edge.slotIndex !== undefined && edge.staffCode && edge.capacity === 0) scheduled[edge.slotIndex].assignedStaffCode = edge.staffCode;
  }
  if (flow < scheduled.length) warnings.push(`No fully compliant solution exists: ${scheduled.length - flow} duty slot(s) remain unassigned because hard staff caps and same-time constraints leave insufficient capacity.`);
  return { duties: scheduled, summary: buildSummary(scheduled, staff, warnings) };
}

export function summariseManualSchedule(duties: DutyAssignmentSlot[], staff: DutySchedulerStaff[]) { return buildSummary(duties, staff, []); }
