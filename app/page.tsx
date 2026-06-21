import { switchLocalDevelopmentUser } from "./actions/local-dev-user";
import {
  canUseLocalDevelopmentSwitcher,
  getSelectedLocalDevelopmentUser,
} from "../lib/local-dev-user";
import {
  getLocalDashboardData,
  type LocalDashboardData,
} from "../lib/dashboard";

export const dynamic = "force-dynamic";

type LocalDevelopmentSwitcherProps = Awaited<
  ReturnType<typeof getSelectedLocalDevelopmentUser>
>;

function LocalDevelopmentSwitcher({
  selectedUser,
  developmentUsers,
}: LocalDevelopmentSwitcherProps) {
  if (!canUseLocalDevelopmentSwitcher()) {
    return null;
  }

  return (
    <section className="mt-10 w-full max-w-2xl rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 p-6 text-left shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">
        Local development only — not authentication
      </p>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">
            Temporary role/user switcher
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            This uses a local cookie to help test seeded teacher and student
            views before real authentication exists. Do not treat this as
            login, authorization, or production security.
          </p>
        </div>
        <div className="rounded-xl bg-white px-4 py-3 text-sm shadow-sm ring-1 ring-amber-200">
          <p className="font-medium text-slate-500">Currently viewing as</p>
          <p className="mt-1 font-semibold text-slate-950">
            {selectedUser?.displayName ?? "No seeded user found"}
          </p>
          <p className="text-amber-700">{selectedUser?.role ?? "UNKNOWN"}</p>
        </div>
      </div>

      <form
        action={switchLocalDevelopmentUser}
        className="mt-6 flex flex-col gap-3 sm:flex-row"
      >
        <label className="flex-1 text-sm font-medium text-slate-700">
          Seeded test user
          <select
            name="userId"
            defaultValue={selectedUser?.id}
            disabled={developmentUsers.length === 0}
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:bg-slate-100"
          >
            {developmentUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName} — {user.role}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={developmentUsers.length === 0}
          className="rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400 sm:self-end"
        >
          Switch local view
        </button>
      </form>
      {developmentUsers.length === 0 ? (
        <p className="mt-4 text-sm text-red-700">
          No seeded development users were found. Run migrations and `npm run
          db:seed` locally.
        </p>
      ) : null}
    </section>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-3xl font-bold text-slate-950">{value}</p>
      <p className="mt-1 text-sm font-medium text-slate-600">{label}</p>
    </div>
  );
}

function DashboardShell({
  selectedUser,
  dashboardData,
}: {
  selectedUser: NonNullable<LocalDevelopmentSwitcherProps["selectedUser"]>;
  dashboardData: LocalDashboardData;
}) {
  const classLabel =
    selectedUser.role === "TEACHER" ? "Classes you teach" : "Classes you are in";

  return (
    <section className="mt-10 w-full rounded-3xl border border-slate-200 bg-white/80 p-6 text-left shadow-sm sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
            Local dashboard
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
            Welcome, {selectedUser.displayName}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Reading the current local development user and class data directly
            from Prisma.
          </p>
        </div>
        <div className="rounded-2xl bg-slate-950 px-5 py-4 text-white shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
            Viewing as
          </p>
          <p className="mt-2 text-lg font-semibold">{selectedUser.displayName}</p>
          <p className="text-sm text-amber-200">{selectedUser.role}</p>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard label="Classes" value={dashboardData.totals.classes} />
        <SummaryCard
          label="Enrolled users"
          value={dashboardData.totals.enrolledUsers}
        />
        <SummaryCard
          label="Assignments"
          value={dashboardData.totals.assignments}
        />
        <SummaryCard label="Questions" value={dashboardData.totals.questions} />
        <SummaryCard
          label="Submissions"
          value={dashboardData.totals.submissions}
        />
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-semibold text-slate-950">{classLabel}</h3>
        {dashboardData.classes.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
            No classes were found for this local development user yet.
          </div>
        ) : (
          <div className="mt-4 grid gap-4">
            {dashboardData.classes.map((classItem) => (
              <article
                key={classItem.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h4 className="text-xl font-semibold text-slate-950">
                      {classItem.name}
                    </h4>
                    <p className="mt-1 text-sm text-slate-600">
                      {classItem.description}
                    </p>
                    <p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                      Teacher: {classItem.teacherName}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm sm:min-w-64">
                    <span className="rounded-xl bg-white px-3 py-2 text-slate-700 shadow-sm">
                      {classItem.enrolledUserCount} enrolled
                    </span>
                    <span className="rounded-xl bg-white px-3 py-2 text-slate-700 shadow-sm">
                      {classItem.assignmentCount} assignments
                    </span>
                    <span className="rounded-xl bg-white px-3 py-2 text-slate-700 shadow-sm">
                      {classItem.questionCount} questions
                    </span>
                    <span className="rounded-xl bg-white px-3 py-2 text-slate-700 shadow-sm">
                      {classItem.submissionCount} submissions
                    </span>
                  </div>
                </div>

                <div className="mt-5">
                  <p className="text-sm font-semibold text-slate-950">
                    Assignments
                  </p>
                  {classItem.assignments.length === 0 ? (
                    <p className="mt-2 rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
                      No assignments exist for this class yet.
                    </p>
                  ) : (
                    <ul className="mt-2 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
                      {classItem.assignments.map((assignment) => (
                        <li
                          key={assignment.id}
                          className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="font-medium text-slate-950">
                              {assignment.title}
                            </p>
                            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                              {assignment.status}
                            </p>
                          </div>
                          <p className="text-sm text-slate-600">
                            {assignment.questionCount} questions ·{" "}
                            {assignment.submissionCount} submissions
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default async function Home() {
  let localDevelopmentUserState: LocalDevelopmentSwitcherProps = {
    selectedUser: null,
    developmentUsers: [],
  };
  let localDevelopmentUserError: string | null = null;
  let dashboardData: LocalDashboardData | null = null;

  if (canUseLocalDevelopmentSwitcher()) {
    try {
      localDevelopmentUserState = await getSelectedLocalDevelopmentUser();
      if (localDevelopmentUserState.selectedUser) {
        dashboardData = await getLocalDashboardData(
          localDevelopmentUserState.selectedUser,
        );
      }
    } catch {
      localDevelopmentUserError =
        "Local development users could not be loaded. Confirm PostgreSQL is running, migrations are applied, and seed data exists.";
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-6 py-16 text-center">
      <p className="mb-4 rounded-full border border-slate-200 px-4 py-1 text-sm font-medium text-slate-600">
        Local-first foundation
      </p>
      <h1 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-6xl">
        Homework App
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
        A lightweight starting point for running Homework App locally during
        development and later on a generic Linux or Docker-capable school
        server.
      </p>
      {localDevelopmentUserError ? (
        <section className="mt-10 w-full max-w-2xl rounded-2xl border border-red-200 bg-red-50 p-6 text-left text-sm text-red-800">
          <p className="font-semibold">Local development switcher unavailable</p>
          <p className="mt-2">{localDevelopmentUserError}</p>
        </section>
      ) : (
        <>
          {localDevelopmentUserState.selectedUser && dashboardData ? (
            <DashboardShell
              selectedUser={localDevelopmentUserState.selectedUser}
              dashboardData={dashboardData}
            />
          ) : null}
          <LocalDevelopmentSwitcher {...localDevelopmentUserState} />
        </>
      )}
    </main>
  );
}
