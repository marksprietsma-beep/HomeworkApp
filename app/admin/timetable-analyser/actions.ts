"use server";

import { analyseTimetableWorkbook } from "../../../lib/timetable-analyser";

export async function analyseTimetableUpload(formData: FormData) {
  const file = formData.get("timetable");
  if (!(file instanceof File)) return { ok: false as const, error: "Upload a .xlsx timetable workbook before analysing." };
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const analysis = await analyseTimetableWorkbook(buffer, file.name);
    return { ok: true as const, analysis };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "The timetable workbook could not be analysed." };
  }
}
