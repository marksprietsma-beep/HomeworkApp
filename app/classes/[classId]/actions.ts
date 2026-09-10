"use server";

import { AccountStatus, HomeworkAssignmentStatus, HomeworkQuestionResponseMode, HomeworkQuestionType, PseudocodeDialect, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "../../../lib/prisma";
import { hashPassword } from "../../../lib/passwords";
import { parseStudentCsv } from "../../../lib/student-csv-import";
import { generateTemporaryPassword } from "../../../lib/temporary-password";
import { getCurrentUserState } from "../../../lib/auth";
import { LocalMediaValidationError, storeAssignmentQuestionImage } from "../../../lib/local-media";
import { assertManualCreateResponseMode } from "../../../lib/question-response-mode";
import { canActAsClassTeacher, canManageClassRoster } from "../../../lib/permissions";
import { transitionAssignmentStatus } from "../../../lib/email-notifications";
import { isAdmin } from "../../../lib/permissions";
import { parsePublicationIntent, PublicationIntent } from "../../../lib/publication-intent.mjs";

export type CreateAssignmentFormState = {
  error: string | null;
};

export async function updateLeaderboardSetting(classId: number, formData: FormData) {
  await requireManagedClass(classId);
  await prisma.class.update({ where: { id: classId }, data: { leaderboardEnabled: formData.get("leaderboardEnabled") === "on" } });
  revalidatePath(`/classes/${classId}`);
  revalidatePath(`/classes/${classId}/leaderboard`);
}

type ParsedQuestion = {
  order: number;
  prompt: string;
  questionType: HomeworkQuestionType;
  responseMode: HomeworkQuestionResponseMode;
  pseudocodeDialect?: PseudocodeDialect;
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
  const responseModes = formData.getAll("questionResponseMode");
  const pseudocodeDialects = formData.getAll("questionPseudocodeDialect");
  const pointValues = formData.getAll("questionPoints");
  const imagePaths = formData.getAll("questionImagePath");
  const imageCaptions = formData.getAll("questionImageCaption");
  const imageAltTexts = formData.getAll("questionImageAltText");
  const imageFiles = formData.getAll("questionImageFile");

  const parsedQuestions = await Promise.all(
    prompts.map(async (promptValue, index) => {
      const prompt = typeof promptValue === "string" ? promptValue.trim() : "";
      const requestedType = valueAt(types, index);
      const questionType = Object.values(HomeworkQuestionType).includes(
        requestedType as HomeworkQuestionType,
      )
        ? (requestedType as HomeworkQuestionType)
        : HomeworkQuestionType.OPEN_TEXT;
      const requestedResponseMode = valueAt(responseModes, index);
      const responseMode = Object.values(HomeworkQuestionResponseMode).includes(
        requestedResponseMode as HomeworkQuestionResponseMode,
      )
        ? (requestedResponseMode as HomeworkQuestionResponseMode)
        : HomeworkQuestionResponseMode.TEXT;
      assertManualCreateResponseMode(responseMode);
      const requestedDialect = valueAt(pseudocodeDialects, index);
      const pseudocodeDialect = Object.values(PseudocodeDialect).includes(requestedDialect as PseudocodeDialect)
        ? (requestedDialect as PseudocodeDialect)
        : undefined;
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
        responseMode: questionType === HomeworkQuestionType.MULTIPLE_CHOICE ? HomeworkQuestionResponseMode.TEXT : responseMode,
        pseudocodeDialect: questionType !== HomeworkQuestionType.MULTIPLE_CHOICE && responseMode === HomeworkQuestionResponseMode.PSEUDOCODE ? pseudocodeDialect ?? PseudocodeDialect.CAMBRIDGE_9618_2026 : undefined,
        options:
          questionType === HomeworkQuestionType.MULTIPLE_CHOICE
            ? { choices }
            : undefined,
        points,
        imagePath: storedImage?.path || imagePath || undefined,
        imageCaption: storedImage?.caption || imageCaption || undefined,
        imageAltText: storedImage?.altText || imageAltText || undefined,
      };
    }),
  );
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
  _previousState: CreateAssignmentFormState,
  formData: FormData,
): Promise<CreateAssignmentFormState> {
  let assignmentId: number;

  try {
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const intent = parsePublicationIntent(formData.get("intent"));
    if (!intent) throw new Error("Choose Save as Draft or Publish Assignment.");
    const dueAt = parseDueAt(formData.get("dueAt"));
    const questions = await parseQuestions(formData);

    if (!Number.isInteger(classId)) {
      throw new Error("Choose an existing class.");
    }

    if (title.length === 0) {
      throw new Error("Enter an assignment title.");
    }

    const { selectedUser } = await getCurrentUserState();

    if (!canActAsClassTeacher(selectedUser)) {
      throw new Error("You must be signed in as the class teacher or an ADMIN account to create assignments.");
    }

    const classItem = await prisma.class.findFirst({
      where: {
        id: classId,
        ...(isAdmin(selectedUser) ? {} : { teacherId: selectedUser.id }),
      },
      select: { id: true },
    });

    if (!classItem) {
      throw new Error("The selected teacher does not teach this class.");
    }

    const assignment = await prisma.$transaction(async (tx) => {
      const created = await tx.homeworkAssignment.create({
      data: {
        classId,
        createdById: selectedUser.id,
        title,
        description: description || null,
        status: HomeworkAssignmentStatus.DRAFT,
        dueAt,
        questions: {
          create: questions,
        },
      },
        select: { id: true },
      });
      if (intent === PublicationIntent.PUBLISH) {
        await transitionAssignmentStatus(tx, created.id, HomeworkAssignmentStatus.PUBLISHED);
      }
      return created;
    });

    assignmentId = assignment.id;
  } catch (error) {
    if (error instanceof LocalMediaValidationError || error instanceof Error) {
      return { error: error.message };
    }

    return { error: "Could not create the assignment. Please try again." };
  }

  redirect(`/classes/${classId}/assignments/${assignmentId}`);
}

