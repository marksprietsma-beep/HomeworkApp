import { HomeworkAssignmentStatus } from "@prisma/client";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAssignmentDueStatus } from "../../../../../lib/assignment-due-status";
import { getHomeworkDetailData } from "../../../../../lib/homework-detail";
import { getBilingualTextParts, getLocalizedText, type LanguageMode } from "../../../../../lib/i18n-content";
import { getSelectedLocalDevelopmentUser } from "../../../../../lib/local-dev-user";
import { duplicateAssignmentForClass, updateAssignmentPublishStatus } from "./actions";
import { saveAssignmentToLibrary } from "../../../../curriculum-library/actions";

export const dynamic = "force-dynamic";

type HomeworkDetailPageProps = {
  params: Promise<{
    classId: string;
    assignmentId: string;
  }>;
  searchParams?: Promise<{
    duplicated?: string;
    statusUpdated?: string;
    lang?: string;
    statusView?: string;
    fromLibrary?: string;
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

function formatDateTime(date: Date | null) {
  if (!date) {
    return "—";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function StatusBadge({ tone, children }: { tone: "slate" | "emerald" | "amber" | "red" | "blue"; children: ReactNode }) {
  const classes = {
    slate: "bg-slate-100 text-slate-700",
    emerald: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-900",
    red: "bg-red-100 text-red-800",
    blue: "bg-blue-100 text-blue-800",
  }[tone];

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${classes}`}>{children}</span>;
}

function getMultipleChoiceChoices(options: unknown) {
  if (
    typeof options === "object" &&
    options &&
    "choices" in options &&
    Array.isArray(options.choices)
  ) {
    return options.choices.filter((choice): choice is string =>
      typeof choice === "string",
    );
  }

  return [];
}

function getPlainLocalizedText(fallback: string, i18n: unknown, mode: LanguageMode) {
  return mode === "bilingual" ? getBilingualTextParts(fallback, i18n).join(" / ") : getLocalizedText(fallback, i18n, mode);
}

function renderLocalizedText(fallback: string, i18n: unknown, mode: LanguageMode) {
  const parts = mode === "bilingual" ? getBilingualTextParts(fallback, i18n) : [getLocalizedText(fallback, i18n, mode)];
  return <span className="grid gap-1">{parts.map((part, index) => <span key={index}>{part}</span>)}</span>;
}

function renderChoiceText(fallback: string, options: unknown, optionIndex: number, mode: LanguageMode) {
  const i18n = typeof options === "object" && options && "choicesI18n" in options && Array.isArray(options.choicesI18n) ? options.choicesI18n[optionIndex] : null;
  return renderLocalizedText(fallback, i18n, mode);
}

function renderVocabularyTerm(item: { englishTerm: string; chineseTerm: string; termI18n?: unknown }, mode: LanguageMode) {
  return getPlainLocalizedText(item.englishTerm, item.termI18n ?? { en: item.englishTerm, zh: item.chineseTerm }, mode);
}

function renderVocabularyDefinition(item: { englishDefinition: string; chineseDefinition: string; definitionI18n?: unknown }, mode: LanguageMode) {
  return renderLocalizedText(item.englishDefinition, item.definitionI18n ?? { en: item.englishDefinition, zh: item.chineseDefinition }, mode);
}

function LanguageLinks({ classId, assignmentId, mode }: { classId: number; assignmentId: number; mode: LanguageMode }) {
  const items: { value: LanguageMode; label: string }[] = [
    { value: "en", label: "English" },
    { value: "zh", label: "中文" },
    { value: "bilingual", label: "Bilingual" },
  ];
  return <div className="mt-5 inline-flex rounded-full border border-slate-200 bg-slate-50 p-1 shadow-sm">{items.map((item) => <Link key={item.value} href={`/classes/${classId}/assignments/${assignmentId}?lang=${item.value}`} className={mode === item.value ? "rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white" : "rounded-full px-4 py-2 text-sm font-semibold text-slate-700 hover:text-slate-950"}>{item.label}</Link>)}</div>;
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-3xl font-bold text-slate-950">{value}</p>
      <p className="mt-1 text-sm font-medium text-slate-600">{label}</p>
    </div>
  );
}

export default async function HomeworkDetailPage({
  params,
  searchParams,
}: HomeworkDetailPageProps) {
  const { classId, assignmentId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const languageMode: LanguageMode = resolvedSearchParams.lang === "zh" || resolvedSearchParams.lang === "bilingual" ? resolvedSearchParams.lang : "en";
  const parsedClassId = Number(classId);
  const parsedAssignmentId = Number(assignmentId);

  if (!Number.isInteger(parsedClassId) || !Number.isInteger(parsedAssignmentId)) {
    notFound();
  }

  const [{ selectedUser }, homework] = await Promise.all([
    getSelectedLocalDevelopmentUser(),
    getHomeworkDetailData(
      parsedClassId,
      parsedAssignmentId,
    ),
  ]);

  if (!homework) {
    notFound();
  }

  const canManagePublishStatus =
    selectedUser?.role === "ADMIN" ||
    (selectedUser?.role === "TEACHER" && selectedUser.id === homework.class.teacher.id);
  const canEditAssignment = canManagePublishStatus;
  const canDuplicateAssignment = canManagePublishStatus;
  const canViewResponseOverview = canManagePublishStatus;
  const publishStatusAction = updateAssignmentPublishStatus.bind(
    null,
    homework.class.id,
    homework.id,
  );
  const duplicateAction = duplicateAssignmentForClass.bind(
    null,
    homework.class.id,
    homework.id,
  );
  const saveToLibraryAction = saveAssignmentToLibrary.bind(null, homework.class.id, homework.id);
  const nextStatus =
    homework.status === HomeworkAssignmentStatus.PUBLISHED
      ? HomeworkAssignmentStatus.DRAFT
      : HomeworkAssignmentStatus.PUBLISHED;
  const submissionsByStudentId = new Map(homework.submissions.map((submission) => [submission.studentId, submission]));
  const feedbackByStudentId = new Map<number, (typeof homework.participantFeedback)[number]>();
  for (const feedback of homework.participantFeedback) {
    if (feedback.studentId && !feedbackByStudentId.has(feedback.studentId)) {
      feedbackByStudentId.set(feedback.studentId, feedback);
    }
  }
  const assignmentDueStatus = getAssignmentDueStatus(homework.dueAt, null);
  const statusRows = homework.class.enrollments.map((enrollment) => {
    const submission = submissionsByStudentId.get(enrollment.student.id) ?? null;
    const feedback = feedbackByStudentId.get(enrollment.student.id) ?? null;
    const actions = feedback ? [
      ...feedback.followUpActions,
      ...feedback.questionFeedback.flatMap((question) => question.followUpActions),
    ] : [];
    const completedActions = actions.filter((action) => action.status === "COMPLETED").length;
    const dueStatus = getAssignmentDueStatus(homework.dueAt, submission);

    return {
      student: enrollment.student,
      submission,
      isSubmitted: submission?.status === "SUBMITTED",
      feedback,
      dueStatus,
      feedbackImported: Boolean(feedback),
      followUp: {
        total: actions.length,
        completed: completedActions,
        pending: actions.length - completedActions,
      },
    };
  });
  const statusCounts = {
    assigned: statusRows.length,
    submitted: statusRows.filter((row) => row.isSubmitted).length,
    missing: statusRows.filter((row) => !row.isSubmitted).length,
    late: statusRows.filter((row) => row.dueStatus.status === "late").length,
    feedbackImported: statusRows.filter((row) => row.feedbackImported).length,
    feedbackReleased: statusRows.filter((row) => row.feedback?.releaseState === "RELEASED").length,
    feedbackDraft: statusRows.filter((row) => row.feedback?.releaseState === "DRAFT").length,
    followUpPending: statusRows.filter((row) => row.followUp.pending > 0).length,
  };
  const activeStatusView = ["missing", "late", "draft", "released", "follow-up"].includes(resolvedSearchParams.statusView ?? "") ? resolvedSearchParams.statusView : "all";
  const filteredStatusRows = statusRows.filter((row) => {
    if (activeStatusView === "missing") return !row.isSubmitted;
    if (activeStatusView === "late") return row.dueStatus.status === "late";
    if (activeStatusView === "draft") return row.feedback?.releaseState === "DRAFT";
    if (activeStatusView === "released") return row.feedback?.releaseState === "RELEASED";
    if (activeStatusView === "follow-up") return row.followUp.pending > 0;
    return true;
  });
  const statusFilters = [
    { value: "all", label: "All" },
    { value: "missing", label: "Missing submission" },
    { value: "late", label: "Late submissions" },
    { value: "draft", label: "Feedback draft" },
    { value: "released", label: "Feedback released" },
    { value: "follow-up", label: "Follow-up pending" },
  ];

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <Link
        href={`/classes/${homework.class.id}`}
        className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
      >
        ← Back to class details
      </Link>

      <section className="mt-8 rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
          Homework detail
        </p>
        <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-950">
              {renderLocalizedText(homework.title, homework.titleI18n, languageMode)}
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
              {renderLocalizedText(homework.description ?? "No instructions have been added for this assignment.", homework.descriptionI18n, languageMode)}
            </p>
            <p className="mt-4 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              {homework.status}{homework.dueAt ? ` · ${assignmentDueStatus.label}: ${formatDate(homework.dueAt)}` : ""}
            </p>
            {resolvedSearchParams.duplicated === "1" ? (
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <p className="font-semibold">Draft copy created</p>
                <p className="mt-1">This assignment is a new draft copy. Questions, points, options, and image references were copied; student responses and feedback were not copied.</p>
              </div>
            ) : null}
            {resolvedSearchParams.fromLibrary === "1" ? (
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <p className="font-semibold">Assigned from curriculum library</p>
                <p className="mt-1">This is an independent class assignment copy. Future submissions and feedback attach here, not to the reusable library item.</p>
              </div>
            ) : null}
            {resolvedSearchParams.statusUpdated ? (
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <p className="font-semibold">Assignment status updated</p>
                <p className="mt-1">Current status: {homework.status}. Published assignments appear for enrolled students; drafts stay hidden.</p>
              </div>
            ) : null}
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-950">
                Status: <span className="uppercase tracking-[0.14em]">{homework.status}</span>
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Draft assignments stay visible to teachers here, but are hidden from student assigned-work views and blocked on student work pages.
              </p>
              {canManagePublishStatus ? (
                <form action={publishStatusAction} className="mt-3">
                  <input type="hidden" name="status" value={nextStatus} />
                  <button
                    type="submit"
                    className="inline-flex rounded-full bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-amber-300"
                  >
                    {nextStatus === HomeworkAssignmentStatus.PUBLISHED
                      ? "Publish assignment"
                      : "Move back to draft"}
                  </button>
                </form>
              ) : (
                <p className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                  Only admins or the teacher who owns this class can change publish status.
                </p>
              )}
            </div>
            {canViewResponseOverview ? (
              <div className="mt-5 flex flex-wrap gap-3">
                {canEditAssignment ? (
                  <Link
                    href={`/classes/${homework.class.id}/assignments/${homework.id}/edit`}
                    className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:text-slate-950"
                  >
                    Edit assignment
                  </Link>
                ) : null}
                {canDuplicateAssignment ? (
                  <form action={duplicateAction}>
                    <button
                      type="submit"
                      className="inline-flex rounded-full border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 shadow-sm transition hover:border-emerald-400 hover:bg-emerald-100"
                    >
                      Duplicate as draft
                    </button>
                  </form>
                ) : null}
                {canDuplicateAssignment ? (
                  <details className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                    <summary className="cursor-pointer text-sm font-bold text-emerald-900">Save to curriculum library</summary>
                    <form action={saveToLibraryAction} className="mt-3 grid gap-3 sm:min-w-72">
                      <label className="text-sm font-semibold text-slate-700">Library title<input name="libraryTitle" defaultValue={homework.title} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm" /></label>
                      <label className="text-sm font-semibold text-slate-700">Subject<input name="subject" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm" /></label>
                      <label className="text-sm font-semibold text-slate-700">Year group / key stage<input name="yearGroup" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm" /></label>
                      <label className="text-sm font-semibold text-slate-700">Unit / topic<input name="unitTopic" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm" /></label>
                      <label className="text-sm font-semibold text-slate-700">Tags<input name="tags" placeholder="fractions, retrieval" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm" /></label>
                      <button type="submit" className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-500">Save reusable item</button>
                    </form>
                  </details>
                ) : null}
                <Link
                  href={`/classes/${homework.class.id}/assignments/${homework.id}/responses`}
                  className="inline-flex rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                >
                  View response overview
                </Link>
                <Link
                  href={`/classes/${homework.class.id}/assignments/${homework.id}/responses/export`}
                  className="inline-flex rounded-full bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-amber-300"
                >
                  Export responses
                </Link>
                <Link
                  href={`/classes/${homework.class.id}/assignments/${homework.id}/feedback/import`}
                  className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:text-slate-950"
                >
                  Import feedback
                </Link>
              </div>
            ) : null}
          </div>
          <LanguageLinks classId={homework.class.id} assignmentId={homework.id} mode={languageMode} />
          <div className="rounded-2xl bg-slate-950 px-5 py-4 text-white shadow-sm lg:min-w-72">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
              Class
            </p>
            <p className="mt-2 text-lg font-semibold">{homework.class.name}</p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
              Teacher
            </p>
            <p className="mt-2 font-semibold">{homework.class.teacher.displayName}</p>
            <p className="text-sm text-amber-200">{homework.class.teacher.email}</p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <StatCard label="Questions" value={homework.totals.questions} />
          <StatCard label="Total points" value={homework.totals.points} />
          <StatCard label="Submissions" value={homework.totals.submissions} />
        </div>
      </section>


      {canViewResponseOverview ? (
        <section className="mt-8 rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Status overview</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">Assignment status matrix</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">One row per enrolled participant in {homework.class.name}, with submission timing, feedback release, and follow-up state for this assignment{homework.dueAt ? ` · due ${formatDate(homework.dueAt)}` : ""}.</p>
            </div>
            <Link href={`/classes/${homework.class.id}/assignments/${homework.id}/responses`} className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:text-slate-950">Response overview</Link>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-8">
            <StatCard label="Assigned" value={statusCounts.assigned} />
            <StatCard label="Submitted" value={statusCounts.submitted} />
            <StatCard label="Missing" value={statusCounts.missing} />
            <StatCard label="Late" value={statusCounts.late} />
            <StatCard label="Feedback imported" value={statusCounts.feedbackImported} />
            <StatCard label="Released" value={statusCounts.feedbackReleased} />
            <StatCard label="Draft" value={statusCounts.feedbackDraft} />
            <StatCard label="Follow-up pending" value={statusCounts.followUpPending} />
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {statusFilters.map((filter) => {
              const href = filter.value === "all" ? `/classes/${homework.class.id}/assignments/${homework.id}?lang=${languageMode}` : `/classes/${homework.class.id}/assignments/${homework.id}?lang=${languageMode}&statusView=${filter.value}`;
              return <Link key={filter.value} href={href} className={activeStatusView === filter.value ? "rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white" : "rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-950"}>{filter.label}</Link>;
            })}
          </div>

          <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Class</th>
                  <th className="px-4 py-3">Assigned</th>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3">Timing</th>
                  <th className="px-4 py-3">Submission time</th>
                  <th className="px-4 py-3">Feedback imported</th>
                  <th className="px-4 py-3">Feedback status</th>
                  <th className="px-4 py-3">Follow-up actions</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStatusRows.map((row) => (
                  <tr key={row.student.id} className="align-top">
                    <td className="px-4 py-4"><p className="font-semibold text-slate-950">{row.student.displayName}</p><p className="mt-1 text-xs text-slate-500">{row.student.email}</p></td>
                    <td className="px-4 py-4 text-slate-700">{homework.class.name}</td>
                    <td className="px-4 py-4"><StatusBadge tone="blue">Assigned</StatusBadge></td>
                    <td className="px-4 py-4">{row.isSubmitted ? <StatusBadge tone="emerald">Submitted</StatusBadge> : row.submission ? <StatusBadge tone="amber">Saved draft</StatusBadge> : row.dueStatus.status === "due" ? <StatusBadge tone="slate">Not submitted</StatusBadge> : <StatusBadge tone="red">Missing</StatusBadge>}</td>
                    <td className="px-4 py-4"><StatusBadge tone={row.dueStatus.tone}>{row.dueStatus.label}</StatusBadge>{homework.dueAt ? <p className="mt-1 text-xs text-slate-500">Due {formatDateTime(homework.dueAt)}</p> : null}</td>
                    <td className="px-4 py-4 text-slate-700">{row.submission ? formatDateTime(row.submission.submittedAt ?? row.submission.updatedAt) : "—"}</td>
                    <td className="px-4 py-4">{row.feedbackImported ? <StatusBadge tone="emerald">Imported</StatusBadge> : <StatusBadge tone="slate">None</StatusBadge>}</td>
                    <td className="px-4 py-4">{row.feedback?.releaseState === "RELEASED" ? <StatusBadge tone="emerald">Released</StatusBadge> : row.feedback?.releaseState === "DRAFT" ? <StatusBadge tone="amber">Draft</StatusBadge> : <StatusBadge tone="slate">None</StatusBadge>}</td>
                    <td className="px-4 py-4">{row.followUp.total === 0 ? <StatusBadge tone="slate">None</StatusBadge> : row.followUp.pending > 0 ? <StatusBadge tone="amber">{row.followUp.pending} pending</StatusBadge> : <StatusBadge tone="emerald">Completed</StatusBadge>}<p className="mt-1 text-xs text-slate-500">{row.followUp.total === 0 ? "No imported actions" : `${row.followUp.completed}/${row.followUp.total} completed`}</p></td>
                    <td className="px-4 py-4">{row.submission ? <Link href={`/classes/${homework.class.id}/assignments/${homework.id}/responses/${row.submission.id}`} className="inline-flex rounded-full bg-slate-950 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800">View response</Link> : <span className="text-xs font-semibold text-slate-500">No response yet</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredStatusRows.length === 0 ? <p className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">No students match this quick view.</p> : null}
        </section>
      ) : null}

      {homework.keyVocabulary.length > 0 ? (
        <section className="mt-8 rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Key vocabulary / 关键词</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {homework.keyVocabulary.map((item) => (
              <article key={`${item.englishTerm}-${item.chineseTerm}`} className="rounded-2xl border border-emerald-100 bg-white p-4 text-sm shadow-sm">
                <h3 className="text-lg font-bold text-slate-950">{renderVocabularyTerm(item, languageMode)}</h3>
                <p className="mt-3 leading-6 text-slate-700">{renderVocabularyDefinition(item, languageMode)}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
        <section className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
            Questions
          </p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">
            Ordered question list
          </h2>

          {homework.questions.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
              No questions have been added to this assignment yet.
            </div>
          ) : (
            <ol className="mt-6 grid gap-4">
              {homework.questions.map((question) => (
                <li
                  key={question.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                        Question {question.order} · {question.questionType}
                      </p>
                      <p className="mt-2 text-base leading-7 text-slate-950">
                        {renderLocalizedText(question.prompt, question.promptI18n, languageMode)}
                      </p>
                    </div>
                    <p className="rounded-xl bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
                      {question.points ? `${question.points} pts` : "No points"}
                    </p>
                  </div>
                  {question.questionType === "MULTIPLE_CHOICE" &&
                  getMultipleChoiceChoices(question.options).length > 0 ? (
                    <ul className="mt-4 grid gap-2">
                      {getMultipleChoiceChoices(question.options).map(
                        (choice, optionIndex) => (
                          <li
                            key={`${question.id}-${optionIndex}`}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                          >
                            {renderChoiceText(choice, question.options, optionIndex, languageMode)}
                          </li>
                        ),
                      )}
                    </ul>
                  ) : null}
                  {question.imagePath ? (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                      <p className="font-semibold text-slate-950">Image reference</p>
                      {question.imagePath.startsWith("/media/") ? (
                        <Image
                          src={question.imagePath}
                          alt={question.imageAltText || question.imageCaption || "Question attachment"}
                          width={320}
                          height={224}
                          className="mt-3 max-h-56 w-full rounded-xl border border-slate-200 object-contain sm:w-80"
                        />
                      ) : null}
                      <p className="mt-3 break-all font-mono text-xs">{question.imagePath}</p>
                      {question.imageCaption ? <p className="mt-2">Caption: {question.imageCaption}</p> : null}
                      {question.imageAltText ? <p className="mt-1">Alt text: {question.imageAltText}</p> : null}
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
            Submissions
          </p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">Summary</h2>

          {homework.submissions.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
              No students have started or submitted this assignment yet.
            </div>
          ) : (
            <ul className="mt-6 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
              {homework.submissions.map((submission) => (
                <li key={submission.id} className="px-4 py-4">
                  <p className="font-semibold text-slate-950">
                    {submission.student.displayName}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {submission.student.email}
                  </p>
                  <p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                    {submission.status} · {formatDate(submission.submittedAt)}
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
