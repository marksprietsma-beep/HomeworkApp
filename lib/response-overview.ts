import type { UserRole } from "@prisma/client";
import { prisma } from "./prisma";

export type ResponseOverviewData = {
  id: number;
  title: string;
  status: string;
  dueAt: Date | null;
  class: {
    id: number;
    name: string;
    teacherId: number;
    teacher: {
      displayName: string;
      email: string;
    };
  };
  totals: {
    enrolledParticipants: number;
    responded: number;
    notResponded: number;
    questions: number;
    points: number | null;
  };
  participants: {
    id: number;
    displayName: string;
    email: string;
    response: {
      id: number;
      status: string;
      submittedAt: Date | null;
      updatedAt: Date;
    } | null;
  }[];
};

export async function getResponseOverviewData(
  classId: number,
  assignmentId: number,
  viewer: { id: number; role: UserRole } | null,
): Promise<{ overview: ResponseOverviewData | null; canView: boolean; found: boolean }> {
  const assignment = await prisma.homeworkAssignment.findFirst({
    where: {
      id: assignmentId,
      classId,
    },
    include: {
      class: {
        select: {
          id: true,
          name: true,
          teacherId: true,
          teacher: {
            select: {
              displayName: true,
              email: true,
            },
          },
          enrollments: {
            orderBy: { student: { displayName: "asc" } },
            select: {
              student: {
                select: {
                  id: true,
                  displayName: true,
                  email: true,
                },
              },
            },
          },
        },
      },
      questions: {
        select: {
          points: true,
        },
      },
      submissions: {
        select: {
          id: true,
          studentId: true,
          status: true,
          submittedAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!assignment) {
    return { overview: null, canView: false, found: false };
  }

  const canView = viewer?.role === "TEACHER" && viewer.id === assignment.class.teacherId;

  if (!canView) {
    return { overview: null, canView, found: true };
  }

  const submissionsByStudentId = new Map(
    assignment.submissions.map((submission) => [submission.studentId, submission]),
  );
  const totalPoints = assignment.questions.reduce<number | null>(
    (total, question) =>
      question.points === null ? total : (total ?? 0) + question.points,
    null,
  );
  const participants = assignment.class.enrollments.map((enrollment) => {
    const submission = submissionsByStudentId.get(enrollment.student.id) ?? null;

    return {
      ...enrollment.student,
      response: submission
        ? {
            id: submission.id,
            status: submission.status,
            submittedAt: submission.submittedAt,
            updatedAt: submission.updatedAt,
          }
        : null,
    };
  });
  const responded = participants.filter((participant) => participant.response).length;

  return {
    canView,
    found: true,
    overview: {
      id: assignment.id,
      title: assignment.title,
      status: assignment.status,
      dueAt: assignment.dueAt,
      class: {
        id: assignment.class.id,
        name: assignment.class.name,
        teacherId: assignment.class.teacherId,
        teacher: assignment.class.teacher,
      },
      totals: {
        enrolledParticipants: participants.length,
        responded,
        notResponded: participants.length - responded,
        questions: assignment.questions.length,
        points: totalPoints,
      },
      participants,
    },
  };
}
