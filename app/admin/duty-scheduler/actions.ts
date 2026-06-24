"use server";

import { prisma } from "../../../lib/prisma";

export type SavedDutySchedule = {
  id: number;
  name: string;
  isActive: boolean;
  sourceTimetableImportId: number | null;
  sourceTimetableName: string | null;
  scheduleJson: unknown;
  createdAt: string;
  updatedAt: string;
};

function toSavedDutySchedule(row: { id: number; name: string; isActive: boolean; sourceTimetableImportId: number | null; sourceTimetableName: string | null; scheduleJson: unknown; createdAt: Date; updatedAt: Date }): SavedDutySchedule {
  return { id: row.id, name: row.name, isActive: row.isActive, sourceTimetableImportId: row.sourceTimetableImportId, sourceTimetableName: row.sourceTimetableName, scheduleJson: row.scheduleJson, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

export async function getDutySchedules() {
  const schedules = await prisma.dutySchedule.findMany({ orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }] });
  return { ok: true as const, schedules: schedules.map(toSavedDutySchedule) };
}

export async function saveDutySchedule(input: { id?: number; name: string; isActive: boolean; sourceTimetableImportId?: number | null; sourceTimetableName?: string | null; scheduleJson: unknown }) {
  const name = input.name.trim();
  if (!name) return { ok: false as const, error: "Enter a duty schedule name before saving." };

  try {
    const saved = await prisma.$transaction(async tx => {
      if (input.isActive) await tx.dutySchedule.updateMany({ where: { isActive: true, ...(input.id ? { id: { not: input.id } } : {}) }, data: { isActive: false } });
      const data = { name, isActive: input.isActive, sourceTimetableImportId: input.sourceTimetableImportId ?? null, sourceTimetableName: input.sourceTimetableName ?? null, scheduleJson: input.scheduleJson ?? {} };
      return input.id ? tx.dutySchedule.update({ where: { id: input.id }, data }) : tx.dutySchedule.create({ data });
    });
    return { ok: true as const, schedule: toSavedDutySchedule(saved) };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "The duty schedule could not be saved." };
  }
}
