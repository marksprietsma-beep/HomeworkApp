import { calculateHomeworkPoints, getAssignmentTotalPoints } from "./assignment-points";

export type LeaderboardMember = { id: number; displayName: string; profileImagePath: string | null };
export type LeaderboardEnrollment = { student: LeaderboardMember & { role: string; accountStatus: string } };
export type LeaderboardAssignment = {
  questions: { points: number | null }[];
  submissions: { id: number; studentId: number; status: "DRAFT" | "SUBMITTED" }[];
  feedback: { id: number; studentId: number | null; submissionId: number | null; releaseState: "DRAFT" | "RELEASED"; scoreAwarded: number | null; releasedAt: Date | null; updatedAt: Date }[];
};
export type SafeLeaderboardRow = { studentId: number; displayName: string; profileImagePath: string | null; rank: number; homeworkPoints: number; completedAssignments: number };

export function activeStudentMembers(enrollments: LeaderboardEnrollment[]): LeaderboardMember[] {
  return enrollments.filter(({ student }) => student.role === "STUDENT" && student.accountStatus === "ACTIVE")
    .map(({ student }) => ({ id: student.id, displayName: student.displayName, profileImagePath: student.profileImagePath }));
}

export function canViewLeaderboard(input: { viewer: { id: number; role: "ADMIN" | "TEACHER" | "STUDENT" } | null; teacherId: number; enabled: boolean; activeStudentIds: Set<number> }) {
  const { viewer } = input;
  if (!viewer) return false;
  if (viewer.role === "ADMIN" || (viewer.role === "TEACHER" && viewer.id === input.teacherId)) return true;
  return viewer.role === "STUDENT" && input.enabled && input.activeStudentIds.has(viewer.id);
}

export function buildLeaderboard(members: LeaderboardMember[], assignments: LeaderboardAssignment[]): SafeLeaderboardRow[] {
  const totals = new Map(members.map((member) => [member.id, { points: 0, completed: 0 }]));
  for (const assignment of assignments) {
    const denominator = getAssignmentTotalPoints(assignment.questions);
    for (const submission of assignment.submissions) {
      if (submission.status !== "SUBMITTED") continue;
      const total = totals.get(submission.studentId);
      if (!total) continue;
      // One deterministic latest released result can contribute; drafts and duplicates never stack.
      const released = assignment.feedback.filter((item) => item.releaseState === "RELEASED" && item.studentId === submission.studentId && item.submissionId === submission.id)
        .sort((a, b) => (b.releasedAt?.getTime() ?? 0) - (a.releasedAt?.getTime() ?? 0) || b.updatedAt.getTime() - a.updatedAt.getTime() || b.id - a.id)[0];
      total.completed += 1;
      total.points += calculateHomeworkPoints({ submitted: true, assignmentTotalPoints: denominator, releasedScoreAwarded: released?.scoreAwarded ?? null });
    }
  }
  return members.map((member) => ({ studentId: member.id, displayName: member.displayName, profileImagePath: member.profileImagePath, homeworkPoints: totals.get(member.id)?.points ?? 0, completedAssignments: totals.get(member.id)?.completed ?? 0 }))
    .sort((a, b) => b.homeworkPoints - a.homeworkPoints || b.completedAssignments - a.completedAssignments || a.displayName.localeCompare(b.displayName) || a.studentId - b.studentId)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}