async function requireManagedClass(classId: number) {
  if (!Number.isInteger(classId)) {
    throw new Error("Choose an existing class.");
  }

  const { selectedUser } = await getCurrentUserState();

  const classItem = await prisma.class.findUnique({
    where: { id: classId },
    select: { id: true, teacherId: true },
  });

  if (!classItem) {
    throw new Error("Choose an existing class to manage.");
  }

  if (!canManageClassRoster(selectedUser, classItem.teacherId)) {
    throw new Error("You do not have permission to manage this class roster.");
  }

  return classItem;
}

export async function addStudentToClassRoster(classId: number, formData: FormData) {
  const studentId = Number(formData.get("studentId"));

  await requireManagedClass(classId);

  if (!Number.isInteger(studentId)) {
    throw new Error("Choose an existing student to add.");
  }

  const student = await prisma.user.findFirst({
    where: {
      id: studentId,
      role: UserRole.STUDENT,
      accountStatus: AccountStatus.ACTIVE,
    },
    select: { id: true },
  });

  if (!student) {
    throw new Error("Only active STUDENT users can be added to a class roster; teacher, admin, and disabled accounts are not eligible.");
  }

  const existingEnrollment = await prisma.classEnrollment.findUnique({
    where: {
      classId_studentId: {
        classId,
        studentId,
      },
    },
    select: { id: true },
  });

  if (existingEnrollment) {
    throw new Error("That student is already enrolled in this class.");
  }

  await prisma.classEnrollment.create({
    data: {
      classId,
      studentId,
    },
  });

  revalidateClassDetail(classId);
}

export async function removeStudentFromClassRoster(classId: number, formData: FormData) {
  const studentId = Number(formData.get("studentId"));

  await requireManagedClass(classId);

  if (!Number.isInteger(studentId)) {
    throw new Error("Choose an enrolled student to remove.");
  }

  await prisma.classEnrollment.deleteMany({
    where: {
      classId,
      studentId,
    },
  });

  revalidateClassDetail(classId);
}

function revalidateClassDetail(classId: number) {
  revalidatePath("/");
  revalidatePath(`/classes/${classId}`);
  revalidatePath("/admin/classes");
}

export type StudentCsvImportRowStatus = "CREATE" | "ENROLL_EXISTING" | "ALREADY_ENROLLED" | "INVALID" | "CONFLICT";

export type StudentCsvImportPreviewRow = {
  rowNumber: number;
  displayName: string;
  email: string;
  status: StudentCsvImportRowStatus;
  messages: string[];
};

export type StudentCsvImportState = {
  error: string | null;
  success: string | null;
  csvText?: string;
  rows: StudentCsvImportPreviewRow[];
  summary: null | {
    createdUsers: number;
    existingStudentsEnrolled: number;
    alreadyEnrolled: number;
    invalidRows: number;
    conflicts: number;
  };
  credentials?: { name: string; email: string; temporaryPassword: string }[];
};

