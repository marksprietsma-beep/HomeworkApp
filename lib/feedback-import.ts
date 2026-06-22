import type { UserRole } from "@prisma/client";
import { prisma } from "./prisma";

export type FeedbackImportPageData = Awaited<ReturnType<typeof getFeedbackImportPageData>>;

export async function getFeedbackImportPageData(
  classId: number,
  assignmentId: number,
  viewer: { id: number; role: UserRole } | null,
) {
  const assignment = await prisma.homeworkAssignment.findFirst({
    where: { id: assignmentId, classId },
    select: {
      id: true,
      title: true,
      status: true,
      class: {
        select: {
          id: true,
          name: true,
          teacherId: true,
          teacher: { select: { id: true, displayName: true, email: true } },
          enrollments: {
            orderBy: { student: { displayName: "asc" } },
            select: { student: { select: { id: true, displayName: true, email: true } } },
          },
        },
      },
      questions: { orderBy: { order: "asc" }, select: { id: true, order: true, prompt: true } },
      submissions: {
        orderBy: { student: { displayName: "asc" } },
        select: {
          id: true,
          studentId: true,
          status: true,
          submittedAt: true,
          updatedAt: true,
          student: { select: { id: true, displayName: true, email: true } },
          answers: { select: { questionId: true, answerText: true } },
        },
      },
      feedbackImports: { orderBy: { importedAt: "desc" }, select: { id: true, importedAt: true, generatedBy: true } },
    },
  });

  if (!assignment) return { found: false as const, canImport: false, assignment: null, context: null, existingImports: [] };

  const canImport = viewer?.role === "TEACHER" && viewer.id === assignment.class.teacherId;
  if (!canImport) return { found: true as const, canImport, assignment, context: null, existingImports: assignment.feedbackImports };

  const submissionsByStudentId = new Map(assignment.submissions.map((submission) => [submission.studentId, submission]));
  const participants = assignment.class.enrollments.map((enrollment) => {
    const submission = submissionsByStudentId.get(enrollment.student.id) ?? null;
    return {
      id: enrollment.student.id,
      name: enrollment.student.displayName,
      email: enrollment.student.email,
      submission: submission
        ? {
            id: submission.id,
            status: submission.status,
            responsesByQuestionId: Object.fromEntries(
              submission.answers
                .filter((answer) => answer.questionId !== null)
                .map((answer) => [String(answer.questionId), answer.answerText]),
            ),
          }
        : null,
    };
  });

  return {
    found: true as const,
    canImport,
    assignment,
    existingImports: assignment.feedbackImports,
    context: {
      assignmentId: assignment.id,
      classId: assignment.class.id,
      assignment: { id: assignment.id, class: { id: assignment.class.id } },
      class: { id: assignment.class.id },
      questions: assignment.questions.map((question) => ({ id: question.id, order: question.order, prompt: question.prompt })),
      participants,
    },
  };
}
