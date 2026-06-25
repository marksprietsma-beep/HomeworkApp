"use server";

import { HomeworkAssignmentStatus, SubmissionStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSelectedLocalDevelopmentUser } from "../../../../lib/local-dev-user";
import { prisma } from "../../../../lib/prisma";

export async function saveParticipantSubmission(
  assignmentId: number,
  formData: FormData,
) {
  const { selectedUser } = await getSelectedLocalDevelopmentUser();

  if (!selectedUser || selectedUser.role !== "STUDENT") {
    throw new Error("Select a local development participant before saving.");
  }

  const assignment = await prisma.homeworkAssignment.findFirst({
    where: {
      id: assignmentId,
      status: HomeworkAssignmentStatus.PUBLISHED,
      class: {
        enrollments: {
          some: { studentId: selectedUser.id },
        },
      },
    },
    select: {
      id: true,
      questions: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!assignment) {
    throw new Error("Assignment is not published for the selected participant.");
  }

  await prisma.$transaction(async (tx) => {
    const submission = await tx.submission.upsert({
      where: {
        assignmentId_studentId: {
          assignmentId,
          studentId: selectedUser.id,
        },
      },
      update: {
        status: SubmissionStatus.SUBMITTED,
        submittedAt: new Date(),
      },
      create: {
        assignmentId,
        studentId: selectedUser.id,
        status: SubmissionStatus.SUBMITTED,
        submittedAt: new Date(),
      },
      select: { id: true },
    });

    for (const question of assignment.questions) {
      const rawAnswer = formData.get(`question-${question.id}`);
      const answerText = typeof rawAnswer === "string" ? rawAnswer : "";

      await tx.submissionAnswer.upsert({
        where: {
          submissionId_questionId: {
            submissionId: submission.id,
            questionId: question.id,
          },
        },
        update: { answerText },
        create: {
          submissionId: submission.id,
          questionId: question.id,
          answerText,
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
  const { selectedUser } = await getSelectedLocalDevelopmentUser();

  if (!selectedUser || selectedUser.role !== "STUDENT") {
    throw new Error("Select a local development participant before saving feedback actions.");
  }

  const action = await prisma.feedbackFollowUpAction.findFirst({
    where: {
      id: actionId,
      participantFeedback: {
        assignmentId,
        studentId: selectedUser.id,
      },
    },
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
