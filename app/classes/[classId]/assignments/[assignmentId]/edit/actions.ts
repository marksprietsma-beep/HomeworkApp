"use server";

import { HomeworkAssignmentStatus, HomeworkQuestionResponseMode, HomeworkQuestionType, PseudocodeDialect, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSelectedLocalDevelopmentUser } from "../../../../../../lib/local-dev-user";
import { prisma } from "../../../../../../lib/prisma";

export type EditAssignmentFormState = {
  error: string | null;
};

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

function valueAt(values: FormDataEntryValue[], index: number) {
  const value = values[index];
  return typeof value === "string" ? value.trim() : "";
}

export async function updateAssignmentDetails(
  classId: number,
  assignmentId: number,
  _previousState: EditAssignmentFormState,
  formData: FormData,
): Promise<EditAssignmentFormState> {
  try {
    if (!Number.isInteger(classId) || !Number.isInteger(assignmentId)) {
      throw new Error("Choose an existing assignment.");
    }

    const { selectedUser } = await getSelectedLocalDevelopmentUser();

    if (!selectedUser || selectedUser.role !== UserRole.TEACHER) {
      throw new Error("Switch to the class teacher user to edit this assignment.");
    }

    const assignment = await prisma.homeworkAssignment.findFirst({
      where: {
        id: assignmentId,
        classId,
        class: { teacherId: selectedUser.id },
      },
      select: {
        id: true,
        submissions: { select: { id: true }, take: 1 },
        questions: {
          orderBy: { order: "asc" },
          select: { id: true, questionType: true, responseMode: true },
        },
      },
    });

    if (!assignment) {
      throw new Error("Only the teacher who owns this class can edit this assignment.");
    }

    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const statusValue = String(formData.get("status") ?? HomeworkAssignmentStatus.DRAFT);
    const status = Object.values(HomeworkAssignmentStatus).includes(
      statusValue as HomeworkAssignmentStatus,
    )
      ? (statusValue as HomeworkAssignmentStatus)
      : HomeworkAssignmentStatus.DRAFT;
    const dueAt = parseDueAt(formData.get("dueAt"));

    if (title.length === 0) {
      throw new Error("Enter an assignment title.");
    }

    const existingQuestionsById = new Map(
      assignment.questions.map((question) => [question.id, question]),
    );
    const hasResponses = assignment.submissions.length > 0;
    const questionIds = formData.getAll("questionId");
    const prompts = formData.getAll("questionPrompt");
    const types = formData.getAll("questionType");
    const optionSets = formData.getAll("questionOptions");
    const responseModes = formData.getAll("questionResponseMode");
    const pseudocodeDialects = formData.getAll("questionPseudocodeDialect");
    const pointValues = formData.getAll("questionPoints");
    const imagePaths = formData.getAll("questionImagePath");
    const imageCaptions = formData.getAll("questionImageCaption");
    const imageAltTexts = formData.getAll("questionImageAltText");

    await prisma.$transaction(async (tx) => {
      await tx.homeworkAssignment.update({
        where: { id: assignment.id },
        data: {
          title,
          description: description || null,
          status,
          dueAt,
        },
      });

      for (const [index, rawQuestionId] of questionIds.entries()) {
        const questionId = Number(rawQuestionId);
        const existingQuestion = existingQuestionsById.get(questionId);

        if (!existingQuestion) {
          continue;
        }

        const prompt = valueAt(prompts, index);
        const requestedType = valueAt(types, index);
        const questionType = Object.values(HomeworkQuestionType).includes(
          requestedType as HomeworkQuestionType,
        )
          ? (requestedType as HomeworkQuestionType)
          : existingQuestion.questionType;
        const requestedResponseMode = valueAt(responseModes, index);
        const responseMode = Object.values(HomeworkQuestionResponseMode).includes(
          requestedResponseMode as HomeworkQuestionResponseMode,
        )
          ? (requestedResponseMode as HomeworkQuestionResponseMode)
          : existingQuestion.responseMode;
        const requestedDialect = valueAt(pseudocodeDialects, index);
        const pseudocodeDialect = Object.values(PseudocodeDialect).includes(requestedDialect as PseudocodeDialect)
          ? (requestedDialect as PseudocodeDialect)
          : undefined;
        const rawPoints = valueAt(pointValues, index);
        const points = rawPoints === "" ? null : Number(rawPoints);
        const choices = valueAt(optionSets, index)
          .split("\n")
          .map((choice) => choice.trim())
          .filter(Boolean);
        const imagePath = valueAt(imagePaths, index);
        const imageCaption = valueAt(imageCaptions, index);
        const imageAltText = valueAt(imageAltTexts, index);

        if (prompt.length === 0) {
          throw new Error("Question prompts cannot be blank.");
        }

        if (points !== null && (!Number.isInteger(points) || points < 1)) {
          throw new Error("Question points must be positive whole numbers when provided.");
        }

        if (hasResponses && questionType !== existingQuestion.questionType) {
          throw new Error("Question type changes are disabled once students have responses.");
        }

        if (questionType === HomeworkQuestionType.MULTIPLE_CHOICE && choices.length < 2) {
          throw new Error("Multiple choice questions need at least two options.");
        }

        await tx.homeworkQuestion.update({
          where: { id: questionId },
          data: {
            prompt,
            questionType,
            responseMode: questionType === HomeworkQuestionType.MULTIPLE_CHOICE ? HomeworkQuestionResponseMode.TEXT : responseMode,
            pseudocodeDialect: questionType !== HomeworkQuestionType.MULTIPLE_CHOICE && responseMode === HomeworkQuestionResponseMode.PSEUDOCODE ? pseudocodeDialect ?? PseudocodeDialect.CAMBRIDGE_9618_2026 : null,
            points,
            options:
              questionType === HomeworkQuestionType.MULTIPLE_CHOICE
                ? { choices }
                : undefined,
            imagePath: imagePath || null,
            imageCaption: imageCaption || null,
            imageAltText: imageAltText || null,
          },
        });
      }
    });
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message };
    }

    return { error: "Could not update the assignment. Please try again." };
  }

  revalidatePath("/");
  revalidatePath(`/classes/${classId}`);
  revalidatePath(`/classes/${classId}/assignments/${assignmentId}`);
  revalidatePath(`/classes/${classId}/assignments/${assignmentId}/edit`);
  revalidatePath(`/assignments/${assignmentId}/work`);
  redirect(`/classes/${classId}/assignments/${assignmentId}`);
}
