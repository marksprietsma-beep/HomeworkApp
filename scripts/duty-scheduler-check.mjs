import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../lib/duty-scheduler.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const commonJsModule = { exports: {} };
Function("exports", "module", compiled)(commonJsModule.exports, commonJsModule);
const { autoScheduleDuties, getDutySchedulerStaff, getStaffDutyTarget, hasDutyTimetableClash, summariseManualSchedule } = commonJsModule.exports;
const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const periods = value => Object.fromEntries(days.map(day => [day, value]));
const staff = (staffCode, overrides = {}) => ({
  staffCode, staffName: staffCode, isLeadership: false, isTutor: false,
  effectiveLoad: 10, teachingLessonCount: 10, manualLoadAdjustment: 0,
  teachesP2ByDay: periods(false), teachesP4ByDay: periods(false), teachesP5ByDay: periods(false),
  teachesP5EveryDay: false, calculatedDutyTarget: 3, dutyTargetOverride: null, dutyTarget: 3, targetReason: "normal-load", ...overrides,
});
const duty = (slotId, day, time = "Breaktime") => ({ id: slotId, slotId, day, time, description: slotId, assignedStaffCode: "" });

assert.deepEqual(getStaffDutyTarget({ effectiveLoad: 10, isLeadership: true, teachesP5EveryDay: false }), { dutyTarget: 2, targetReason: "leadership" });

const analysis = { staff: [{ staffCode: "CALC", staffName: "Calculated", teachingLessonCount: 10, isLeadership: false, isTutor: false, tutorGroups: [], subjects: [], yearGroups: [], classGroups: [] }], parsedLessons: [] };
assert.equal(getDutySchedulerStaff(analysis)[0].dutyTarget, 3, "the calculated target is used without an override");
assert.deepEqual(getDutySchedulerStaff(analysis, {}, { CALC: 2 })[0], { ...getDutySchedulerStaff(analysis)[0], dutyTargetOverride: 2, dutyTarget: 2 }, "decreased overrides replace the calculated target");
assert.equal(getDutySchedulerStaff(analysis, {}, { CALC: 4 })[0].dutyTarget, 4, "increased overrides have no universal maximum");
assert.equal(getDutySchedulerStaff(analysis, {}, { CALC: -1 })[0].dutyTarget, 3, "invalid negative overrides reset to the calculated target");

const lunchStaff = staff("L", { teachesP5ByDay: periods(true) });
assert.equal(hasDutyTimetableClash(lunchStaff, duty("l1", "Monday", "Lunch A")), false, "P5 occupied and P4 free is acceptable");
lunchStaff.teachesP4ByDay.Monday = true;
assert.equal(hasDutyTimetableClash(lunchStaff, duty("l2", "Monday", "Lunch B")), true, "P4 and P5 occupied is a clash");
lunchStaff.teachesP5ByDay.Monday = false;
assert.equal(hasDutyTimetableClash(lunchStaff, duty("l3", "Monday", "Lunch A")), false, "P5 free is preferred");

const leader = staff("LEAD", { isLeadership: true, dutyTarget: 2, targetReason: "leadership" });
const capped = autoScheduleDuties([duty("a", "Monday"), duty("b", "Tuesday"), duty("c", "Wednesday")], [leader]);
assert.equal(capped.duties.filter(item => item.assignedStaffCode === "LEAD").length, 2);
assert.match(capped.summary.warnings.join("\n"), /No fully compliant solution exists/);

const overriddenLeader = staff("LEAD-OVERRIDE", { isLeadership: true, calculatedDutyTarget: 2, dutyTargetOverride: 3, dutyTarget: 3, targetReason: "leadership" });
const overrideResult = autoScheduleDuties([duty("o1", "Monday"), duty("o2", "Tuesday"), duty("o3", "Wednesday")], [overriddenLeader]);
assert.equal(overrideResult.duties.filter(item => item.assignedStaffCode === overriddenLeader.staffCode).length, 3, "a manual leadership target must take precedence over the default cap");
assert.equal(overrideResult.summary.staffUnderTarget.length, 0);

const zeroTarget = staff("ZERO", { dutyTargetOverride: 0, dutyTarget: 0 });
const zeroSummary = autoScheduleDuties([], [zeroTarget]).summary;
assert.equal(zeroSummary.staffBelowTwoDuties.length, 0, "a zero target must not create a minimum-duty warning");
assert.equal(zeroSummary.staffUnderTarget.length, 0);

