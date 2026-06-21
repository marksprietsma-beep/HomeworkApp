"use server";

import { HomeworkAssignmentStatus, HomeworkQuestionType, UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { parseAssignmentImportJson } from "../../../../../lib/assignment-import-parser.mjs";
import { getSelectedLocalDevelopmentUser } from "../../../../../lib/local-dev-user";
import { prisma } from "../../../../../lib/prisma";

type AssignmentImportQuestion = {
  order: number;
  type: "OPEN_TEXT" | "LONG_TEXT" | "MULTIPLE_CHOICE";
  prompt: string;
  marks: number | null;
  options: { id: string; text: string }[];
  image: { path: string; caption: string; altText: string } | null;
};

type AssignmentImportAssignment = {
  title: string;
  instructions: string;
  dueDate: string | null;
  status: "DRAFT" | "PUBLISHED";
  questions: AssignmentImportQuestion[];
};

function dueDateToDateTime(dueDate: string | null) {
  return dueDate ? new Date(`${dueDate}T00:00:00.000Z`) : null;
}

export async function importAssignmentForClass(classId: number, formData: FormData) {
  if (!Number.isInteger(classId)) {
    throw new Error("Choose an existing class.");
  }

  const rawJson = String(formData.get("rawJson") ?? "");
  const parseResult = parseAssignmentImportJson(rawJson);

  if (!parseResult.ok) {
    throw new Error(
      `Fix the assignment JSON before saving: ${parseResult.errors
        .map((error) => `${error.path} ${error.message}`)
        .join("; ")}`,
    );
  }

  const importedAssignment = parseResult.assignment as AssignmentImportAssignment | null;

  if (!importedAssignment) {
    throw new Error("Fix the assignment JSON before saving.");
  }

  const { selectedUser } = await getSelectedLocalDevelopmentUser();

  if (!selectedUser || selectedUser.role !== UserRole.TEACHER) {
    throw new Error("Switch to the seeded teacher user to import assignments.");
  }

  const classItem = await prisma.class.findFirst({
    where: {
      id: classId,
      teacherId: selectedUser.id,
    },
    select: { id: true },
  });

  if (!classItem) {
    throw new Error("The selected teacher does not teach this class.");
  }

  const assignment = await prisma.homeworkAssignment.create({
    data: {
      classId,
      createdById: selectedUser.id,
      title: importedAssignment.title,
      description: importedAssignment.instructions,
      status: importedAssignment.status as HomeworkAssignmentStatus,
      dueAt: dueDateToDateTime(importedAssignment.dueDate),
      questions: {
        create: importedAssignment.questions.map((question: AssignmentImportQuestion) => ({
          order: question.order,
          prompt: question.prompt,
          questionType: question.type as HomeworkQuestionType,
          points: question.marks,
          options:
            question.type === "MULTIPLE_CHOICE"
              ? { choices: question.options.map((option) => option.text) }
              : undefined,
          imagePath: question.image?.path,
          imageCaption: question.image?.caption || undefined,
          imageAltText: question.image?.altText || undefined,
        })),
      },
    },
    select: { id: true },
  });

  redirect(`/classes/${classId}/assignments/${assignment.id}`);
}
