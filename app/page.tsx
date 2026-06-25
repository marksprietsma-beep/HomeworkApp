import Link from "next/link";
import { redirect } from "next/navigation";
import { switchLocalDevelopmentUser } from "./actions/local-dev-user";
import {
  canUseLocalDevelopmentSwitcher,
  getSelectedLocalDevelopmentUser,
} from "../lib/local-dev-user";
import {
  getLocalDashboardData,
  type LocalDashboardData,
} from "../lib/dashboard";
import {
  dueFilterOptions,
  filterAndSortAssignments,
  parseAssignmentListFilters,
  sortOptions,
  statusFilterOptions,
  type AssignmentListFilters,
} from "../lib/assignment-list-filters";
import { isAdmin, isStudent, isTeacher } from "../lib/permissions";
import { hasInitialAdminUser } from "../lib/first-run-setup";
import { getBilingualTextParts } from "../lib/i18n-content";
import { CLARION_TAGLINE, ClarionLogo } from "./components/clarion-logo";

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
            This uses a local cookie to help test seeded admin, teacher, and
            student views before real authentication exists. Do not treat this
            as login, authorization, or production security.
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

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-3xl font-bold text-slate-950">{value}</p>
      <p className="mt-1 text-sm font-medium text-slate-600">{label}</p>
    </div>
  );
}

