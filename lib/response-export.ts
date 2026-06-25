import type { UserRole } from "@prisma/client";
import { normalizeAssignmentKeyVocabulary, type AssignmentKeyVocabularyItem } from "./assignment-key-vocabulary";
import { prisma } from "./prisma";

export const RESPONSE_EXPORT_FORMAT = "homework-assignment-responses-v2";

export type AssignmentResponseExport = {
  exportFormat: typeof RESPONSE_EXPORT_FORMAT;
  exportVersion: 2;
  generatedAt: string;
  assignment: {
    id: number;
    title: string;
    titleI18n: unknown;
    instructions: string | null;
    instructionsI18n: unknown;
    status: string;
    dueAt: string | null;
    class: {
      id: number;
      name: string;
    };
  };
  keyVocabulary: AssignmentKeyVocabularyItem[];
  questions: {
    id: number;
    order: number;
    prompt: string;
    promptI18n: unknown;
    questionType: string;
    points: number | null;
    options?: unknown;
    image: {
      path: string | null;
      caption: string | null;
      altText: string | null;
    };
  }[];
  participants: {
    id: number;
    name: string;
    email: string | null;
    submission: {
      id: number;
      status: string;
      savedAt: string;
      submittedAt: string | null;
      responsesByQuestionId: Record<string, string>;
    } | null;
  }[];
  totals: {
    questions: number;
    participants: number;
    responses: number;
  };
};

