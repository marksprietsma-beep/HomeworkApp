import { prisma } from "./prisma";

export type ParticipantWorkData = {
  id: number;
  title: string;
  description: string | null;
  status: string;
  dueAt: Date | null;
  class: {
    id: number;
    name: string;
    teacher: {
      displayName: string;
    };
  };
  questions: {
    id: number;
    order: number;
    prompt: string;
    questionType: string;
    points: number | null;
    options: unknown;
    imagePath: string | null;
    imageCaption: string | null;
    imageAltText: string | null;
    answerText: string;
  }[];
  submission: {
    id: number;
    status: string;
    submittedAt: Date | null;
    updatedAt: Date;
  } | null;
  totals: {
    questions: number;
    points: number | null;
  };
};

export async function getParticipantWorkData(
  assignmentId: number,
  studentId: number,
): Promise<ParticipantWorkData | null> {
  const assignment = await prisma.homeworkAssignment.findFirst({
    where: {
      id: assignmentId,
      class: {
        enrollments: {
          some: { studentId },
        },
      },
    },
    include: {
      class: {
        select: {
          id: true,
          name: true,
          teacher: {
            select: {
              displayName: true,
            },
          },
        },
      },
      questions: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          order: true,
          prompt: true,
          questionType: true,
          points: true,
          options: true,
          imagePath: true,
          imageCaption: true,
          imageAltText: true,
        },
      },
      submissions: {
        where: { studentId },
        take: 1,
        select: {
          id: true,
          status: true,
          submittedAt: true,
          updatedAt: true,
          answers: {
            select: {
              questionId: true,
              answerText: true,
            },
          },
        },
      },
    },
  });

  if (!assignment) {
    return null;
  }

  const submission = assignment.submissions[0] ?? null;
  const answersByQuestionId = new Map(
    submission?.answers
      .filter((answer) => answer.questionId !== null)
      .map((answer) => [answer.questionId, answer.answerText]) ?? [],
  );
  const totalPoints = assignment.questions.reduce<number | null>(
    (total, question) =>
      question.points === null ? total : (total ?? 0) + question.points,
    null,
  );

  return {
    id: assignment.id,
    title: assignment.title,
    description: assignment.description,
    status: assignment.status,
    dueAt: assignment.dueAt,
    class: assignment.class,
    questions: assignment.questions.map((question) => ({
      ...question,
      answerText: answersByQuestionId.get(question.id) ?? "",
    })),
    submission: submission
      ? {
          id: submission.id,
          status: submission.status,
          submittedAt: submission.submittedAt,
          updatedAt: submission.updatedAt,
        }
      : null,
    totals: {
      questions: assignment.questions.length,
      points: totalPoints,
    },
  };
}
