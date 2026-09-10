"use server";

import { HomeworkAssignmentStatus, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserState } from "../../../../../lib/auth";
import { canActAsClassTeacher } from "../../../../../lib/permissions";
import { prisma } from "../../../../../lib/prisma";
import { transitionAssignmentStatus } from "../../../../../lib/email-notifications";

export async function updateAssignmentPublishStatus(
  classId: number,
  assignmentId: number,
  formData: FormData,
) {
  const requestedStatus = String(formData.get("status") ?? "");

  if (
    requestedStatus !== HomeworkAssignmentStatus.DRAFT &&
    requestedStatus !== HomeworkAssignmentStatus.PUBLISHED
  ) {
    throw new Error("Assignments can only be changed to draft or published.");
  }

  const { selectedUser } = await getCurrentUserState();

  if (!selectedUser || selectedUser.role === UserRole.STUDENT) {
    throw new Error("You must be signed in as the assigned teacher or an ADMIN account to change assignment status.");
  }

  const assignment = await prisma.homeworkAssignment.findFirst({
    where: {
      id: assignmentId,
      classId,
      ...(selectedUser.role === UserRole.ADMIN
        ? {}
        : {
            class: {
              teacherId: selectedUser.id,
            },
          }),
    },
    select: { id: true },
  });

  if (!assignment) {
    throw new Error("Only admins or the teacher who owns this class can change assignment status.");
  }

  await prisma.$transaction((tx) => transitionAssignmentStatus(tx, assignment.id, requestedStatus as HomeworkAssignmentStatus));

  revalidatePath("/");
  revalidatePath(`/classes/${classId}`);
  revalidatePath(`/classes/${classId}/assignments/${assignmentId}`);
  revalidatePath(`/assignments/${assignmentId}/work`);

  redirect(
    `/classes/${classId}/assignments/${assignmentId}?statusUpdated=${requestedStatus.toLowerCase()}`,
  );
}

export async function duplicateAssignmentForClass(
  classId: number,
  assignmentId: number,
) {
  if (!Number.isInteger(classId) || !Number.isInteger(assignmentId)) {
    throw new Error("Choose an existing assignment to duplicate.");
  }

  const { selectedUser } = await getCurrentUserState();

  if (!canActAsClassTeacher(selectedUser)) {
    throw new Error("You must be signed in as the class teacher or an ADMIN account to duplicate this assignment.");
  }

  const assignment = await prisma.homeworkAssignment.findFirst({
    where: {
      id: assignmentId,
      classId,
      class: {
        teacherId: selectedUser.id,
      },
    },
    include: {
      questions: {
        orderBy: { order: "asc" },
        select: {
          order: true,
          prompt: true,
          promptI18n: true,
          questionType: true,
          responseMode: true,
          pseudocodeDialect: true,
          responseSchema: true,
          points: true,
          options: true,
          imagePath: true,
          imageCaption: true,
          imageAltText: true,
        },
      },
    },
  });

  if (!assignment) {
    throw new Error("Only the teacher who owns this class can duplicate this assignment.");
  }

  const duplicate = await prisma.homeworkAssignment.create({
    data: {
      classId: assignment.classId,
      createdById: selectedUser.id,
      title: `${assignment.title} (Copy)`,
      titleI18n: assignment.titleI18n ?? undefined,
      description: assignment.description,
      descriptionI18n: assignment.descriptionI18n ?? undefined,
      keyVocabulary: assignment.keyVocabulary ?? undefined,
      dueAt: assignment.dueAt,
      status: HomeworkAssignmentStatus.DRAFT,
      questions: {
        create: assignment.questions.map((question) => ({
          order: question.order,
          prompt: question.prompt,
          promptI18n: question.promptI18n ?? undefined,
          questionType: question.questionType,
          responseMode: question.responseMode,
          pseudocodeDialect: question.pseudocodeDialect,
          responseSchema: question.responseSchema ?? undefined,
          points: question.points,
          options: question.options ?? undefined,
          imagePath: question.imagePath,
          imageCaption: question.imageCaption,
          imageAltText: question.imageAltText,
        })),
      },
    },
    select: { id: true },
  });

  revalidatePath("/");
  revalidatePath(`/classes/${classId}`);
  revalidatePath(`/classes/${classId}/assignments/${assignmentId}`);
  revalidatePath(`/classes/${classId}/assignments/${duplicate.id}`);

  redirect(`/classes/${classId}/assignments/${duplicate.id}?duplicated=1`);
}
