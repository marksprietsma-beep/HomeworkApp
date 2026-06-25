"use server";

import { HomeworkAssignmentStatus, HomeworkQuestionResponseMode, HomeworkQuestionType, UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { parseAssignmentImportJson } from "../../../../../lib/assignment-import-parser.mjs";
import { getSelectedLocalDevelopmentUser } from "../../../../../lib/local-dev-user";
import { prisma } from "../../../../../lib/prisma";
import { storeAssignmentQuestionImage } from "../../../../../lib/local-media";

type I18nText = { en: string; zh: string } | null;

type AssignmentImportGlossaryItem = {
  englishTerm: string;
  chineseTerm: string;
  englishDefinition: string;
  chineseDefinition: string;
  termI18n?: I18nText;
  definitionI18n?: I18nText;
  category: string | null;
  questionIds: string[];
};

type AssignmentImportQuestion = {
  order: number;
  type: "OPEN_TEXT" | "MULTIPLE_CHOICE";
  responseMode?: "TEXT" | "PSEUDOCODE";
  prompt: string;
  textI18n?: I18nText;
  points: number | null;
  options: { id: string; text: string; textI18n?: I18nText }[];
  image: { path: string; caption: string; altText: string } | null;
};

type AssignmentImportAssignment = {
  title: string;
  titleI18n?: I18nText;
  instructions: string;
  instructionsI18n?: I18nText;
  dueDate: string | null;
  status: "DRAFT" | "PUBLISHED";
  questions: AssignmentImportQuestion[];
  keyVocabulary: AssignmentImportGlossaryItem[];
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

export type ImportAssignmentActionState = {
  ok: false;
  message: string;
} | null;

function validationMessage(errors: { path: string; message: string }[]) {
  return `Fix the assignment JSON before saving: ${errors
    .map((error) => `${error.path} ${error.message}`)
    .join("; ")}`;
}

export async function importAssignmentForClass(
  classId: number,
  _previousState: ImportAssignmentActionState,
  formData: FormData,
): Promise<ImportAssignmentActionState> {
  if (!Number.isInteger(classId)) {
    return { ok: false, message: "Choose an existing class before importing assignments." };
  }

  const rawJson = String(formData.get("rawJson") ?? "");
  const parseResult = parseAssignmentImportJson(rawJson);

  if (!parseResult.ok) {
    return { ok: false, message: validationMessage(parseResult.errors) };
  }

  const importedAssignment = parseResult.assignment as AssignmentImportAssignment | null;

  if (!importedAssignment) {
    return { ok: false, message: "Fix the assignment JSON before saving." };
  }

  const { selectedUser } = await getSelectedLocalDevelopmentUser();

  if (!selectedUser) {
    return { ok: false, message: "Select an admin or assigned teacher before importing assignments." };
  }

  if (selectedUser.role === UserRole.STUDENT) {
    return { ok: false, message: "Students cannot import assignments. Switch to an admin or assigned teacher." };
  }

  const classItem = await prisma.class.findFirst({
    where: {
      id: classId,
      ...(selectedUser.role === UserRole.ADMIN ? {} : { teacherId: selectedUser.id }),
    },
    select: { id: true },
  });

  if (!classItem) {
    return { ok: false, message: "Only admins or the teacher assigned to this class can import assignments." };
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
      promptI18n: question.textI18n ?? undefined,
      questionType: question.type as HomeworkQuestionType,
      responseMode: question.type === "OPEN_TEXT" && question.responseMode === "PSEUDOCODE" ? HomeworkQuestionResponseMode.PSEUDOCODE : HomeworkQuestionResponseMode.TEXT,
      points: question.points,
      options:
        question.type === "MULTIPLE_CHOICE"
          ? {
              choices: question.options.map((option) => option.text),
              choicesI18n: question.options.map((option) => option.textI18n ?? null),
            }
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
      titleI18n: importedAssignment.titleI18n ?? undefined,
      description: importedAssignment.instructions,
      descriptionI18n: importedAssignment.instructionsI18n ?? undefined,
      keyVocabulary: importedAssignment.keyVocabulary.length > 0 ? importedAssignment.keyVocabulary : undefined,
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
