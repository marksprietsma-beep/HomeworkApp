import Link from "next/link";
import { AccountStatus, UserRole } from "@prisma/client";
import { getSelectedLocalDevelopmentUser } from "../../../lib/local-dev-user";
import { canManageClasses } from "../../../lib/permissions";
import { prisma } from "../../../lib/prisma";
import { CreateAdminClassForm, EditableClassRow } from "./class-management-forms";

export const dynamic = "force-dynamic";

export default async function AdminClassesPage() {
  const { selectedUser } = await getSelectedLocalDevelopmentUser();
  const canManage = canManageClasses(selectedUser);
  if (!canManage) return <main className="mx-auto min-h-screen max-w-4xl px-6 py-16"><Link href="/" className="text-sm font-semibold text-amber-700 hover:text-amber-800">← Back to dashboard</Link><section className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-8 text-left shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">Admin only</p><h1 className="mt-3 text-3xl font-bold text-slate-950">Class management is unavailable</h1><p className="mt-3 text-sm leading-6 text-slate-700">Switch the temporary local development user to an ADMIN account to create or manage classes. Current user: {selectedUser ? `${selectedUser.displayName} (${selectedUser.role})` : "none selected"}.</p></section></main>;

  const [classes, teachers] = await Promise.all([
    prisma.class.findMany({ orderBy: { name: "asc" }, include: { teacher: { select: { id: true, displayName: true, email: true, accountStatus: true } }, _count: { select: { enrollments: true, homeworkAssignments: true } } } }),
    prisma.user.findMany({ where: { role: UserRole.TEACHER, accountStatus: AccountStatus.ACTIVE }, orderBy: { displayName: "asc" }, select: { id: true, displayName: true, email: true } }),
  ]);

  return <main className="mx-auto min-h-screen max-w-7xl px-6 py-12"><Link href="/" className="text-sm font-semibold text-amber-700 hover:text-amber-800">← Back to dashboard</Link><header className="mt-8 rounded-3xl bg-slate-950 p-8 text-white shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">Admin</p><h1 className="mt-3 text-4xl font-bold tracking-tight">Class management</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">Create classes, assign active teachers, and archive classes by switching them inactive rather than deleting linked homework, enrolments, submissions, or feedback.</p></header><div className="mt-8 grid gap-8 xl:grid-cols-[0.8fr_1.4fr]"><CreateAdminClassForm teachers={teachers} /><section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Classes</p><h2 className="mt-2 text-2xl font-bold text-slate-950">Current classes</h2></div><p className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">{classes.length} total</p></div><div className="mt-5 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="text-xs uppercase tracking-[0.14em] text-slate-500"><tr><th className="px-4 py-3">Class</th><th className="px-4 py-3">Subject</th><th className="px-4 py-3">Notes</th><th className="px-4 py-3">Teacher</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Enrolments</th><th className="px-4 py-3">Assignments</th><th className="px-4 py-3">Edit</th></tr></thead><tbody>{classes.map((classItem) => <EditableClassRow key={classItem.id} teachers={teachers} classItem={{ id: classItem.id, name: classItem.name, subject: classItem.subject, description: classItem.description, teacherId: classItem.teacherId, status: classItem.status, enrollmentCount: classItem._count.enrollments, assignmentCount: classItem._count.homeworkAssignments }} />)}</tbody></table></div></section></div></main>;
}
