import { UserRole } from "@prisma/client";
import Link from "next/link";
import { getSelectedLocalDevelopmentUser } from "../../../lib/local-dev-user";
import { canManageUsers } from "../../../lib/permissions";
import { prisma } from "../../../lib/prisma";
import { addDepartmentTeamMember, createDepartmentTeam, removeDepartmentTeamMember, updateDepartmentTeam } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminTeamsPage() {
  const { selectedUser } = await getSelectedLocalDevelopmentUser();
  if (!canManageUsers(selectedUser)) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-16">
        <Link href="/" className="text-sm font-semibold text-amber-700">← Back to dashboard</Link>
        <section className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">Admin only</p>
          <h1 className="mt-3 text-3xl font-bold text-slate-950">Department teams are admin-managed</h1>
          <p className="mt-3 text-sm text-slate-700">Switch to an ADMIN account to create teams and manage teacher membership.</p>
        </section>
      </main>
    );
  }

  const [teams, teachers] = await Promise.all([
    prisma.departmentTeam.findMany({
      orderBy: { name: "asc" },
      include: {
        memberships: { include: { user: { select: { displayName: true, email: true } } }, orderBy: { user: { displayName: "asc" } } },
        _count: { select: { libraryItems: true } },
      },
    }),
    prisma.user.findMany({ where: { role: UserRole.TEACHER, accountStatus: "ACTIVE" }, orderBy: { displayName: "asc" }, select: { id: true, displayName: true, email: true } }),
  ]);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <Link href="/" className="text-sm font-semibold text-amber-700 hover:text-amber-800">← Back to dashboard</Link>
      <header className="mt-8 rounded-3xl bg-slate-950 p-8 text-white">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">Clarion admin</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">Department teams</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">Create simple department/team groups and add teacher members. Teachers can share reusable curriculum library items with their teams.</p>
      </header>

      <form action={createDepartmentTeam} className="mt-8 grid gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-[1fr_1.5fr_auto] md:items-end">
        <label className="text-sm font-semibold text-slate-700">Team name<input name="name" required className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="English department" /></label>
        <label className="text-sm font-semibold text-slate-700">Description<input name="description" className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="Optional notes" /></label>
        <button className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Create team</button>
      </form>

      <section className="mt-8 grid gap-5">
        {teams.length === 0 ? <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-sm text-slate-600">No department teams yet.</div> : null}
        {teams.map((team) => (
          <article key={team.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <form action={updateDepartmentTeam} className="grid gap-3 md:grid-cols-[1fr_1.5fr_auto]">
              <input type="hidden" name="teamId" value={team.id} />
              <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Name<input name="name" defaultValue={team.name} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm normal-case tracking-normal text-slate-950" /></label>
              <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Description<input name="description" defaultValue={team.description ?? ""} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm normal-case tracking-normal text-slate-950" /></label>
              <button className="self-end rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950">Save</button>
            </form>
            <p className="mt-3 text-xs font-semibold text-slate-500">{team.memberships.length} member(s) · {team._count.libraryItems} shared library item(s)</p>
            <div className="mt-4 grid gap-2">
              {team.memberships.map((membership) => (
                <form key={membership.id} action={removeDepartmentTeamMember} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <span><strong>{membership.user.displayName}</strong> <span className="text-slate-500">{membership.user.email}</span></span>
                  <input type="hidden" name="membershipId" value={membership.id} />
                  <button className="rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-700">Remove</button>
                </form>
              ))}
            </div>
            <form action={addDepartmentTeamMember} className="mt-4 flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-end">
              <input type="hidden" name="teamId" value={team.id} />
              <label className="flex-1 text-sm font-semibold text-slate-700">Add teacher<select name="userId" className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"><option value="">Choose teacher</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.displayName} — {teacher.email}</option>)}</select></label>
              <button className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Add member</button>
            </form>
          </article>
        ))}
      </section>
    </main>
  );
}
