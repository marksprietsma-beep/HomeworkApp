"use server";

import { HomeworkAssignmentStatus, HomeworkQuestionType, UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "../../../lib/prisma";
import { getSelectedLocalDevelopmentUser } from "../../../lib/local-dev-user";

type ParsedQuestion = {
  order: number;
  prompt: string;
  questionType: HomeworkQuestionType;
  options?: { choices: string[] };
  imagePath?: string;
  imageCaption?: string;
  imageAltText?: string;
};

function valueAt(values: FormDataEntryValue[], index: number) {
  const value = values[index];
  return typeof value === "string" ? value.trim() : "";
}

function parseDueAt(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const dueAt = new Date(value);

  if (Number.isNaN(dueAt.getTime())) {
    throw new Error("Enter a valid due date or leave it blank.");
  }

  return dueAt;
}

function parseQuestions(formData: FormData): ParsedQuestion[] {
  const prompts = formData.getAll("questionPrompt");
  const types = formData.getAll("questionType");
  const optionSets = formData.getAll("questionOptions");
  const imagePaths = formData.getAll("questionImagePath");
  const imageCaptions = formData.getAll("questionImageCaption");
  const imageAltTexts = formData.getAll("questionImageAltText");

  const questions = prompts
    .map((promptValue, index) => {
      const prompt = typeof promptValue === "string" ? promptValue.trim() : "";
      const requestedType = valueAt(types, index);
      const questionType = Object.values(HomeworkQuestionType).includes(
        requestedType as HomeworkQuestionType,
      )
        ? (requestedType as HomeworkQuestionType)
        : HomeworkQuestionType.OPEN_TEXT;
      const choices = valueAt(optionSets, index)
        .split("\n")
        .map((choice) => choice.trim())
        .filter(Boolean);
      const imagePath = valueAt(imagePaths, index);
      const imageCaption = valueAt(imageCaptions, index);
      const imageAltText = valueAt(imageAltTexts, index);

      return {
        order: index + 1,
        prompt,
        questionType,
        options:
          questionType === HomeworkQuestionType.MULTIPLE_CHOICE
            ? { choices }
            : undefined,
        imagePath: imagePath || undefined,
        imageCaption: imageCaption || undefined,
        imageAltText: imageAltText || undefined,
      };
    })
    .filter((question) => question.prompt.length > 0);

  if (questions.length === 0) {
    throw new Error("Add at least one question prompt.");
  }

  for (const question of questions) {
    if (
      question.questionType === HomeworkQuestionType.MULTIPLE_CHOICE &&
      (!question.options || question.options.choices.length < 2)
    ) {
      throw new Error("Multiple choice questions need at least two options.");
    }
  }

  return questions.map((question, index) => ({
    ...question,
    order: index + 1,
  }));
}

export async function createAssignmentForClass(
  classId: number,
  formData: FormData,
) {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const statusValue = String(formData.get("status") ?? HomeworkAssignmentStatus.DRAFT);
  const status = Object.values(HomeworkAssignmentStatus).includes(
    statusValue as HomeworkAssignmentStatus,
  )
    ? (statusValue as HomeworkAssignmentStatus)
    : HomeworkAssignmentStatus.DRAFT;
  const dueAt = parseDueAt(formData.get("dueAt"));
  const questions = parseQuestions(formData);

  if (!Number.isInteger(classId)) {
    throw new Error("Choose an existing class.");
  }

  if (title.length === 0) {
    throw new Error("Enter an assignment title.");
  }

  const { selectedUser } = await getSelectedLocalDevelopmentUser();

  if (!selectedUser || selectedUser.role !== UserRole.TEACHER) {
    throw new Error("Switch to the seeded teacher user to create assignments.");
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
      title,
      description: description || null,
      status,
      dueAt,
      questions: {
        create: questions,
      },
    },
    select: { id: true },
  });

  redirect(`/classes/${classId}/assignments/${assignment.id}`);
}