export async function getAssignmentResponseExportData(
  classId: number,
  assignmentId: number,
  viewer: { id: number; role: UserRole } | null,
): Promise<{ exportData: AssignmentResponseExport | null; markdown: string | null; canView: boolean; found: boolean }> {
  const assignment = await prisma.homeworkAssignment.findFirst({
    where: { id: assignmentId, classId },
    select: {
      id: true,
      title: true,
      titleI18n: true,
      description: true,
      descriptionI18n: true,
      status: true,
      dueAt: true,
      keyVocabulary: true,
      class: {
        select: {
          id: true,
          name: true,
          teacherId: true,
          enrollments: {
            orderBy: { student: { displayName: "asc" } },
            select: {
              student: {
                select: { id: true, displayName: true, email: true },
              },
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
          options: true,
          questionType: true,
          points: true,
          imagePath: true,
          imageCaption: true,
          imageAltText: true,
        },
      },
      submissions: {
        orderBy: { student: { displayName: "asc" } },
        select: {
          id: true,
          studentId: true,
          status: true,
          submittedAt: true,
          updatedAt: true,
          answers: {
            select: { questionId: true, answerText: true },
          },
        },
      },
    },
  });

  if (!assignment) {
    return { exportData: null, markdown: null, canView: false, found: false };
  }

  const canView = viewer?.role === "TEACHER" && viewer.id === assignment.class.teacherId;

  if (!canView) {
    return { exportData: null, markdown: null, canView, found: true };
  }

  const submissionsByStudentId = new Map(assignment.submissions.map((submission) => [submission.studentId, submission]));

  const exportData: AssignmentResponseExport = {
    exportFormat: RESPONSE_EXPORT_FORMAT,
    exportVersion: 2,
    generatedAt: new Date().toISOString(),
    assignment: {
      id: assignment.id,
      title: assignment.title,
      titleI18n: assignment.titleI18n,
      instructions: assignment.description,
      instructionsI18n: assignment.descriptionI18n,
      status: assignment.status,
      dueAt: assignment.dueAt?.toISOString() ?? null,
      class: {
        id: assignment.class.id,
        name: assignment.class.name,
      },
    },
    keyVocabulary: normalizeAssignmentKeyVocabulary(assignment.keyVocabulary),
    questions: assignment.questions.map((question) => ({
      id: question.id,
      order: question.order,
      prompt: question.prompt,
      promptI18n: question.promptI18n,
      options: question.options,
      questionType: question.questionType,
      points: question.points,
      image: {
        path: question.imagePath,
        caption: question.imageCaption,
        altText: question.imageAltText,
      },
    })),
    participants: assignment.class.enrollments.map((enrollment) => {
      const submission = submissionsByStudentId.get(enrollment.student.id) ?? null;

      return {
        id: enrollment.student.id,
        name: enrollment.student.displayName,
        email: enrollment.student.email,
        submission: submission
          ? {
              id: submission.id,
              status: submission.status,
              savedAt: submission.updatedAt.toISOString(),
              submittedAt: submission.submittedAt?.toISOString() ?? null,
              responsesByQuestionId: Object.fromEntries(
                submission.answers
                  .filter((answer) => answer.questionId !== null)
                  .map((answer) => [String(answer.questionId), answer.answerText]),
              ),
            }
          : null,
      };
    }),
    totals: {
      questions: assignment.questions.length,
      participants: assignment.class.enrollments.length,
      responses: assignment.submissions.length,
    },
  };

  return {
    exportData,
    markdown: buildAssignmentResponseMarkdown(exportData),
    canView,
    found: true,
  };
}

function hasLocalizedText(value: unknown): boolean {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (!value || typeof value !== "object") {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some(hasLocalizedText);
  }

  return Object.values(value).some(hasLocalizedText);
}

function hasBilingualOptionContent(options: unknown): boolean {
  if (!options || typeof options !== "object") {
    return false;
  }

  if (Array.isArray(options)) {
    return options.some(hasBilingualOptionContent);
  }

  return Object.entries(options).some(([key, value]) =>
    key.toLowerCase().includes("i18n") ? hasLocalizedText(value) : hasBilingualOptionContent(value),
  );
}

export function assignmentResponseExportHasBilingualContent(exportData: AssignmentResponseExport) {
  return (
    hasLocalizedText(exportData.assignment.titleI18n) ||
    hasLocalizedText(exportData.assignment.instructionsI18n) ||
    exportData.questions.some((question) =>
      hasLocalizedText(question.promptI18n) || hasBilingualOptionContent(question.options),
    ) ||
    exportData.keyVocabulary.some((item) =>
      hasLocalizedText(item.chineseTerm) ||
      hasLocalizedText(item.chineseDefinition) ||
      hasLocalizedText(item.termI18n) ||
      hasLocalizedText(item.definitionI18n),
    )
  );
}

function buildAssignmentResponseMarkdown(exportData: AssignmentResponseExport) {
  const questionById = new Map(exportData.questions.map((question) => [String(question.id), question]));
  const lines = [
    `# ${exportData.assignment.title}`,
    "",
    `- Export format: ${exportData.exportFormat}`,
    `- Export version: ${exportData.exportVersion}`,
    `- Assignment ID: ${exportData.assignment.id}`,
    `- Class: ${exportData.assignment.class.name} (${exportData.assignment.class.id})`,
    `- Status: ${exportData.assignment.status}`,
    `- Instructions: ${exportData.assignment.instructions ?? "No instructions"}`,
    `- Due: ${exportData.assignment.dueAt ?? "No due date"}`,
    `- Generated: ${exportData.generatedAt}`,
    "",
    "## Key vocabulary / 关键词",
    "",
  ];

  if (exportData.keyVocabulary.length === 0) {
    lines.push("No key vocabulary was supplied for this assignment.", "");
  } else {
    for (const item of exportData.keyVocabulary) {
      lines.push(
        `### ${item.englishTerm} / ${item.chineseTerm}`,
        "",
        `- English definition: ${item.englishDefinition}`,
        `- Chinese definition: ${item.chineseDefinition}`,
        `- Category: ${item.category ?? "Not set"}`,
        `- Linked question IDs: ${item.questionIds.length > 0 ? item.questionIds.join(", ") : "None"}`,
        "",
      );
    }
  }

  lines.push(
    "## Questions",
    "",
  );

  if (exportData.questions.length === 0) {
    lines.push("No questions are available for this assignment.", "");
  } else {
    for (const question of exportData.questions) {
      lines.push(
        `### Question ${question.order} (${question.questionType})`,
        "",
        `- Question ID: ${question.id}`,
        `- Points: ${question.points ?? "Not set"}`,
        `- Prompt: ${question.prompt}`,
        `- Image path: ${question.image.path ?? "None"}`,
        `- Image caption: ${question.image.caption ?? "None"}`,
        `- Image alt text: ${question.image.altText ?? "None"}`,
        "",
      );
    }
  }

  lines.push("## Participant responses", "");

  if (exportData.totals.responses === 0) {
    lines.push("No responses have been saved or submitted for this assignment yet.", "");
  }

  for (const participant of exportData.participants) {
    lines.push(`### ${participant.name}`, "", `- Participant ID: ${participant.id}`, `- Email: ${participant.email ?? "Not available"}`);

    if (!participant.submission) {
      lines.push("- Submission: Not started", "");
      continue;
    }

    lines.push(
      `- Submission ID: ${participant.submission.id}`,
      `- Status: ${participant.submission.status}`,
      `- Saved at: ${participant.submission.savedAt}`,
      `- Submitted at: ${participant.submission.submittedAt ?? "Not submitted"}`,
      "",
    );

    for (const question of exportData.questions) {
      const answer = participant.submission.responsesByQuestionId[String(question.id)] ?? "";
      lines.push(`**Question ${question.order} (${question.id})**`, "", question.prompt, "", answer || "No answer saved.", "");
    }

    for (const [questionId, answer] of Object.entries(participant.submission.responsesByQuestionId)) {
      if (!questionById.has(questionId)) {
        lines.push(`**Legacy question ID ${questionId}**`, "", answer || "No answer saved.", "");
      }
    }
  }

  return lines.join("\n");
}
