import Link from "next/link";
import { AccountStatus, UserRole } from "@prisma/client";
import { getSelectedLocalDevelopmentUser } from "../../../lib/local-dev-user";
import { canManageUsers } from "../../../lib/permissions";
import { prisma } from "../../../lib/prisma";
import { CreateManagedUserForm, EditableUserRow } from "./user-management-forms";

export const dynamic = "force-dynamic";

function linkedDataLabel(counts: {
  teachingClasses: number;
  classEnrollments: number;
  createdAssignments: number;
  homeworkSubmissions: number;
  feedbackEntries: number;
}) {
  const items = [
    ["teaching classes", counts.teachingClasses],
    ["enrolments", counts.classEnrollments],
    ["created assignments", counts.createdAssignments],
    ["submissions", counts.homeworkSubmissions],
    ["feedback entries", counts.feedbackEntries],
  ].filter(([, count]) => Number(count) > 0);

  if (items.length === 0) {
    return "No linked class or homework data yet.";
  }

  return items.map(([label, count]) => `${count} ${label}`).join(" · ");
}

export default async function AdminUsersPage() {
  const { selectedUser } = await getSelectedLocalDevelopmentUser();
  const canManage = canManageUsers(selectedUser);

  if (!canManage) {
    return (
      <main className="mx-auto min-h-screen max-w-4xl px-6 py-16">
        <Link href="/" className="text-sm font-semibold text-amber-700 hover:text-amber-800">← Back to dashboard</Link>
        <section className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-8 text-left shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">Admin only</p>
          <h1 className="mt-3 text-3xl font-bold text-slate-950">User management is unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-slate-700">Switch the temporary local development user to an ADMIN account to create or manage accounts. Current user: {selectedUser ? `${selectedUser.displayName} (${selectedUser.role})` : "none selected"}.</p>
        </section>
      </main>
    );
  }

  const users = await prisma.user.findMany({
    orderBy: [{ accountStatus: "asc" }, { role: "asc" }, { displayName: "asc" }],
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
      accountStatus: true,
      isDevelopmentUser: true,
      yearGroup: true,
      _count: {
        select: {
          teachingClasses: true,
          classEnrollments: true,
          createdAssignments: true,
          homeworkSubmissions: true,
          feedbackEntries: true,
        },
      },
    },
  });

  const activeUsers = users.filter((user) => user.accountStatus === AccountStatus.ACTIVE);
  const disabledUsers = users.filter((user) => user.accountStatus === AccountStatus.DISABLED);

  function toManagedUser(user: (typeof users)[number]) {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      accountStatus: user.accountStatus,
      yearGroup: user.yearGroup,
      isEditable: user.role !== UserRole.ADMIN && !user.isDevelopmentUser,
      linkedDataSummary: linkedDataLabel(user._count),
    };
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <Link href="/" className="text-sm font-semibold text-amber-700 hover:text-amber-800">← Back to dashboard</Link>
      <header className="mt-8 rounded-3xl bg-slate-950 p-8 text-white shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">Admin</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">User management</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">Create local-first teacher and student accounts, review roles and statuses, and deactivate accounts without deleting linked class, assignment, submission, or feedback history.</p>
      </header>

      <div className="mt-8 grid gap-8">
        <CreateManagedUserForm />
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Active accounts</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">Active users</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">These accounts remain available for normal class, enrolment, import, and local user-switching workflows.</p>
            </div>
            <p className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">{activeUsers.length} active</p>
          </div>
          <div className="mt-5 max-h-[42rem] overflow-auto rounded-2xl border border-slate-200">
            <table className="min-w-[920px] text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-500">
                <tr><th className="px-4 py-3">Display name</th><th className="px-4 py-3">Email/login</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Management</th></tr>
              </thead>
              <tbody>
                {activeUsers.length === 0 ? <tr><td colSpan={5} className="px-4 py-6 text-center text-sm font-semibold text-slate-500">No active users found.</td></tr> : activeUsers.map((user) => <EditableUserRow key={user.id} user={toManagedUser(user)} />)}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Disabled accounts</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">Disabled users</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Disabled users are kept out of normal workflows until an admin reactivates them.</p>
            </div>
            <p className="rounded-full bg-slate-200 px-3 py-1 text-sm font-semibold text-slate-700">{disabledUsers.length} disabled</p>
          </div>
          <div className="mt-5 max-h-[34rem] overflow-auto rounded-2xl border border-slate-200 bg-white">
            <table className="min-w-[920px] text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-500">
                <tr><th className="px-4 py-3">Display name</th><th className="px-4 py-3">Email/login</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Management</th></tr>
              </thead>
              <tbody>
                {disabledUsers.length === 0 ? <tr><td colSpan={5} className="px-4 py-6 text-center text-sm font-semibold text-slate-500">No disabled users.</td></tr> : disabledUsers.map((user) => <EditableUserRow key={user.id} user={toManagedUser(user)} />)}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
