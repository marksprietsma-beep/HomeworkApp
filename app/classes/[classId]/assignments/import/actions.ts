"use server";

import { HomeworkAssignmentStatus, HomeworkQuestionType, UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { parseAssignmentImportJson } from "../../../../../lib/assignment-import-parser.mjs";
import { getSelectedLocalDevelopmentUser } from "../../../../../lib/local-dev-user";
import { prisma } from "../../../../../lib/prisma";
import { storeAssignmentQuestionImage } from "../../../../../lib/local-media";

type AssignmentImportQuestion = {
  order: number;
  type: "OPEN_TEXT" | "LONG_TEXT" | "MULTIPLE_CHOICE";
  prompt: string;
  points: number | null;
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

function valueAt(values: FormDataEntryValue[], index: number) {
  const value = values[index];
  return typeof value === "string" ? value.trim() : "";
}

function isUploadedFile(value: FormDataEntryValue | undefined): value is File {
  return typeof value === "object" && value !== null && "arrayBuffer" in value && value.size > 0;
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

  const imageFiles = formData.getAll("questionImageFile");
  const imageCaptions = formData.getAll("questionImageCaption");
  const imageAltTexts = formData.getAll("questionImageAltText");

  const questions = await Promise.all(importedAssignment.questions.map(async (question: AssignmentImportQuestion, index) => {
    const caption = valueAt(imageCaptions, index) || question.image?.caption || "";
    const altText = valueAt(imageAltTexts, index) || question.image?.altText || "";
    const imageFile = imageFiles[index];
    const storedImage = isUploadedFile(imageFile)
      ? await storeAssignmentQuestionImage(imageFile, { caption, altText })
      : null;

    return {
      order: question.order,
      prompt: question.prompt,
      questionType: question.type as HomeworkQuestionType,
      points: question.points,
      options:
        question.type === "MULTIPLE_CHOICE"
          ? { choices: question.options.map((option) => option.text) }
          : undefined,
      imagePath: storedImage?.path || question.image?.path,
      imageCaption: storedImage?.caption || caption || undefined,
      imageAltText: storedImage?.altText || altText || undefined,
    };
  }));

  const assignment = await prisma.homeworkAssignment.create({
    data: {
      classId,
      createdById: selectedUser.id,
      title: importedAssignment.title,
      description: importedAssignment.instructions,
      status: importedAssignment.status as HomeworkAssignmentStatus,
      dueAt: dueDateToDateTime(importedAssignment.dueDate),
      questions: {
        create: questions,
      },
    },
    select: { id: true },
  });

  redirect(`/classes/${classId}/assignments/${assignment.id}`);
}
