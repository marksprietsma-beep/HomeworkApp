"use server";

import { SubmissionStatus } from "@prisma/client";
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
    throw new Error("Assignment was not found for the selected participant.");
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
      const answerText = typeof rawAnswer === "string" ? rawAnswer.trim() : "";

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
