import { normalizeAssignmentKeyVocabulary } from "./assignment-key-vocabulary";
import { prisma } from "./prisma";

export type HomeworkDetailData = {
  id: number;
  title: string;
  titleI18n: unknown;
  description: string | null;
  descriptionI18n: unknown;
  keyVocabulary: import("./assignment-key-vocabulary").AssignmentKeyVocabularyItem[];
  status: string;
  dueAt: Date | null;
  class: {
    id: number;
    name: string;
    enrollments: {
      student: {
        id: number;
        displayName: string;
        email: string;
      };
    }[];
    teacher: {
      id: number;
      displayName: string;
      email: string;
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
  }[];
  submissions: {
    id: number;
    status: string;
    submittedAt: Date | null;
    updatedAt: Date;
    studentId: number;
    student: {
      id: number;
      displayName: string;
      email: string;
    };
  }[];
  participantFeedback: {
    studentId: number | null;
    submissionId: number | null;
    releaseState: string;
    importedAt: Date;
    followUpActions: { status: string }[];
    questionFeedback: { followUpActions: { status: string }[] }[];
  }[];
  totals: {
    questions: number;
    submissions: number;
    points: number;
  };
};

export async function getHomeworkDetailData(
  classId: number,
  assignmentId: number,
): Promise<HomeworkDetailData | null> {
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
          teacher: {
            select: {
              id: true,
              displayName: true,
              email: true,
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
        orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          status: true,
          submittedAt: true,
          updatedAt: true,
          studentId: true,
          student: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
      },
      participantFeedback: {
        orderBy: [
          { feedbackImport: { importedAt: "desc" } },
          { updatedAt: "desc" },
        ],
        select: {
          studentId: true,
          submissionId: true,
          releaseState: true,
          importedAt: true,
          followUpActions: { select: { status: true } },
          questionFeedback: {
            select: {
              followUpActions: { select: { status: true } },
            },
          },
        },
      },
      _count: {
        select: {
          questions: true,
          submissions: true,
        },
      },
    },
  });

  if (!assignment) {
    return null;
  }

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
    questions: assignment.questions,
    submissions: assignment.submissions,
    participantFeedback: assignment.participantFeedback,
    totals: {
      questions: assignment._count.questions,
      submissions: assignment._count.submissions,
      points: assignment.questions.reduce((total, question) => total + (question.points ?? 0), 0),
    },
  };
}
