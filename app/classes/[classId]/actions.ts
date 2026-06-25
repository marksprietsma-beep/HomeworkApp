"use server";

import { AccountStatus, HomeworkAssignmentStatus, HomeworkQuestionResponseMode, HomeworkQuestionType, UserRole } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "../../../lib/prisma";
import { hashPassword } from "../../../lib/passwords";
import { getSelectedLocalDevelopmentUser } from "../../../lib/local-dev-user";
import { LocalMediaValidationError, storeAssignmentQuestionImage } from "../../../lib/local-media";
import { canManageClasses } from "../../../lib/permissions";

export type CreateAssignmentFormState = {
  error: string | null;
};

type ParsedQuestion = {
  order: number;
  prompt: string;
  questionType: HomeworkQuestionType;
  responseMode: HomeworkQuestionResponseMode;
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

  const { selectedUser } = await getSelectedLocalDevelopmentUser();

  if (!canManageClasses(selectedUser)) {
    throw new Error("Roster enrolment management is only available to ADMIN users.");
  }

  const classItem = await prisma.class.findUnique({
    where: { id: classId },
    select: { id: true },
  });

  if (!classItem) {
    throw new Error("Choose an existing class to manage.");
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

const SUPPORTED_YEAR_GROUPS = ["Y7", "Y8", "Y9", "Y10", "Y11", "Y12", "Y13"] as const;
type SupportedYearGroup = (typeof SUPPORTED_YEAR_GROUPS)[number];

export type StudentCsvImportRowStatus = "CREATE" | "ENROLL_EXISTING" | "ALREADY_ENROLLED" | "INVALID" | "CONFLICT";

export type StudentCsvImportPreviewRow = {
  rowNumber: number;
  displayName: string;
  email: string;
  yearGroup: string;
  externalId: string;
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
};

type ParsedCsvRow = {
  rowNumber: number;
  displayName: string;
  email: string;
  yearGroup: string;
  externalId: string;
  messages: string[];
};

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += char;
    }
  }

  if (inQuotes) {
    throw new Error("CSV contains an unclosed quoted value.");
  }

  cells.push(cell.trim());
  return cells;
}

function headerIndex(headers: string[], names: string[]) {
  return headers.findIndex((header) => names.includes(header));
}

function readCell(cells: string[], index: number) {
  return index >= 0 ? (cells[index] ?? "").trim() : "";
}

function parseStudentCsv(csvText: string): ParsedCsvRow[] {
  const lines = csvText.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) throw new Error("Paste a CSV header row and at least one student row.");

  const headers = parseCsvLine(lines[0]).map((header) => header.trim().toLowerCase());
  const displayNameIndex = headerIndex(headers, ["displayname", "name", "studentname"]);
  const firstNameIndex = headerIndex(headers, ["firstname", "first_name", "forename"]);
  const lastNameIndex = headerIndex(headers, ["lastname", "last_name", "surname"]);
  const emailIndex = headerIndex(headers, ["email", "username", "login", "loginidentifier"]);
  const yearGroupIndex = headerIndex(headers, ["yeargroup", "year_group", "year", "yearname"]);
  const externalIdIndex = headerIndex(headers, ["studentid", "student_id", "externalid", "external_id"]);

  if (displayNameIndex === -1 && (firstNameIndex === -1 || lastNameIndex === -1)) {
    throw new Error("CSV must include displayName, or both firstName and lastName columns.");
  }
  if (emailIndex === -1) {
    throw new Error("CSV must include email, username, or login column.");
  }

  return lines.slice(1).map((line, index) => {
    const cells = parseCsvLine(line);
    const displayName = readCell(cells, displayNameIndex) || [readCell(cells, firstNameIndex), readCell(cells, lastNameIndex)].filter(Boolean).join(" ");
    const email = readCell(cells, emailIndex).toLowerCase();
    const yearGroup = readCell(cells, yearGroupIndex).toUpperCase();
    const externalId = readCell(cells, externalIdIndex);
    const messages: string[] = [];

    if (!displayName) messages.push("Missing display name.");
    if (!email) messages.push("Missing email/login identifier.");
    if (email && !email.includes("@")) messages.push("Email/login identifier must be email-style for now.");
    if (!yearGroup) messages.push("Missing yearGroup.");
    else if (!SUPPORTED_YEAR_GROUPS.includes(yearGroup as SupportedYearGroup)) messages.push(`Invalid yearGroup ${yearGroup}; use Y7, Y8, Y9, Y10, Y11, Y12, or Y13.`);

    return { rowNumber: index + 2, displayName, email, yearGroup, externalId, messages };
  });
}

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

    await prisma.$transaction(async (tx) => {
      for (const row of rows) {
        if (row.status === "ALREADY_ENROLLED") { summary.alreadyEnrolled += 1; continue; }
        if (row.status === "ENROLL_EXISTING") {
          const user = await tx.user.findUnique({ where: { email: row.email }, select: { id: true } });
          if (!user) throw new Error(`Existing student ${row.email} could not be found during import.`);
          await tx.user.update({ where: { id: user.id }, data: { yearGroup: row.yearGroup } });
          await tx.classEnrollment.create({ data: { classId, studentId: user.id } });
          summary.existingStudentsEnrolled += 1;
        }
        if (row.status === "CREATE") {
          const user = await tx.user.create({ data: { displayName: row.displayName, email: row.email, yearGroup: row.yearGroup, role: UserRole.STUDENT, accountStatus: AccountStatus.ACTIVE, passwordHash: hashPassword(randomBytes(24).toString("base64url")), isDevelopmentUser: false }, select: { id: true } });
          await tx.classEnrollment.create({ data: { classId, studentId: user.id } });
          summary.createdUsers += 1;
        }
      }
    });

    revalidateClassDetail(classId);
    return { error: null, success: "CSV import saved.", csvText, rows: await buildStudentCsvPreview(classId, csvText), summary };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not import CSV.", success: null, csvText, rows: [], summary: null };
  }
}
