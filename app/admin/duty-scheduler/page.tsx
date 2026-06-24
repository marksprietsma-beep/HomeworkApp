import Link from "next/link";
import { getSelectedLocalDevelopmentUser } from "../../../lib/local-dev-user";
import { isAdmin } from "../../../lib/permissions";
import { getActiveTimetableImport } from "../timetable-analyser/actions";
import { getDutySchedules } from "./actions";
import { DutySchedulerForm } from "./duty-scheduler-form";

export const dynamic = "force-dynamic";

export default async function AdminDutySchedulerPage() {
  const { selectedUser } = await getSelectedLocalDevelopmentUser();
  const canSchedule = isAdmin(selectedUser);

  if (!canSchedule) {
    return <main className="mx-auto min-h-screen max-w-4xl px-6 py-16"><Link href="/" className="text-sm font-semibold text-amber-700 hover:text-amber-800">← Back to dashboard</Link><section className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-8 text-left shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">Admin only</p><h1 className="mt-3 text-3xl font-bold text-slate-950">Duty scheduler is unavailable</h1><p className="mt-3 text-sm leading-6 text-slate-700">Switch the temporary local development user to an ADMIN account to build duty schedules. Current user: {selectedUser ? `${selectedUser.displayName} (${selectedUser.role})` : "none selected"}.</p></section></main>;
  }

  const activeTimetableResult = await getActiveTimetableImport();
  const activeTimetable = activeTimetableResult.timetable;
  const dutySchedulesResult = await getDutySchedules();
  const dutySchedules = dutySchedulesResult.schedules;

  return <main className="mx-auto min-h-screen max-w-7xl px-6 py-12"><Link href="/" className="text-sm font-semibold text-amber-700 hover:text-amber-800">← Back to dashboard</Link><header className="mt-8 rounded-3xl bg-slate-950 p-8 text-white shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">Admin</p><h1 className="mt-3 text-4xl font-bold tracking-tight">Duty Scheduler</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">Define Breaktime, Lunch A and Lunch B duties, then generate a workload-aware assignment from the active saved timetable.</p></header>{activeTimetable ? <DutySchedulerForm timetable={activeTimetable} initialSchedules={dutySchedules} /> : <section className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-8 shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">No active timetable</p><h2 className="mt-3 text-2xl font-bold text-slate-950">Please save and activate a timetable before using the duty scheduler.</h2><p className="mt-3 text-sm text-slate-700">Use the timetable analyser to upload, review, save and mark a timetable as active first.</p><Link href="/admin/timetable-analyser" className="mt-5 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800">Open timetable analyser</Link></section>}</main>;
}
