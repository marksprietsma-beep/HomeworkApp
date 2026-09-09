"use server";

import { Prisma, SubmissionStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserState } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { validateStructuredAnswer, structuredFields } from "../../../../lib/structured-response";
import { studentAssignmentAccessWhere, studentFeedbackActionAccessWhere } from "../../../../lib/access-control";

export async function saveParticipantSubmission(
  assignmentId: number,
  formData: FormData,
) {
  const { selectedUser } = await getCurrentUserState();

  if (!selectedUser || selectedUser.role !== "STUDENT") {
    throw new Error("Select a local development participant before saving.");
  }

  const assignment = await prisma.homeworkAssignment.findFirst({
    where: studentAssignmentAccessWhere(assignmentId, selectedUser),
    select: {
      id: true,
      questions: {
        select: {
          id: true,
          responseMode: true,
          responseSchema: true,
        },
      },
    },
  });

  if (!assignment) {
    throw new Error("Assignment is not published for the selected participant.");
  }

  const saveAsDraft = formData.get("submissionIntent") === "DRAFT";

  await prisma.$transaction(async (tx) => {
    const submission = await tx.submission.upsert({
      where: {
        assignmentId_studentId: {
          assignmentId,
          studentId: selectedUser.id,
        },
      },
      update: {
        status: saveAsDraft ? SubmissionStatus.DRAFT : SubmissionStatus.SUBMITTED,
        submittedAt: saveAsDraft ? null : new Date(),
      },
      create: {
        assignmentId,
        studentId: selectedUser.id,
        status: saveAsDraft ? SubmissionStatus.DRAFT : SubmissionStatus.SUBMITTED,
        submittedAt: saveAsDraft ? null : new Date(),
      },
      select: { id: true },
    });

    for (const question of assignment.questions) {
      const rawAnswer = formData.get(`question-${question.id}`);
      const answerText = question.responseMode === "STRUCTURED" ? "" : typeof rawAnswer === "string" ? rawAnswer : "";
      const answerData = question.responseMode === "STRUCTURED"
        ? validateStructuredAnswer(question.responseSchema, { schemaVersion: 1, values: Object.fromEntries(structuredFields(question.responseSchema).map((field) => [field.id, String(formData.get(`structured-${question.id}-${field.id}`) ?? "")])) })
        : null;

      await tx.submissionAnswer.upsert({
        where: {
          submissionId_questionId: {
            submissionId: submission.id,
            questionId: question.id,
          },
        },
        update: { answerText, answerData: answerData as Prisma.InputJsonValue ?? Prisma.JsonNull },
        create: {
          submissionId: submission.id,
          questionId: question.id,
          answerText,
          answerData: answerData as Prisma.InputJsonValue ?? undefined,
        },
      });
    }
  });

  revalidatePath("/");
  revalidatePath(`/assignments/${assignmentId}/work`);
  redirect(`/assignments/${assignmentId}/work?saved=1`);
}


export async function completeFeedbackFollowUpAction(
  assignmentId: number,
  actionId: number,
  formData: FormData,
) {
  const { selectedUser } = await getCurrentUserState();

  if (!selectedUser || selectedUser.role !== "STUDENT") {
    throw new Error("Select a local development participant before saving feedback actions.");
  }

  const action = await prisma.feedbackFollowUpAction.findFirst({
    where: studentFeedbackActionAccessWhere(actionId, assignmentId, selectedUser),
    select: {
      id: true,
      type: true,
      status: true,
    },
  });

  if (!action) {
    throw new Error("Feedback action was not found for the selected participant.");
  }

  if (action.status === "COMPLETED") {
    redirect(`/assignments/${assignmentId}/work?feedbackAction=already-completed#feedback`);
  }

  const rawResponse = formData.get("responseText");
  const responseText = typeof rawResponse === "string" ? rawResponse.trim() : "";

  if (action.type !== "ACKNOWLEDGEMENT" && responseText.length === 0) {
    throw new Error("Write a short response before completing this feedback action.");
  }

  await prisma.feedbackFollowUpAction.update({
    where: { id: action.id },
    data: {
      status: "COMPLETED",
      responseText: action.type === "ACKNOWLEDGEMENT" ? null : responseText,
      completedAt: new Date(),
    },
  });

  revalidatePath(`/assignments/${assignmentId}/work`);
  redirect(`/assignments/${assignmentId}/work?feedbackAction=completed#feedback`);
}
