"use server";

import { HomeworkAssignmentStatus, HomeworkQuestionType, UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "../../../lib/prisma";
import { getSelectedLocalDevelopmentUser } from "../../../lib/local-dev-user";
import { storeAssignmentQuestionImage } from "../../../lib/local-media";

type ParsedQuestion = {
  order: number;
  prompt: string;
  questionType: HomeworkQuestionType;
  options?: { choices: string[] };
  points?: number;
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

function isUploadedFile(value: FormDataEntryValue | undefined): value is File {
  return typeof value === "object" && value !== null && "arrayBuffer" in value && value.size > 0;
}

async function parseQuestions(formData: FormData): Promise<ParsedQuestion[]> {
  const prompts = formData.getAll("questionPrompt");
  const types = formData.getAll("questionType");
  const optionSets = formData.getAll("questionOptions");
  const pointValues = formData.getAll("questionPoints");
  const imagePaths = formData.getAll("questionImagePath");
  const imageCaptions = formData.getAll("questionImageCaption");
  const imageAltTexts = formData.getAll("questionImageAltText");
  const imageFiles = formData.getAll("questionImageFile");

  const parsedQuestions = await Promise.all(prompts.map(async (promptValue, index) => {
      const prompt = typeof promptValue === "string" ? promptValue.trim() : "";
      const requestedType = valueAt(types, index);
      const questionType = Object.values(HomeworkQuestionType).includes(
        requestedType as HomeworkQuestionType,
      )
        ? (requestedType as HomeworkQuestionType)
        : HomeworkQuestionType.OPEN_TEXT;
      const rawPoints = valueAt(pointValues, index);
      const points = rawPoints === "" ? undefined : Number(rawPoints);
      const choices = valueAt(optionSets, index)
        .split("\n")
        .map((choice) => choice.trim())
        .filter(Boolean);
      const imagePath = valueAt(imagePaths, index);
      const imageCaption = valueAt(imageCaptions, index);
      const imageAltText = valueAt(imageAltTexts, index);
      const imageFile = imageFiles[index];
      const storedImage = isUploadedFile(imageFile)
        ? await storeAssignmentQuestionImage(imageFile, { caption: imageCaption, altText: imageAltText })
        : null;

      return {
        order: index + 1,
        prompt,
        questionType,
        options:
          questionType === HomeworkQuestionType.MULTIPLE_CHOICE
            ? { choices }
            : undefined,
        points,
        imagePath: storedImage?.path || imagePath || undefined,
        imageCaption: storedImage?.caption || imageCaption || undefined,
        imageAltText: storedImage?.altText || imageAltText || undefined,
      };
    }));
  const questions = parsedQuestions.filter((question) => question.prompt.length > 0);

  if (questions.length === 0) {
    throw new Error("Add at least one question prompt.");
  }

  for (const question of questions) {
    if (question.points !== undefined && (!Number.isInteger(question.points) || question.points < 1)) {
      throw new Error("Question points must be positive whole numbers when provided.");
    }

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
  const questions = await parseQuestions(formData);

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
