import { HomeworkAssignmentStatus } from "@prisma/client";
import { normalizeAssignmentKeyVocabulary, type AssignmentKeyVocabularyItem } from "./assignment-key-vocabulary";
import { prisma } from "./prisma";

export type ParticipantWorkData = {
  id: number;
  title: string;
  titleI18n: unknown;
  description: string | null;
  descriptionI18n: unknown;
  keyVocabulary: AssignmentKeyVocabularyItem[];
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
    promptI18n: unknown;
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
  feedback: {
    id: number;
    overallFeedback: string;
    overallFeedbackI18n: unknown;
    strengths: string[];
    strengthsI18n: unknown;
    targets: string[];
    targetsI18n: unknown;
    createdAt: Date;
    updatedAt: Date;
    feedbackImport: {
      importedAt: Date;
      generatedBy: string | null;
      generatedAt: Date | null;
    };
    questionFeedback: {
      id: number;
      questionId: number | null;
      questionOrder: number | null;
      feedback: string;
      feedbackI18n: unknown;
      strengths: string[];
      strengthsI18n: unknown;
      targets: string[];
      targetsI18n: unknown;
      followUpActions: {
        id: number;
        sourceActionId: string;
        type: string;
        prompt: string;
        promptI18n: unknown;
        required: boolean;
        status: string;
        responseText: string | null;
        completedAt: Date | null;
      }[];
    }[];
    followUpActions: {
      id: number;
      sourceActionId: string;
      type: string;
      prompt: string;
      promptI18n: unknown;
      required: boolean;
      status: string;
      responseText: string | null;
      completedAt: Date | null;
    }[];
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
      status: HomeworkAssignmentStatus.PUBLISHED,
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
          promptI18n: true,
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
      participantFeedback: {
        where: { studentId },
        orderBy: [
          { feedbackImport: { importedAt: "desc" } },
          { updatedAt: "desc" },
        ],
        take: 1,
        select: {
          id: true,
          overallFeedback: true,
          overallFeedbackI18n: true,
          strengths: true,
          strengthsI18n: true,
          targets: true,
          targetsI18n: true,
          createdAt: true,
          updatedAt: true,
          feedbackImport: {
            select: {
              importedAt: true,
              generatedBy: true,
              generatedAt: true,
            },
          },
          questionFeedback: {
            orderBy: [{ questionOrder: "asc" }, { id: "asc" }],
            select: {
              id: true,
              questionId: true,
              questionOrder: true,
              feedback: true,
              feedbackI18n: true,
              strengths: true,
              strengthsI18n: true,
              targets: true,
              targetsI18n: true,
              followUpActions: {
                orderBy: { id: "asc" },
                select: {
                  id: true,
                  sourceActionId: true,
                  type: true,
                  prompt: true,
                  promptI18n: true,
                  required: true,
                  status: true,
                  responseText: true,
                  completedAt: true,
                },
              },
            },
          },
          followUpActions: {
            where: { questionFeedbackId: null },
            orderBy: { id: "asc" },
            select: {
              id: true,
              sourceActionId: true,
              type: true,
              prompt: true,
              promptI18n: true,
              required: true,
              status: true,
              responseText: true,
              completedAt: true,
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
  const feedback = assignment.participantFeedback[0] ?? null;
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
    titleI18n: assignment.titleI18n,
    description: assignment.description,
    descriptionI18n: assignment.descriptionI18n,
    keyVocabulary: normalizeAssignmentKeyVocabulary(assignment.keyVocabulary),
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
    feedback,
    totals: {
      questions: assignment.questions.length,
      points: totalPoints,
    },
  };
}
