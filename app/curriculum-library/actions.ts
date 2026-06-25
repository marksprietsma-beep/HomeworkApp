"use server";

import { HomeworkQuestionType, Prisma, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { buildAssignmentTemplate, isAssignmentTemplate, parseAssignmentStatus, parseClassIds, parseLibraryDueAt, parseTags } from "../../lib/curriculum-library";
import { getSelectedLocalDevelopmentUser } from "../../lib/local-dev-user";
import { prisma } from "../../lib/prisma";

function requireTeacherOrAdmin(user: { id: number; role: UserRole } | null) {
  if (!user || user.role === UserRole.STUDENT) throw new Error("Switch to an admin or teacher to use the curriculum library.");
  return user;
}

export async function saveAssignmentToLibrary(classId: number, assignmentId: number, formData: FormData) {
  const { selectedUser } = await getSelectedLocalDevelopmentUser();
  const user = requireTeacherOrAdmin(selectedUser);
  const assignment = await prisma.homeworkAssignment.findFirst({
    where: { id: assignmentId, classId, ...(user.role === UserRole.ADMIN ? {} : { class: { teacherId: user.id } }) },
    include: { class: { select: { subject: true } }, questions: { orderBy: { order: "asc" }, select: { order: true, prompt: true, promptI18n: true, questionType: true, points: true, options: true, imagePath: true, imageCaption: true, imageAltText: true } } },
  });
  if (!assignment) throw new Error("Only admins or the teacher who owns this class can save this assignment to the library.");

  const title = String(formData.get("libraryTitle") ?? assignment.title).trim();
  if (!title) throw new Error("Enter a library title.");

  await prisma.curriculumHomeworkLibraryItem.create({
    data: {
      title,
      subject: String(formData.get("subject") ?? assignment.class.subject).trim() || null,
      yearGroup: String(formData.get("yearGroup") ?? "").trim() || null,
      unitTopic: String(formData.get("unitTopic") ?? "").trim() || null,
      tags: parseTags(formData.get("tags")),
      sourceAssignmentId: assignment.id,
      createdById: user.id,
      assignmentJson: JSON.parse(JSON.stringify(buildAssignmentTemplate(assignment))) as Prisma.InputJsonValue,
    },
  });

  revalidatePath("/curriculum-library");
  revalidatePath(`/classes/${classId}/assignments/${assignmentId}`);
  redirect(`/curriculum-library?saved=1`);
}

export async function assignLibraryItemToClass(libraryItemId: number, formData: FormData) {
  const { selectedUser } = await getSelectedLocalDevelopmentUser();
  const user = requireTeacherOrAdmin(selectedUser);
  const classIds = parseClassIds(formData.getAll("classIds"));
  if (classIds.length === 0) throw new Error("Choose at least one target class.");

  const [libraryItem, classes] = await Promise.all([
    prisma.curriculumHomeworkLibraryItem.findUnique({ where: { id: libraryItemId } }),
    prisma.class.findMany({
      where: { id: { in: classIds }, ...(user.role === UserRole.ADMIN ? {} : { teacherId: user.id }) },
      select: { id: true },
    }),
  ]);
  if (!libraryItem || !isAssignmentTemplate(libraryItem.assignmentJson)) throw new Error("Choose an existing library item.");
  if (classes.length !== classIds.length) throw new Error("Only admins or target class teachers can assign library homework to those classes.");

  const template = libraryItem.assignmentJson;
  const title = String(formData.get("title") ?? template.title).trim();
  if (!title) throw new Error("Enter an assignment title.");
  const dueAt = parseLibraryDueAt(formData.get("dueAt"));
  const status = parseAssignmentStatus(formData.get("status"));

  const createdAssignments = await prisma.$transaction(
    classIds.map((classId) => prisma.homeworkAssignment.create({
      data: {
        classId,
        createdById: user.id,
        sourceLibraryItemId: libraryItem.id,
        title,
        titleI18n: template.titleI18n ?? undefined,
        description: template.description,
        descriptionI18n: template.descriptionI18n ?? undefined,
        keyVocabulary: template.keyVocabulary ?? undefined,
        dueAt,
        status,
        questions: { create: template.questions.map((question, index) => ({ order: index + 1, prompt: question.prompt, promptI18n: question.promptI18n ?? undefined, questionType: Object.values(HomeworkQuestionType).includes(question.questionType as HomeworkQuestionType) ? (question.questionType as HomeworkQuestionType) : HomeworkQuestionType.OPEN_TEXT, points: question.points, options: question.options ?? undefined, imagePath: question.imagePath, imageCaption: question.imageCaption, imageAltText: question.imageAltText })) },
      },
      select: { id: true, classId: true },
    })),
  );

  revalidatePath("/");
  revalidatePath("/curriculum-library");
  for (const created of createdAssignments) revalidatePath(`/classes/${created.classId}`);

  if (createdAssignments.length === 1) {
    const assignment = createdAssignments[0];
    redirect(`/classes/${assignment.classId}/assignments/${assignment.id}?fromLibrary=1`);
  }
  redirect(`/curriculum-library?assigned=${createdAssignments.length}`);
}
