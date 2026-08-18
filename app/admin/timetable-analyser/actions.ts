"use server";

import { prisma } from "../../../lib/prisma";
import { analyseTimetableWorkbook, type TimetableAnalysis } from "../../../lib/timetable-analyser";

type SavedTimetableImport = { id: number; name: string; sourceFilename: string; isActive: boolean; createdAt: string; updatedAt: string; analysis: TimetableAnalysis };

function withLeadershipDefaults(analysis: TimetableAnalysis): TimetableAnalysis {
  return { ...analysis, staff: analysis.staff.map(staff => ({ ...staff, isLeadership: staff.isLeadership ?? false })) };
}

function retainManualStaff(analysis: TimetableAnalysis, savedAnalysis?: TimetableAnalysis): TimetableAnalysis {
  const codes = new Set(analysis.staff.map(staff => staff.staffCode.trim().toLowerCase()));
  const manual = (savedAnalysis?.staff ?? []).filter(staff => staff.isManual && !codes.has(staff.staffCode.trim().toLowerCase()));
  const staff = [...analysis.staff, ...manual].sort((a, b) => a.staffName.localeCompare(b.staffName));
  return { ...analysis, staff, totals: { ...analysis.totals, staffDetected: staff.length } };
}

function toSavedTimetableImport(row: { id: number; name: string; sourceFilename: string; isActive: boolean; rawAnalysisJson: unknown; createdAt: Date; updatedAt: Date }): SavedTimetableImport {
  return { id: row.id, name: row.name, sourceFilename: row.sourceFilename, isActive: row.isActive, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), analysis: withLeadershipDefaults(row.rawAnalysisJson as TimetableAnalysis) };
}

export async function analyseTimetableUpload(formData: FormData) {
  const file = formData.get("timetable");
  if (!(file instanceof File) || file.size === 0) return { ok: false as const, error: "Please choose a workbook first before clicking Parse/analyse." };
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const analysis = withLeadershipDefaults(await analyseTimetableWorkbook(buffer, file.name));
    if (!analysis.staff.length || !analysis.parsedLessons.some(lesson => lesson.isTeachingLesson)) return { ok: false as const, error: "Workbook opened, but no timetable data was detected. Check whether the timetable sheet names or workbook layout match the supported format." };
    return { ok: true as const, analysis, sourceFilename: file.name };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "The timetable workbook could not be analysed." };
  }
}

export async function getActiveTimetableImport() {
  const row = await prisma.timetableImport.findFirst({ where: { isActive: true }, orderBy: { updatedAt: "desc" } });
  return row ? { ok: true as const, timetable: toSavedTimetableImport(row) } : { ok: true as const, timetable: null };
}

export async function saveTimetableImport(input: { id?: number; name: string; sourceFilename: string; isActive: boolean; analysis: TimetableAnalysis }) {
  const name = input.name.trim();
  if (!name) return { ok: false as const, error: "Enter a timetable name before saving." };
  if (!input.analysis.staff.length) return { ok: false as const, error: "There is no parsed staff data to save." };

  try {
    const saved = await prisma.$transaction(async tx => {
      const previous = input.id
        ? await tx.timetableImport.findUnique({ where: { id: input.id } })
        : await tx.timetableImport.findFirst({ where: { isActive: true }, orderBy: { updatedAt: "desc" } });
      const analysis = retainManualStaff(withLeadershipDefaults(input.analysis), previous?.rawAnalysisJson as TimetableAnalysis | undefined);
      if (input.isActive) await tx.timetableImport.updateMany({ where: { isActive: true, ...(input.id ? { id: { not: input.id } } : {}) }, data: { isActive: false } });
      const data = { name, sourceFilename: input.sourceFilename || "Unknown workbook", isActive: input.isActive, rawAnalysisJson: analysis };
      return input.id
        ? tx.timetableImport.update({ where: { id: input.id }, data })
        : tx.timetableImport.create({ data });
    });
    return { ok: true as const, timetable: toSavedTimetableImport(saved) };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "The timetable could not be saved." };
  }
}
