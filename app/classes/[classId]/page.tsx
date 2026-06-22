import Link from "next/link";
import { notFound } from "next/navigation";
import { getClassDetailData } from "../../../lib/class-detail";
import { AssignmentCreateForm } from "./assignment-create-form";

export const dynamic = "force-dynamic";

type ClassDetailPageProps = {
  params: Promise<{
    classId: string;
  }>;
};

function formatDate(date: Date | null) {
  if (!date) {
    return "No due date";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-3xl font-bold text-slate-950">{value}</p>
      <p className="mt-1 text-sm font-medium text-slate-600">{label}</p>
    </div>
  );
}

export default async function ClassDetailPage({ params }: ClassDetailPageProps) {
  const { classId } = await params;
  const parsedClassId = Number(classId);

  if (!Number.isInteger(parsedClassId)) {
    notFound();
  }

  const classDetail = await getClassDetailData(parsedClassId);

  if (!classDetail) {
    notFound();
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <Link
        href="/"
        className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
      >
        ← Back to dashboard
      </Link>

      <section className="mt-8 rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
          Class detail
        </p>
        <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-950">
              {classDetail.name}
            </h1>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
              {classDetail.subject}
            </p>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
              {classDetail.description}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-950 px-5 py-4 text-white shadow-sm lg:min-w-72">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
              Teacher
            </p>
            <p className="mt-2 text-lg font-semibold">
              {classDetail.teacher.displayName}
            </p>
            <p className="text-sm text-amber-200">{classDetail.teacher.email}</p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Enrolled users" value={classDetail.totals.enrolledUsers} />
          <StatCard label="Assignments" value={classDetail.totals.assignments} />
          <StatCard label="Questions" value={classDetail.totals.questions} />
          <StatCard label="Submissions" value={classDetail.totals.submissions} />
        </div>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
        <section className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                Assignments
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">
                Class homework
              </h2>
            </div>
          </div>
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">
              Create assignment
            </p>
            <h3 className="mt-2 text-xl font-bold text-slate-950">
              New local homework
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              Create an assignment directly in the local database, or paste
              ChatGPT-generated structured JSON and preview it before saving.
            </p>
            <Link
              href={`/classes/${classDetail.id}/assignments/import`}
              className="mt-4 inline-flex rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-amber-400"
            >
              Import from JSON
            </Link>
            <AssignmentCreateForm classId={classDetail.id} />
          </div>

          {classDetail.assignments.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
              No assignments exist for this class yet.
            </div>
          ) : (
            <ul className="mt-6 grid gap-4">
              {classDetail.assignments.map((assignment) => (
                <li
                  key={assignment.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <Link
                        href={`/classes/${classDetail.id}/assignments/${assignment.id}`}
                        className="text-lg font-semibold text-slate-950 transition hover:text-amber-700"
                      >
                        {assignment.title}
                      </Link>
                      <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                        {assignment.status} · Due: {formatDate(assignment.dueAt)}
                      </p>
                    </div>
                    <p className="rounded-xl bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
                      {assignment.questionCount} questions · {assignment.submissionCount} submissions
                    </p>
                  </div>
                  {assignment.description ? (
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      {assignment.description}
                    </p>
                  ) : null}
                  <Link
                    href={`/classes/${classDetail.id}/assignments/${assignment.id}`}
                    className="mt-4 inline-flex rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                  >
                    View homework details
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
            Enrolled users
          </p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">Members</h2>

          {classDetail.enrolledUsers.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
              No users are enrolled in this class yet.
            </div>
          ) : (
            <ul className="mt-6 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
              {classDetail.enrolledUsers.map((user) => (
                <li key={user.id} className="px-4 py-4">
                  <p className="font-semibold text-slate-950">{user.displayName}</p>
                  <p className="mt-1 text-sm text-slate-600">{user.email}</p>
                  <p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                    {user.role} · Enrolled {formatDate(user.enrolledAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