async function buildStudentCsvPreview(classId: number, csvText: string): Promise<StudentCsvImportPreviewRow[]> {
  await requireManagedClass(classId);
  const parsedRows = parseStudentCsv(csvText);
  const seen = new Map<string, number>();
  for (const row of parsedRows) {
    if (!row.email) continue;
    const firstSeen = seen.get(row.email);
    if (firstSeen) row.messages.push(`Duplicate email/login in CSV; first seen on row ${firstSeen}.`);
    else seen.set(row.email, row.rowNumber);
  }

  const users = await prisma.user.findMany({
    where: { email: { in: [...seen.keys()] } },
    include: { classEnrollments: { where: { classId }, select: { id: true } } },
  });
  const usersByEmail = new Map(users.map((user) => [user.email, user]));

  return parsedRows.map((row) => {
    const user = usersByEmail.get(row.email);
    const messages = [...row.messages];
    let status: StudentCsvImportRowStatus = "CREATE";

    if (messages.length > 0) status = "INVALID";
    else if (user && user.role !== UserRole.STUDENT) {
      status = "CONFLICT";
      messages.push(`Existing account is ${user.role}, not STUDENT.`);
    } else if (user && user.accountStatus !== AccountStatus.ACTIVE) {
      status = "CONFLICT";
      messages.push(`Existing STUDENT account is ${user.accountStatus}, not ACTIVE.`);
    } else if (user?.classEnrollments.length) {
      status = "ALREADY_ENROLLED";
      messages.push("Student is already enrolled in this class; row will be skipped.");
    } else if (user) {
      status = "ENROLL_EXISTING";
      messages.push("Existing active STUDENT will be enrolled.");
    } else {
      messages.push("New STUDENT account will be created and enrolled.");
    }

    return { ...row, status, messages };
  });
}

export async function previewStudentCsvImport(classId: number, _previousState: StudentCsvImportState, formData: FormData): Promise<StudentCsvImportState> {
  const csvText = String(formData.get("csvText") ?? "").trim();
  try {
    if (!csvText) throw new Error("Paste CSV text before previewing.");
    const rows = await buildStudentCsvPreview(classId, csvText);
    return { error: null, success: `Previewed ${rows.length} CSV row${rows.length === 1 ? "" : "s"}.`, csvText, rows, summary: null };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not preview CSV.", success: null, csvText, rows: [], summary: null };
  }
}

export async function importStudentsToClassFromCsv(classId: number, _previousState: StudentCsvImportState, formData: FormData): Promise<StudentCsvImportState> {
  const csvText = String(formData.get("csvText") ?? "").trim();
  try {
    const rows = await buildStudentCsvPreview(classId, csvText);
    const summary = { createdUsers: 0, existingStudentsEnrolled: 0, alreadyEnrolled: 0, invalidRows: rows.filter((row) => row.status === "INVALID").length, conflicts: rows.filter((row) => row.status === "CONFLICT").length };
    const blockingRows = rows.filter((row) => row.status === "INVALID" || row.status === "CONFLICT");
    if (blockingRows.length > 0) {
      throw new Error(`CSV import blocked: fix ${blockingRows.length} row${blockingRows.length === 1 ? "" : "s"} with validation errors or conflicts before saving.`);
    }

    const credentials: NonNullable<StudentCsvImportState["credentials"]> = [];
    await prisma.$transaction(async (tx) => {
      for (const row of rows) {
        if (row.status === "ALREADY_ENROLLED") { summary.alreadyEnrolled += 1; continue; }
        if (row.status === "ENROLL_EXISTING") {
          const user = await tx.user.findUnique({ where: { email: row.email }, select: { id: true, role: true, accountStatus: true } });
          if (!user || user.role !== UserRole.STUDENT || user.accountStatus !== AccountStatus.ACTIVE) throw new Error(`Student account ${row.email} changed during import; nothing was saved.`);
          await tx.classEnrollment.upsert({ where: { classId_studentId: { classId, studentId: user.id } }, create: { classId, studentId: user.id }, update: {} });
          summary.existingStudentsEnrolled += 1;
        }
        if (row.status === "CREATE") {
          const temporaryPassword = generateTemporaryPassword();
          const user = await tx.user.create({ data: { displayName: row.displayName, email: row.email, yearGroup: null, role: UserRole.STUDENT, accountStatus: AccountStatus.ACTIVE, passwordHash: await hashPassword(temporaryPassword), mustChangePassword: true, isDevelopmentUser: false }, select: { id: true } });
          await tx.classEnrollment.create({ data: { classId, studentId: user.id } });
          credentials.push({ name: row.displayName, email: row.email, temporaryPassword });
          summary.createdUsers += 1;
        }
      }
    });

    revalidateClassDetail(classId);
    return { error: null, success: "CSV import saved. Download the credentials now; they cannot be shown again.", csvText, rows, summary, credentials };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not import CSV.", success: null, csvText, rows: [], summary: null };
  }
}
