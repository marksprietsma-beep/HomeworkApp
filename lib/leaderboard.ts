import { FeedbackReleaseState, HomeworkAssignmentStatus, SubmissionStatus, UserRole } from "@prisma/client";
import { calculateHomeworkPoints, getAssignmentTotalPoints } from "./assignment-points";
import { isAdmin, canTeachClass } from "./permissions";
import { prisma } from "./prisma";

export type LeaderboardRow = { studentId: number; displayName: string; profileImagePath: string | null; rank: number; homeworkPoints: number; completedAssignments: number };

export function qualityBonus(scoreAwarded: number, assignmentTotalPoints: number) {
  return Math.round(10 * scoreAwarded / assignmentTotalPoints);
}

export function rankLeaderboard(rows: Omit<LeaderboardRow, "rank">[]): LeaderboardRow[] {
  return [...rows].sort((a, b) => b.homeworkPoints - a.homeworkPoints || b.completedAssignments - a.completedAssignments || a.displayName.localeCompare(b.displayName) || a.studentId - b.studentId)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

export async function getClassLeaderboard(classId: number, viewer: { id: number; role: UserRole } | null) {
  const klass = await prisma.class.findUnique({ where: { id: classId }, select: {
    id: true, name: true, teacherId: true, leaderboardEnabled: true,
    enrollments: { select: { student: { select: { id: true, displayName: true, profileImagePath: true } } } },
    homeworkAssignments: { where: { status: { not: HomeworkAssignmentStatus.DRAFT } }, select: {
      questions: { select: { points: true } },
      submissions: { where: { status: SubmissionStatus.SUBMITTED }, select: { studentId: true, id: true } },
      participantFeedback: { where: { releaseState: FeedbackReleaseState.RELEASED, scoreAwarded: { not: null } }, orderBy: [{ releasedAt: "desc" }, { updatedAt: "desc" }, { id: "desc" }], select: { studentId: true, submissionId: true, scoreAwarded: true } },
    } },
  } });
  if (!klass || !viewer) return { found: Boolean(klass), allowed: false as const, leaderboard: null };
  const enrolled = klass.enrollments.some((item) => item.student.id === viewer.id);
  const manager = isAdmin(viewer) || canTeachClass(viewer, klass.teacherId);
  if (!manager && !(viewer.role === UserRole.STUDENT && enrolled && klass.leaderboardEnabled)) return { found: true, allowed: false as const, leaderboard: null };
  const totals = new Map<number, { points: number; completed: number }>(klass.enrollments.map(({ student }) => [student.id, { points: 0, completed: 0 }]));
  for (const assignment of klass.homeworkAssignments) {
    const totalPoints = getAssignmentTotalPoints(assignment.questions);
    for (const submission of assignment.submissions) {
      const total = totals.get(submission.studentId); if (!total) continue;
      total.completed += 1;
      if (totalPoints !== null) {
        const feedback = assignment.participantFeedback.find((item) => item.studentId === submission.studentId && item.submissionId === submission.id);
        total.points += calculateHomeworkPoints({ submitted: true, assignmentTotalPoints: totalPoints, releasedScoreAwarded: feedback?.scoreAwarded ?? null });
      } else total.points += 10;
    }
  }
  return { found: true, allowed: true as const, leaderboard: { id: klass.id, name: klass.name, enabled: klass.leaderboardEnabled, rows: rankLeaderboard(klass.enrollments.map(({ student }) => ({ studentId: student.id, displayName: student.displayName, profileImagePath: student.profileImagePath, homeworkPoints: totals.get(student.id)?.points ?? 0, completedAssignments: totals.get(student.id)?.completed ?? 0 }))) } };
}
