import Link from "next/link";
import { getSelectedLocalDevelopmentUser } from "../../../lib/local-dev-user";
import { isAdmin } from "../../../lib/permissions";
import { TimetableAnalyserForm } from "./timetable-analyser-form";

export const dynamic = "force-dynamic";

export default async function AdminTimetableAnalyserPage() {
  const { selectedUser } = await getSelectedLocalDevelopmentUser();
  const canAnalyse = isAdmin(selectedUser);

  if (!canAnalyse) {
    return <main className="mx-auto min-h-screen max-w-4xl px-6 py-16"><Link href="/" className="text-sm font-semibold text-amber-700 hover:text-amber-800">← Back to dashboard</Link><section className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-8 text-left shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">Admin only</p><h1 className="mt-3 text-3xl font-bold text-slate-950">Timetable analyser is unavailable</h1><p className="mt-3 text-sm leading-6 text-slate-700">Switch the temporary local development user to an ADMIN account to upload and analyse timetable workbooks. Current user: {selectedUser ? `${selectedUser.displayName} (${selectedUser.role})` : "none selected"}.</p></section></main>;
  }

  return <main className="mx-auto min-h-screen max-w-7xl px-6 py-12"><Link href="/" className="text-sm font-semibold text-amber-700 hover:text-amber-800">← Back to dashboard</Link><header className="mt-8 rounded-3xl bg-slate-950 p-8 text-white shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">Admin</p><h1 className="mt-3 text-4xl font-bold tracking-tight">Timetable Analyser</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">Upload the school timetable workbook to review extracted staff loads, curriculum subjects, year-group coverage and parsing warnings before any future import flow is added.</p></header><TimetableAnalyserForm /></main>;
}
