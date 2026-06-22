"use server";

import { HomeworkAssignmentStatus, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getSelectedLocalDevelopmentUser } from "../../../../../lib/local-dev-user";
import { prisma } from "../../../../../lib/prisma";

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

  const { selectedUser } = await getSelectedLocalDevelopmentUser();

  if (!selectedUser || selectedUser.role !== UserRole.TEACHER) {
    throw new Error("Switch to the class teacher user to change assignment status.");
  }

  const assignment = await prisma.homeworkAssignment.findFirst({
    where: {
      id: assignmentId,
      classId,
      class: {
        teacherId: selectedUser.id,
      },
    },
    select: { id: true },
  });

  if (!assignment) {
    throw new Error("Only the teacher who owns this class can change assignment status.");
  }

  await prisma.homeworkAssignment.update({
    where: { id: assignment.id },
    data: { status: requestedStatus },
  });

  revalidatePath("/");
  revalidatePath(`/classes/${classId}`);
  revalidatePath(`/classes/${classId}/assignments/${assignmentId}`);
  revalidatePath(`/assignments/${assignmentId}/work`);
}