function formatDueDate(dueAt: Date | null) {
  if (!dueAt) {
    return "No due date";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(dueAt);
}

function dueStatusBadgeClass(tone: LocalDashboardData["assignedWork"][number]["dueStatus"]["tone"]) {
  return {
    slate: "bg-white text-slate-600 ring-slate-200",
    blue: "bg-blue-50 text-blue-800 ring-blue-200",
    amber: "bg-amber-100 text-amber-900 ring-amber-200",
    red: "bg-red-50 text-red-800 ring-red-200",
    emerald: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  }[tone];
}

const studentStatusLabels: Record<
  LocalDashboardData["assignedWork"][number]["studentStatus"],
  string
> = {
  "not-started": "Not started",
  submitted: "Submitted",
  "feedback-available": "Feedback available",
  "feedback-actions-pending": "Feedback actions pending",
  completed: "Completed",
};

const studentSectionLabels: Record<string, string> = {
  todo: "Active assignments",
  submitted: "Submitted — waiting for feedback",
  feedback: "Released feedback",
  followups: "Follow-up items",
};

const studentEmptyStates: Record<string, string> = {
  todo: "No active assignments need a submission right now.",
  submitted: "No submitted work is waiting for released feedback right now.",
  feedback: "No released feedback is available to review right now.",
  followups: "No follow-up items need your attention right now.",
};


function formatFeedbackActionType(type: string) {
  return type
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function renderBilingualText(fallback: string, i18n: unknown) {
  return (
    <span className="grid gap-1">
      {getBilingualTextParts(fallback, i18n).map((part, index) => (
        <span key={index}>{part}</span>
      ))}
    </span>
  );
}

function StudentAssignmentCard({
  assignment,
}: {
  assignment: LocalDashboardData["assignedWork"][number];
}) {
  const workHref = `/assignments/${assignment.id}/work`;
  const hasFeedback = assignment.feedback !== null;

  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            {assignment.className}
            {assignment.subject ? ` · ${assignment.subject}` : ""}
          </p>
          <h4 className="mt-2 text-xl font-semibold text-slate-950">
            {renderBilingualText(assignment.title, assignment.titleI18n)}
          </h4>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.14em]">
            <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-900 shadow-sm ring-1 ring-amber-200">
              {studentStatusLabels[assignment.studentStatus]}
            </span>
            <span className="rounded-full bg-white px-3 py-1 text-slate-600 shadow-sm ring-1 ring-slate-200">
              Published
            </span>
            {assignment.dueAt ? (
              <span className={`rounded-full px-3 py-1 shadow-sm ring-1 ${dueStatusBadgeClass(assignment.dueStatus.tone)}`}>
                {assignment.dueStatus.label}: {formatDueDate(assignment.dueAt)}
              </span>
            ) : null}
            <span className="rounded-full bg-white px-3 py-1 text-slate-600 shadow-sm ring-1 ring-slate-200">
              {assignment.questionCount} questions
            </span>
            <span className="rounded-full bg-white px-3 py-1 text-slate-600 shadow-sm ring-1 ring-slate-200">
              {assignment.totalPoints === null
                ? "Points not set"
                : `${assignment.totalPoints} points`}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={hasFeedback ? `${workHref}#feedback` : workHref}
              className="inline-flex rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              {hasFeedback
                ? assignment.feedback?.pendingActions
                  ? "Respond to follow-up"
                  : "View feedback"
                : assignment.submission?.status === "SUBMITTED"
                  ? "View response"
                  : assignment.submission
                    ? "Continue"
                    : "Start"}
            </Link>
          </div>
        </div>
        <div className="grid gap-3 text-sm lg:min-w-64">
          <div className="rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
            <p className="font-medium text-slate-500">Submission</p>
            {assignment.submission ? (
              <>
                <p className="mt-1 font-semibold text-slate-950">
                  {assignment.submission.status}
                </p>
                <p className="text-slate-600">
                  {assignment.submission.submittedAt
                    ? `Submitted ${formatDueDate(assignment.submission.submittedAt)}`
                    : "Saved but not submitted"}
                </p>
              </>
            ) : (
              <p className="mt-1 font-semibold text-slate-950">
                No response yet
              </p>
            )}
          </div>
          <div className="rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
            <p className="font-medium text-slate-500">Feedback</p>
            {assignment.feedback ? (
              <>
                <p className="mt-1 font-semibold text-slate-950">
                  Imported {formatDueDate(assignment.feedback.importedAt)}
                </p>
                <p className="text-slate-600">
                  {assignment.feedback.pendingActions} pending ·{" "}
                  {assignment.feedback.completedActions}/
                  {assignment.feedback.totalActions} completed
                </p>
              </>
            ) : (
              <p className="mt-1 font-semibold text-slate-950">
                Not available yet
              </p>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function getFollowUpItemKey(
  assignment: LocalDashboardData["assignedWork"][number],
  action: NonNullable<LocalDashboardData["assignedWork"][number]["feedback"]>["actions"][number] & {
    questionFeedbackId?: number | null;
    questionId?: number | null;
  },
) {
  return [
    "assignment",
    assignment.id,
    "feedback",
    assignment.feedback?.id ?? "none",
    "question",
    action.questionId ?? action.questionFeedbackId ?? "overall",
    "action",
    action.id,
  ].join("-");
}

function StudentAssignedWorkDashboard({
  selectedUser,
  dashboardData,
  filters,
}: {
  selectedUser: NonNullable<LocalDevelopmentSwitcherProps["selectedUser"]>;
  dashboardData: LocalDashboardData;
  filters: AssignmentListFilters;
}) {
  const classOptions = dashboardData.classes.map((classItem) => ({
    id: classItem.id,
    name: classItem.name,
  }));
  const studentFilters: AssignmentListFilters = { ...filters, status: "all" };
  const assignments = filterAndSortAssignments(
    dashboardData.assignedWork,
    studentFilters,
  );
  const activeAssignments = assignments.filter((assignment) => assignment.studentStatus === "not-started");
  const awaitingFeedback = assignments.filter((assignment) => assignment.studentStatus === "submitted");
  const releasedFeedback = assignments.filter((assignment) => assignment.feedback !== null);
  const followUpItems = assignments.flatMap((assignment) =>
    (assignment.feedback?.actions ?? [])
      .filter((action) => action.status === "PENDING")
      .map((action) => ({ assignment, action })),
  );
  const sections = [
    { key: "todo", assignments: activeAssignments },
    { key: "submitted", assignments: awaitingFeedback },
    { key: "feedback", assignments: releasedFeedback },
  ];
  return (
    <section className="mt-10 w-full rounded-3xl border border-slate-200 bg-white/80 p-6 text-left shadow-sm sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
            Assigned work
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
            Welcome, {selectedUser.displayName}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Open homework assigned through the classes you are enrolled in,
            enter responses, and return later to review feedback with clarity.
          </p>
        </div>
        <div className="rounded-2xl bg-slate-950 px-5 py-4 text-white shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
            Viewing as
          </p>
          <p className="mt-2 text-lg font-semibold">
            {selectedUser.displayName}
          </p>
          <p className="text-sm text-amber-200">{selectedUser.role}</p>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Active assignments" value={activeAssignments.length} />
        <SummaryCard label="Awaiting feedback" value={awaitingFeedback.length} />
        <SummaryCard label="Feedback available" value={releasedFeedback.length} />
        <SummaryCard label="Follow-up items" value={followUpItems.length} />
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-semibold text-slate-950">
          Your assignments
        </h3>
        <AssignmentFilterForm
          filters={studentFilters}
          classOptions={classOptions}
          hideStatusFilter
        />
        {assignments.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
            No published assignments were found for your active enrolled classes
            yet. When a teacher publishes homework for one of your classes, it
            will appear here.
          </div>
        ) : (
          <div className="mt-4 grid gap-6">
            {sections.map(({ key: sectionKey, assignments: sectionAssignments }) => {
                return (
                  <section
                    key={sectionKey}
                    className="rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-base font-semibold text-slate-950">
                        {studentSectionLabels[sectionKey]}
                      </h4>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                        {sectionAssignments.length}
                      </span>
                    </div>
                    {sectionAssignments.length === 0 ? (
                      <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                        {studentEmptyStates[sectionKey]}
                      </p>
                    ) : (
                      <div className="mt-3 grid gap-4">
                        {sectionAssignments.map((assignment) => (
                          <StudentAssignmentCard
                            key={assignment.id}
                            assignment={assignment}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-base font-semibold text-slate-950">{studentSectionLabels.followups}</h4>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{followUpItems.length}</span>
                </div>
                {followUpItems.length === 0 ? (
                  <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">{studentEmptyStates.followups}</p>
                ) : (
                  <ul className="mt-3 grid gap-3">
                    {followUpItems.map(({ assignment, action }) => (
                      <li key={getFollowUpItemKey(assignment, action)} className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm">
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-800">{formatFeedbackActionType(action.type)}</p>
                        <p className="mt-2 font-semibold text-slate-950">{renderBilingualText(assignment.title, assignment.titleI18n)}</p>
                        <p className="mt-1 line-clamp-2 leading-6 text-slate-700">{renderBilingualText(action.prompt, action.promptI18n)}</p>
                        <Link href={`/assignments/${assignment.id}/work#feedback-action-${action.id}`} className="mt-3 inline-flex rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">Respond or view</Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
          </div>
        )}
      </div>
    </section>
  );
}

function DashboardShell({
  selectedUser,
  dashboardData,
  filters,
}: {
  selectedUser: NonNullable<LocalDevelopmentSwitcherProps["selectedUser"]>;
  dashboardData: LocalDashboardData;
  filters: AssignmentListFilters;
}) {
  if (isStudent(selectedUser)) {
    return (
      <StudentAssignedWorkDashboard
        selectedUser={selectedUser}
        dashboardData={dashboardData}
        filters={filters}
      />
    );
  }

  const classLabel = isAdmin(selectedUser)
    ? "All classes"
    : "Classes you teach";
  const classOptions = dashboardData.classes.map((classItem) => ({
    id: classItem.id,
    name: classItem.name,
  }));
  const filteredClasses = dashboardData.classes.map((classItem) => ({
    ...classItem,
    assignments: filterAndSortAssignments(classItem.assignments, filters),
  }));

  return (
    <section className="mt-10 w-full rounded-3xl border border-slate-200 bg-white/80 p-6 text-left shadow-sm sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
            Clarion dashboard
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
            Welcome, {selectedUser.displayName}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Reading the current local development user and class data directly
            from Prisma. Clarion keeps teacher, student, and admin workflows
            in one clean local-first workspace.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {isAdmin(selectedUser) ? (
              <>
                <Link
                  href="/admin/users"
                  className="inline-flex rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-amber-400"
                >
                  Manage users
                </Link>
                <Link
                  href="/admin/classes"
                  className="inline-flex rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                >
                  Manage classes
                </Link>
                <Link
                  href="/admin/teams"
                  className="inline-flex rounded-full bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-900 shadow-sm ring-1 ring-emerald-200 transition hover:bg-emerald-200"
                >
                  Manage teams
                </Link>
                <Link
                  href="/admin/timetable-analyser"
                  className="inline-flex rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-950 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-200"
                >
                  Timetable Analyser
                </Link>
                <Link
                  href="/admin/duty-scheduler"
                  className="inline-flex rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-950 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-200"
                >
                  Duty Scheduler
                </Link>
              </>
            ) : null}
            {(isAdmin(selectedUser) || isTeacher(selectedUser)) ? (
              <Link
                href="/curriculum-library"
                className="inline-flex rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 shadow-sm ring-1 ring-emerald-200 transition hover:bg-emerald-100"
              >
                Curriculum library
              </Link>
            ) : null}
            {isTeacher(selectedUser) ? (
              <Link
                href="/classes/new"
                className="inline-flex rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-amber-400"
              >
                Create class
              </Link>
            ) : null}
          </div>
        </div>
        <div className="rounded-2xl bg-slate-950 px-5 py-4 text-white shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
            Viewing as
          </p>
          <p className="mt-2 text-lg font-semibold">
            {selectedUser.displayName}
          </p>
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
        <AssignmentFilterForm filters={filters} classOptions={classOptions} />
        {dashboardData.classes.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
            No classes were found for this local development user yet.
          </div>
        ) : (
          <div className="mt-4 grid gap-4">
            {filteredClasses.map((classItem) => (
              <article
                key={classItem.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h4 className="text-xl font-semibold text-slate-950">
                      {classItem.name}
                    </h4>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
                      {classItem.subject}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      {classItem.description}
                    </p>
                    <p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                      Teacher: {classItem.teacherName}
                    </p>
                    <Link
                      href={`/classes/${classItem.id}`}
                      className="mt-4 inline-flex rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                    >
                      View class details
                    </Link>
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
                          <div className="flex flex-col gap-2 text-sm text-slate-600 sm:items-end">
                            <p>
                              {assignment.questionCount} questions ·{" "}
                              {assignment.submissionCount} submissions
                            </p>
                            <Link
                              href={`/classes/${classItem.id}/assignments/${assignment.id}/responses`}
                              className="font-semibold text-slate-950 underline-offset-4 hover:underline"
                            >
                              Response overview
                            </Link>
                          </div>
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

function AssignmentFilterForm({
  filters,
  classOptions,
  hideClassFilter = false,
  hideStatusFilter = false,
}: {
  filters: AssignmentListFilters;
  classOptions?: { id: number; name: string }[];
  hideClassFilter?: boolean;
  hideStatusFilter?: boolean;
}) {
  return (
    <form className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left sm:grid-cols-2 lg:grid-cols-5">
      <label className="text-sm font-semibold text-slate-700">
        Search title
        <input
          name="search"
          defaultValue={filters.search}
          placeholder="Assignment title"
          className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm"
        />
      </label>
      {hideStatusFilter ? null : (
        <label className="text-sm font-semibold text-slate-700">
          Status
          <select
            name="status"
            defaultValue={filters.status}
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm"
          >
            {statusFilterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {hideClassFilter ? null : (
        <label className="text-sm font-semibold text-slate-700">
          Class
          <select
            name="classId"
            defaultValue={filters.classId}
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm"
          >
            <option value="all">All classes</option>
            {(classOptions ?? []).map((classItem) => (
              <option key={classItem.id} value={classItem.id}>
                {classItem.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="text-sm font-semibold text-slate-700">
        Due date
        <select
          name="due"
          defaultValue={filters.due}
          className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm"
        >
          {dueFilterOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-semibold text-slate-700">
        Sort
        <select
          name="sort"
          defaultValue={filters.sort}
          className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm"
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-2 sm:col-span-2 lg:col-span-5">
        <button
          type="submit"
          className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
        >
          Apply filters
        </button>
        <Link
          href="/"
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
        >
          Reset
        </Link>
      </div>
    </form>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  let localDevelopmentUserState: LocalDevelopmentSwitcherProps = {
    selectedUser: null,
    developmentUsers: [],
  };
  let localDevelopmentUserError: string | null = null;
  let dashboardData: LocalDashboardData | null = null;
  const filters = parseAssignmentListFilters(await searchParams);

  if (!(await hasInitialAdminUser())) {
    redirect("/setup");
  }

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
      <div className="mb-6 flex justify-center">
        <ClarionLogo
          className="inline-flex justify-center"
          markClassName="h-16 w-auto max-w-[18rem] sm:h-20 sm:max-w-sm"
        />
      </div>
      <p className="mb-4 rounded-full border border-teal-200 bg-teal-50 px-4 py-1 text-sm font-medium text-teal-800">
        Local-first learning workspace
      </p>
      <h1 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-6xl">
        Clarion
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
        {CLARION_TAGLINE} A calm, structured place for teachers and students to
        manage assignments, responses, and feedback locally.
      </p>
      {localDevelopmentUserError ? (
        <section className="mt-10 w-full max-w-2xl rounded-2xl border border-red-200 bg-red-50 p-6 text-left text-sm text-red-800">
          <p className="font-semibold">
            Local development switcher unavailable
          </p>
          <p className="mt-2">{localDevelopmentUserError}</p>
        </section>
      ) : (
        <>
          {localDevelopmentUserState.selectedUser && dashboardData ? (
            <DashboardShell
              selectedUser={localDevelopmentUserState.selectedUser}
              dashboardData={dashboardData}
              filters={filters}
            />
          ) : null}
          <LocalDevelopmentSwitcher {...localDevelopmentUserState} />
        </>
      )}
    </main>
  );
}
