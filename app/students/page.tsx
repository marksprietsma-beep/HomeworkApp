import { AccountStatus, UserRole } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUserState } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import { canAccessStudentManagement, manageableClassesWhere, studentDirectoryWhere } from "../../lib/student-management";
import { StudentAvatar } from "../components/student-avatar";
import { EnrollStudentForm, RemoveEnrollmentForm, ResetStudentPasswordForm, ResetStudentProfileImageForm } from "./student-roster-forms";

export const dynamic = "force-dynamic";
type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function StudentsPage({ searchParams }: Props) {
  const { selectedUser } = await getCurrentUserState();
  if (!selectedUser || !canAccessStudentManagement(selectedUser)) redirect("/");
  const params = (await searchParams) ?? {};
  const search = typeof params.search === "string" ? params.search.slice(0, 120) : "";
  const where = studentDirectoryWhere(selectedUser, search);
  const enrollmentWhere = selectedUser.role === UserRole.ADMIN ? {} : { class: { teacherId: selectedUser.id } };
  const [students, classes, total] = await Promise.all([
    prisma.user.findMany({ where, orderBy: [{ accountStatus: "asc" }, { displayName: "asc" }], take: 200, select: {
      id: true, displayName: true, email: true, yearGroup: true, profileImagePath: true, accountStatus: true, mustChangePassword: true,
      classEnrollments: { where: enrollmentWhere, orderBy: { class: { name: "asc" } }, select: { class: { select: { id: true, name: true, subject: true } } } },
    } }),
    prisma.class.findMany({ where: manageableClassesWhere(selectedUser), orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.count({ where }),
  ]);

  return <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl">
    <nav className="flex flex-wrap items-center gap-3 text-sm font-semibold"><Link href="/" className="text-slate-600 hover:text-slate-950">← Dashboard</Link>{selectedUser.role === UserRole.ADMIN ? <Link href="/admin/users" className="text-blue-700">Global account lifecycle →</Link> : null}</nav>
    <header className="mt-6 rounded-3xl bg-slate-950 p-7 text-white shadow-xl sm:p-10"><p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Staff workspace</p><h1 className="mt-3 text-3xl font-bold sm:text-4xl">Student management</h1><p className="mt-3 max-w-3xl text-slate-300">Search students, understand their class membership, and maintain authorised rosters. Account roles, status, and deletion remain in the admin-only Manage users screen.</p></header>

    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><h2 className="text-xl font-bold text-slate-950">Add an existing student</h2><p className="mt-1 text-sm text-slate-600">Matched by exact school email. This only adds an enrolment and never changes credentials or account settings.</p></div>{classes[0] ? <Link href={`/classes/${classes[0].id}#student-import`} className="text-sm font-semibold text-blue-700 underline underline-offset-4">Create or bulk import via CSV →</Link> : null}</div><EnrollStudentForm classes={classes} />{classes.length === 0 ? <p className="mt-3 text-sm text-amber-800">You do not have an authorised class roster to manage.</p> : null}</section>

    <section className="mt-8"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-2xl font-bold text-slate-950">Students in your scope</h2><p className="mt-1 text-sm text-slate-600">{total} result{total === 1 ? "" : "s"}{total > 200 ? " · showing the first 200" : ""}</p></div><form className="flex gap-2" role="search"><label className="sr-only" htmlFor="student-search">Search students</label><input id="student-search" name="search" defaultValue={search} placeholder="Name, email, or year" className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm shadow-sm sm:w-72" /><button className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Search</button>{search ? <Link href="/students" className="self-center text-sm font-semibold text-slate-600">Clear</Link> : null}</form></div>
      <div className="mt-5 grid gap-4">{students.map((student) => { const disabled = student.accountStatus === AccountStatus.DISABLED; return <article key={student.id} className={`rounded-2xl border p-5 shadow-sm ${disabled ? "border-slate-300 bg-slate-100 opacity-75" : "border-slate-200 bg-white"}`}><div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between"><div className="flex min-w-0 gap-4"><StudentAvatar displayName={student.displayName} imagePath={student.profileImagePath} /><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-bold text-slate-950">{student.displayName}</h3><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${disabled ? "bg-slate-300 text-slate-800" : "bg-emerald-100 text-emerald-800"}`}>{student.accountStatus}</span>{student.mustChangePassword ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900">Password change required</span> : null}</div><p className="mt-1 break-all text-sm text-slate-700">{student.email}</p><p className="mt-1 text-sm text-slate-500">Year group: {student.yearGroup || "Not recorded"}</p>{disabled ? <p className="mt-3 text-sm font-medium text-slate-700">Disabled accounts cannot be enrolled. An administrator must review account status in Manage users.</p> : null}</div></div>
        <div className="w-full lg:max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Relevant class enrolments</p><div className="mt-2 grid gap-2">{student.classEnrollments.map(({ class: item }) => <div key={item.id} className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200"><div><Link href={`/classes/${item.id}`} className="font-semibold text-blue-800 hover:underline">{item.name}</Link><p className="text-xs text-slate-500">{item.subject}</p></div><RemoveEnrollmentForm classId={item.id} studentId={student.id} className={item.name} /></div>)}{student.classEnrollments.length === 0 ? <p className="text-sm text-slate-500">No relevant enrolments.</p> : null}</div><ResetStudentPasswordForm studentId={student.id} studentName={student.displayName} />{student.profileImagePath ? <ResetStudentProfileImageForm studentId={student.id} studentName={student.displayName} /> : null}</div></div></article>; })}{students.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600">No students match this search in your authorised classes.</div> : null}</div>
    </section>
  </div></main>;
}
