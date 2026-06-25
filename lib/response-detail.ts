import type { UserRole } from "@prisma/client";
import { prisma } from "./prisma";

export type ResponseDetailData = {
  id: number;
  status: string;
  submittedAt: Date | null;
  updatedAt: Date;
  participant: {
    id: number;
    displayName: string;
    email: string;
  };
  assignment: {
    id: number;
    title: string;
    status: string;
    dueAt: Date | null;
    class: {
      id: number;
      name: string;
      teacherId: number;
    };
  };
  questions: {
    id: number;
    order: number;
    prompt: string;
    questionType: string;
    responseMode: string;
    options: unknown;
    points: number | null;
    imagePath: string | null;
    imageCaption: string | null;
    imageAltText: string | null;
    answerText: string;
  }[];
};

export async function getResponseDetailData(
  classId: number,
  assignmentId: number,
  submissionId: number,
  viewer: { id: number; role: UserRole } | null,
): Promise<{ response: ResponseDetailData | null; canView: boolean; found: boolean }> {
  const submission = await prisma.submission.findFirst({
    where: {
      id: submissionId,
      assignmentId,
      assignment: {
        classId,
      },
    },
    select: {
      id: true,
      status: true,
      submittedAt: true,
      updatedAt: true,
      student: {
        select: {
          id: true,
          displayName: true,
          email: true,
        },
      },
      assignment: {
        select: {
          id: true,
          title: true,
          status: true,
          dueAt: true,
          class: {
            select: {
              id: true,
              name: true,
              teacherId: true,
            },
          },
          questions: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              order: true,
              prompt: true,
              questionType: true,
              responseMode: true,
              options: true,
              points: true,
              imagePath: true,
              imageCaption: true,
              imageAltText: true,
            },
          },
        },
      },
      answers: {
        select: {
          questionId: true,
          answerText: true,
        },
      },
    },
  });

  if (!submission) {
    return { response: null, canView: false, found: false };
  }

  const canView = viewer?.role === "TEACHER" && viewer.id === submission.assignment.class.teacherId;

  if (!canView) {
    return { response: null, canView, found: true };
  }

  const answersByQuestionId = new Map(
    submission.answers
      .filter((answer) => answer.questionId !== null)
      .map((answer) => [answer.questionId, answer.answerText]),
  );

  return {
    response: {
      id: submission.id,
      status: submission.status,
      submittedAt: submission.submittedAt,
      updatedAt: submission.updatedAt,
      participant: submission.student,
      assignment: {
        id: submission.assignment.id,
        title: submission.assignment.title,
        status: submission.assignment.status,
        dueAt: submission.assignment.dueAt,
        class: submission.assignment.class,
      },
      questions: submission.assignment.questions.map((question) => ({
        ...question,
        answerText: answersByQuestionId.get(question.id) ?? "",
      })),
    },
    canView,
    found: true,
  };
}