const mismatchedTargets = autoScheduleDuties([duty("only", "Monday")], [staff("TARGET-THREE")]);
assert.match(mismatchedTargets.summary.warnings.join("\n"), /Effective duty targets total 3, but 1 duty slots are available/);

const a = staff("A", { teachesP2ByDay: { ...periods(false), Tuesday: true } });
const b = staff("B", { teachesP2ByDay: { ...periods(false), Monday: true } });
const global = autoScheduleDuties([duty("m", "Monday"), duty("t", "Tuesday")], [a, b], { staffDutyCaps: { A: 1, B: 1 } });
assert.deepEqual(global.duties.map(item => item.assignedStaffCode), ["A", "B"], "global allocation should reach zero P2 clashes");
assert.equal(global.summary.warnings.some(warning => warning.includes("preference breach")), false);

const targetThree = staff("TARGET-THREE", { effectiveLoad: 20 });
const targetTwo = staff("TARGET-TWO", { effectiveLoad: 1, calculatedDutyTarget: 2, dutyTarget: 2, targetReason: "high-effective-load" });
const breakCompetition = autoScheduleDuties([
  duty("preferred-break", "Monday"),
  duty("lunch-1", "Monday", "Lunch A"),
  duty("lunch-2", "Tuesday", "Lunch A"),
  duty("lunch-3", "Wednesday", "Lunch A"),
  duty("lunch-4", "Thursday", "Lunch A"),
], [targetTwo, targetThree]);
assert.equal(breakCompetition.duties[0].assignedStaffCode, "TARGET-THREE", "an eligible target-3 member receives a break before target-2 staff");
assert.equal(breakCompetition.duties.filter(item => item.assignedStaffCode === "TARGET-THREE").length, 3, "the break preference preserves effective duty targets");

const unavailableTargetThree = staff("UNAVAILABLE-THREE", { teachesP2ByDay: { ...periods(false), Monday: true } });
const availableTargetTwo = staff("AVAILABLE-TWO", { calculatedDutyTarget: 2, dutyTarget: 2, targetReason: "high-effective-load" });
const availabilityCompetition = autoScheduleDuties([
  duty("availability-break", "Monday"),
  duty("availability-lunch-1", "Tuesday", "Lunch A"),
  duty("availability-lunch-2", "Wednesday", "Lunch A"),
  duty("availability-lunch-3", "Thursday", "Lunch A"),
  duty("availability-lunch-4", "Friday", "Lunch A"),
], [unavailableTargetThree, availableTargetTwo]);
assert.equal(availabilityCompetition.duties[0].assignedStaffCode, "AVAILABLE-TWO", "target-2 staff retain breaks when target-3 staff have no P2-free break slot");
assert.equal(availabilityCompetition.summary.warnings.some(warning => warning.includes("preference breach")), false, "the break preference must not introduce a P2 clash");

const lunchPair = [duty("lunch-a", "Monday", "Lunch A"), duty("lunch-b", "Monday", "Lunch B")];
const oneLunchCandidate = autoScheduleDuties(lunchPair, [staff("ONLY")]);
assert.equal(oneLunchCandidate.duties.filter(item => item.assignedStaffCode === "ONLY").length, 1, "one person cannot cover both lunches on the same day");
assert.match(oneLunchCandidate.summary.warnings.join("\n"), /one-lunch-per-person-per-day constraint/, "an impossible allocation reports the hard constraint shortage");

const twoLunchCandidates = autoScheduleDuties(lunchPair, [staff("LUNCH-A"), staff("LUNCH-B")]);
assert.equal(new Set(twoLunchCandidates.duties.map(item => item.assignedStaffCode)).size, 2, "Lunch A and Lunch B are assigned to different people");
assert.equal(twoLunchCandidates.duties.every(item => item.assignedStaffCode), true, "both lunches remain fillable when two people are available");

const invalidManualLunches = lunchPair.map(item => ({ ...item, assignedStaffCode: "DUPLICATE" }));
const invalidManualSummary = summariseManualSchedule(invalidManualLunches, [staff("DUPLICATE", { staffName: "Duplicate Person" })]);
assert.match(invalidManualSummary.warnings.join("\n"), /Invalid duty allocation: Duplicate Person \(DUPLICATE\) is assigned both Lunch A and Lunch B on Monday\./, "manual schedules and exports identify same-day double-lunch assignments");

console.log("Duty scheduler regression checks passed.");
