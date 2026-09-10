import { AccountStatus, HomeworkAssignmentStatus, UserRole } from "@prisma/client";
import { activeStudentMembers, buildLeaderboard, canViewLeaderboard } from "./leaderboard-core";
import { prisma } from "./prisma";

export async function getClassLeaderboard(classId: number, viewer: { id: number; role: UserRole } | null) {
  const klass = await prisma.class.findUnique({ where: { id: classId }, select: {
    id: true, name: true, teacherId: true, leaderboardEnabled: true,
    enrollments: { where: { student: { role: UserRole.STUDENT, accountStatus: AccountStatus.ACTIVE } }, select: { student: { select: { id: true, displayName: true, profileImagePath: true, role: true, accountStatus: true } } } },
    homeworkAssignments: { where: { status: { not: HomeworkAssignmentStatus.DRAFT } }, select: {
      questions: { select: { points: true } },
      submissions: { select: { studentId: true, id: true, status: true } },
      participantFeedback: { select: { id: true, studentId: true, submissionId: true, releaseState: true, scoreAwarded: true, releasedAt: true, updatedAt: true } },
    } },
  } });
  if (!klass) return { found: false, allowed: false as const, leaderboard: null };
  const members = activeStudentMembers(klass.enrollments);
  const allowed = canViewLeaderboard({ viewer, teacherId: klass.teacherId, enabled: klass.leaderboardEnabled, activeStudentIds: new Set(members.map((member) => member.id)) });
  if (!allowed) return { found: true, allowed: false as const, leaderboard: null };
  const assignments = klass.homeworkAssignments.map((assignment) => ({ questions: assignment.questions, submissions: assignment.submissions, feedback: assignment.participantFeedback }));
  return { found: true, allowed: true as const, leaderboard: { id: klass.id, name: klass.name, enabled: klass.leaderboardEnabled, rows: buildLeaderboard(members, assignments) } };
}
