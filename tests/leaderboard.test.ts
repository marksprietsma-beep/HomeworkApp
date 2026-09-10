import assert from "node:assert/strict";
import test from "node:test";
import { activeStudentMembers, buildLeaderboard, canViewLeaderboard, type LeaderboardAssignment } from "../lib/leaderboard-core";

const now = new Date("2026-09-10T12:00:00Z");
const members = [
  { id: 1, displayName: "Zoe", profileImagePath: "/media/profile-images/zoe.jpg" },
  { id: 2, displayName: "Amy", profileImagePath: null },
];
function assignment(overrides: Partial<LeaderboardAssignment> = {}): LeaderboardAssignment {
  return { questions: [{ points: 10 }], submissions: [], feedback: [], ...overrides };
}

test("only currently enrolled active student accounts become leaderboard members", () => {
  const filtered = activeStudentMembers([
    { student: { ...members[0], role: "STUDENT", accountStatus: "ACTIVE" } },
    { student: { ...members[1], role: "STUDENT", accountStatus: "DISABLED" } },
    { student: { id: 9, displayName: "Teacher", profileImagePath: null, role: "TEACHER", accountStatus: "ACTIVE" } },
  ]);
  assert.deepEqual(filtered, [members[0]]);
});

test("leaderboard access permits active enrolled students only when enabled and staff previews", () => {
  const active = new Set([1]);
  assert.equal(canViewLeaderboard({ viewer: { id: 1, role: "STUDENT" }, teacherId: 9, enabled: true, activeStudentIds: active }), true);
  assert.equal(canViewLeaderboard({ viewer: { id: 1, role: "STUDENT" }, teacherId: 9, enabled: false, activeStudentIds: active }), false);
  assert.equal(canViewLeaderboard({ viewer: { id: 2, role: "STUDENT" }, teacherId: 9, enabled: true, activeStudentIds: active }), false);
  assert.equal(canViewLeaderboard({ viewer: { id: 9, role: "TEACHER" }, teacherId: 9, enabled: false, activeStudentIds: active }), true);
  assert.equal(canViewLeaderboard({ viewer: { id: 8, role: "TEACHER" }, teacherId: 9, enabled: true, activeStudentIds: active }), false);
  assert.equal(canViewLeaderboard({ viewer: { id: 8, role: "ADMIN" }, teacherId: 9, enabled: false, activeStudentIds: active }), true);
});

test("draft submissions and feedback do not count while released scores award 0, partial, and full quality", () => {
  const rows = buildLeaderboard(members, [
    assignment({ submissions: [{ id: 10, studentId: 1, status: "DRAFT" }] }),
    assignment({ submissions: [{ id: 11, studentId: 1, status: "SUBMITTED" }], feedback: [{ id: 1, studentId: 1, submissionId: 11, releaseState: "DRAFT", scoreAwarded: 10, releasedAt: null, updatedAt: now }] }),
    assignment({ submissions: [{ id: 12, studentId: 1, status: "SUBMITTED" }], feedback: [{ id: 2, studentId: 1, submissionId: 12, releaseState: "RELEASED", scoreAwarded: 0, releasedAt: now, updatedAt: now }] }),
    assignment({ submissions: [{ id: 13, studentId: 1, status: "SUBMITTED" }], feedback: [{ id: 3, studentId: 1, submissionId: 13, releaseState: "RELEASED", scoreAwarded: 5, releasedAt: now, updatedAt: now }] }),
    assignment({ submissions: [{ id: 14, studentId: 1, status: "SUBMITTED" }], feedback: [{ id: 4, studentId: 1, submissionId: 14, releaseState: "RELEASED", scoreAwarded: 10, releasedAt: now, updatedAt: now }] }),
  ]);
  assert.deepEqual(rows.find((row) => row.studentId === 1), { studentId: 1, displayName: "Zoe", profileImagePath: "/media/profile-images/zoe.jpg", rank: 1, homeworkPoints: 55, completedAssignments: 4 });
});

test("latest released score is deterministic, never duplicates quality, and archived input remains countable", () => {
  const rows = buildLeaderboard(members, [assignment({ submissions: [{ id: 20, studentId: 2, status: "SUBMITTED" }], feedback: [
    { id: 1, studentId: 2, submissionId: 20, releaseState: "RELEASED", scoreAwarded: 10, releasedAt: new Date("2026-01-01"), updatedAt: now },
    { id: 2, studentId: 2, submissionId: 20, releaseState: "RELEASED", scoreAwarded: 5, releasedAt: new Date("2026-02-01"), updatedAt: now },
  ] })]);
  assert.equal(rows[0].homeworkPoints, 15);
  assert.equal(rows[0].displayName, "Amy");
});

test("ties use points, completions, display name, then stable id and expose no raw peer marks", () => {
  const rows = buildLeaderboard(members, []);
  assert.deepEqual(rows.map((row) => row.displayName), ["Amy", "Zoe"]);
  assert.deepEqual(Object.keys(rows[0]).sort(), ["completedAssignments", "displayName", "homeworkPoints", "profileImagePath", "rank", "studentId"].sort());
  assert.equal(rows[0].profileImagePath, null); // StudentAvatar initials fallback input.
  assert.equal("email" in rows[0] || "scoreAwarded" in rows[0] || "percentage" in rows[0], false);
});
