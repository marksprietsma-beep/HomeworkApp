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
    feedbackDraft: number;
    feedbackReleased: number;
  };
  feedbackReview: {
    id: number;
    studentName: string;
    studentEmail: string | null;
    releaseState: string;
    overallFeedback: string;
    questionFeedbackCount: number;
    followUpActionCount: number;
  }[];
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
    feedbackActions: {
      total: number;
      completed: number;
      pending: number;
    };
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
      participantFeedback: {
        orderBy: [
          { feedbackImport: { importedAt: "desc" } },
          { updatedAt: "desc" },
        ],
        select: {
          studentId: true,
          id: true,
          sourceParticipantName: true,
          sourceParticipantEmail: true,
          overallFeedback: true,
          releaseState: true,
          followUpActions: {
            select: { status: true },
          },
          questionFeedback: {
            select: {
              followUpActions: { select: { status: true } },
            },
          },
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
  const feedbackByStudentId = new Map<number, (typeof assignment.participantFeedback)[number]>();
  for (const feedback of assignment.participantFeedback) {
    if (feedback.studentId && !feedbackByStudentId.has(feedback.studentId)) {
      feedbackByStudentId.set(feedback.studentId, feedback);
    }
  }

  const feedbackReview = assignment.participantFeedback.map((feedback) => ({
    id: feedback.id,
    studentName: feedback.sourceParticipantName ?? `Student ${feedback.studentId ?? "unknown"}`,
    studentEmail: feedback.sourceParticipantEmail,
    releaseState: feedback.releaseState,
    overallFeedback: feedback.overallFeedback,
    questionFeedbackCount: feedback.questionFeedback.length,
    followUpActionCount: feedback.followUpActions.length + feedback.questionFeedback.reduce((total, question) => total + question.followUpActions.length, 0),
  }));

  const participants = assignment.class.enrollments.map((enrollment) => {
    const submission = submissionsByStudentId.get(enrollment.student.id) ?? null;
    const feedback = feedbackByStudentId.get(enrollment.student.id) ?? null;
    const actions = feedback
      ? [
          ...feedback.followUpActions,
          ...feedback.questionFeedback.flatMap((question) => question.followUpActions),
        ]
      : [];
    const completed = actions.filter((action) => action.status === "COMPLETED").length;

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
      feedbackReleaseState: feedback?.releaseState ?? null,
      feedbackActions: {
        total: actions.length,
        completed,
        pending: actions.length - completed,
      },
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
        feedbackDraft: feedbackReview.filter((feedback) => feedback.releaseState === "DRAFT").length,
        feedbackReleased: feedbackReview.filter((feedback) => feedback.releaseState === "RELEASED").length,
      },
      feedbackReview,
      participants,
    },
  };
}
