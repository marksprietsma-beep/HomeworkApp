import { HomeworkAssignmentStatus, UserRole } from "@prisma/client";
import { prisma } from "./prisma";

export type CurriculumLibraryFilters = {
  search: string;
  subject: string;
  yearGroup: string;
  tag: string;
};

export function parseCurriculumLibraryFilters(searchParams?: Record<string, string | string[] | undefined>): CurriculumLibraryFilters {
  const value = (key: string) => {
    const raw = searchParams?.[key];
    return (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  };
  return { search: value("search"), subject: value("subject"), yearGroup: value("yearGroup"), tag: value("tag") };
}

export function parseTags(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(new RegExp("[,\\n]"))
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 12);
}

export async function getCurriculumLibraryData(filters: CurriculumLibraryFilters) {
  const items = await prisma.curriculumHomeworkLibraryItem.findMany({
    where: {
      AND: [
        filters.search ? { title: { contains: filters.search, mode: "insensitive" } } : {},
        filters.subject ? { subject: { contains: filters.subject, mode: "insensitive" } } : {},
        filters.yearGroup ? { yearGroup: { contains: filters.yearGroup, mode: "insensitive" } } : {},
        filters.tag ? { tags: { has: filters.tag } } : {},
      ],
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    include: { createdBy: { select: { displayName: true } } },
  });

  const facets = await prisma.curriculumHomeworkLibraryItem.findMany({
    select: { subject: true, yearGroup: true, tags: true },
    orderBy: { updatedAt: "desc" },
  });

  return {
    items,
    subjects: [...new Set(facets.map((item) => item.subject).filter((value): value is string => Boolean(value)))].sort(),
    yearGroups: [...new Set(facets.map((item) => item.yearGroup).filter((value): value is string => Boolean(value)))].sort(),
    tags: [...new Set(facets.flatMap((item) => item.tags))].sort(),
  };
}

export async function getAssignableClassesForUser(user: { id: number; role: UserRole } | null) {
  if (!user || user.role === UserRole.STUDENT) return [];
  return prisma.class.findMany({
    where: user.role === UserRole.ADMIN ? {} : { teacherId: user.id },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    select: { id: true, name: true, subject: true, teacher: { select: { displayName: true } } },
  });
}

export function buildAssignmentTemplate(assignment: {
  title: string; titleI18n: unknown; description: string | null; descriptionI18n: unknown; keyVocabulary: unknown; dueAt: Date | null; questions: Array<{ order: number; prompt: string; promptI18n: unknown; questionType: string; points: number | null; options: unknown; imagePath: string | null; imageCaption: string | null; imageAltText: string | null }>;
}) {
  return {
    title: assignment.title,
    titleI18n: assignment.titleI18n,
    description: assignment.description,
    descriptionI18n: assignment.descriptionI18n,
    keyVocabulary: assignment.keyVocabulary,
    suggestedDueAt: assignment.dueAt?.toISOString() ?? null,
    questions: assignment.questions.map((question) => ({ ...question })),
  };
}

export type AssignmentTemplate = ReturnType<typeof buildAssignmentTemplate>;

export function isAssignmentTemplate(value: unknown): value is AssignmentTemplate {
  return typeof value === "object" && value !== null && "title" in value && "questions" in value && Array.isArray((value as { questions?: unknown }).questions);
}

export function parseLibraryDueAt(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const dueAt = new Date(value);
  if (Number.isNaN(dueAt.getTime())) throw new Error("Enter a valid due date or leave it blank.");
  return dueAt;
}

export function parseAssignmentStatus(value: FormDataEntryValue | null) {
  return value === HomeworkAssignmentStatus.PUBLISHED ? HomeworkAssignmentStatus.PUBLISHED : HomeworkAssignmentStatus.DRAFT;
}
