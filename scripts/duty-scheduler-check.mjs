import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../lib/duty-scheduler.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const commonJsModule = { exports: {} };
Function("exports", "module", compiled)(commonJsModule.exports, commonJsModule);
const { autoScheduleDuties, getStaffDutyTarget, hasDutyTimetableClash } = commonJsModule.exports;
const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const periods = value => Object.fromEntries(days.map(day => [day, value]));
const staff = (staffCode, overrides = {}) => ({
  staffCode, staffName: staffCode, isLeadership: false, isTutor: false,
  effectiveLoad: 10, teachingLessonCount: 10, manualLoadAdjustment: 0,
  teachesP2ByDay: periods(false), teachesP4ByDay: periods(false), teachesP5ByDay: periods(false),
  teachesP5EveryDay: false, dutyTarget: 3, targetReason: "normal-load", ...overrides,
});
const duty = (slotId, day, time = "Breaktime") => ({ id: slotId, slotId, day, time, description: slotId, assignedStaffCode: "" });

assert.deepEqual(getStaffDutyTarget({ effectiveLoad: 10, isLeadership: true, teachesP5EveryDay: false }), { dutyTarget: 2, targetReason: "leadership" });

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

const a = staff("A", { teachesP2ByDay: { ...periods(false), Tuesday: true } });
const b = staff("B", { teachesP2ByDay: { ...periods(false), Monday: true } });
const global = autoScheduleDuties([duty("m", "Monday"), duty("t", "Tuesday")], [a, b], { staffDutyCaps: { A: 1, B: 1 } });
assert.deepEqual(global.duties.map(item => item.assignedStaffCode), ["A", "B"], "global allocation should reach zero P2 clashes");
assert.equal(global.summary.warnings.some(warning => warning.includes("preference breach")), false);

console.log("Duty scheduler regression checks passed.");
