import Link from "next/link";
import { notFound } from "next/navigation";
import { getSelectedLocalDevelopmentUser } from "../../../../../../lib/local-dev-user";
import { getFeedbackImportPageData } from "../../../../../../lib/feedback-import";
import { buildFullFeedbackPrompt } from "../../../../../../lib/feedback-helper-prompt";
import { assignmentResponseExportHasBilingualContent, getAssignmentResponseExportData } from "../../../../../../lib/response-export";
import { getResponseOverviewData } from "../../../../../../lib/response-overview";
import { releaseFeedbackForAssignment } from "../feedback/import/actions";
import { ResponseFeedbackWorkflow } from "./response-feedback-workflow";

export const dynamic = "force-dynamic";

type ResponseOverviewPageProps = {
  params: Promise<{
    classId: string;
    assignmentId: string;
  }>;
};

function formatDateTime(date: Date | null) {
  if (!date) {
    return "Not available";
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

export default async function ResponseOverviewPage({
  params,
}: ResponseOverviewPageProps) {
  const { classId, assignmentId } = await params;
  const parsedClassId = Number(classId);
  const parsedAssignmentId = Number(assignmentId);

  if (!Number.isInteger(parsedClassId) || !Number.isInteger(parsedAssignmentId)) {
    notFound();
  }

  const { selectedUser } = await getSelectedLocalDevelopmentUser();
  const [{ overview, found }, exportResult, importData] = await Promise.all([
    getResponseOverviewData(parsedClassId, parsedAssignmentId, selectedUser),
    getAssignmentResponseExportData(parsedClassId, parsedAssignmentId, selectedUser),
    getFeedbackImportPageData(parsedClassId, parsedAssignmentId, selectedUser),
  ]);

  if (!found) {
    notFound();
  }

  if (!overview) {
    return (
      <main className="mx-auto min-h-screen max-w-4xl px-6 py-12">
        <Link
          href={`/classes/${parsedClassId}/assignments/${parsedAssignmentId}`}
          className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
        >
          ← Back to homework detail
        </Link>
        <section className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">
            Teacher overview unavailable
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
            Switch to the class teacher to view responses
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            This read-only dashboard uses the temporary local development user
            switcher. Student users cannot view class-wide response status.
          </p>
        </section>
      </main>
    );
  }

  const feedbackPrompts = exportResult.exportData
    ? {
        english: buildFullFeedbackPrompt(JSON.stringify(exportResult.exportData, null, 2), "english"),
        bilingual: buildFullFeedbackPrompt(JSON.stringify(exportResult.exportData, null, 2), "bilingual"),
        defaultMode: assignmentResponseExportHasBilingualContent(exportResult.exportData) ? "bilingual" as const : "english" as const,
      }
    : null;

  const overviewClassId = overview.class.id;
  const overviewAssignmentId = overview.id;

  async function releaseDraftFeedback() {
    "use server";
    await releaseFeedbackForAssignment(overviewClassId, overviewAssignmentId);
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <Link
        href={`/classes/${overview.class.id}/assignments/${overview.id}`}
        className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
      >
        ← Back to homework detail
      </Link>

      <section className="mt-8 rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
              Teacher response overview
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950">
              {overview.title}
            </h1>
            <p className="mt-4 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              {overview.class.name} · {overview.status} · Due: {formatDateTime(overview.dueAt)}
            </p>
          </div>
          <div className="flex flex-col gap-3 lg:min-w-72">
            <Link
              href={`/classes/${overview.class.id}/assignments/${overview.id}/responses/export`}
              className="rounded-full bg-amber-400 px-4 py-2 text-center text-sm font-bold text-slate-950 shadow-sm transition hover:bg-amber-300"
            >
              Export responses
            </Link>
            <Link
              href={`/classes/${overview.class.id}/assignments/${overview.id}/feedback/import`}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-center text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:text-slate-950"
            >
              Import feedback
            </Link>
            <div className="rounded-2xl bg-slate-950 px-5 py-4 text-white shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
              Teacher
            </p>
            <p className="mt-2 text-lg font-semibold">{overview.class.teacher.displayName}</p>
            <p className="text-sm text-amber-200">{overview.class.teacher.email}</p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
              Assignment total
            </p>
            <p className="mt-2 font-semibold">
              {overview.totals.questions} questions · {overview.totals.points ?? "No"} points
            </p>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Enrolled participants" value={overview.totals.enrolledParticipants} />
          <StatCard label="Responded" value={overview.totals.responded} />
          <StatCard label="Not responded" value={overview.totals.notResponded} />
          <StatCard label="Feedback draft" value={overview.totals.feedbackDraft} />
          <StatCard label="Feedback released" value={overview.totals.feedbackReleased} />
        </div>
      </section>

      {feedbackPrompts && importData.canImport && importData.context ? (
        <ResponseFeedbackWorkflow
          classId={overview.class.id}
          assignmentId={overview.id}
          feedbackPrompts={feedbackPrompts}
          importContext={importData.context}
          existingImportCount={importData.existingImports.length}
        />
      ) : null}

      {overview.feedbackReview.length > 0 ? (
        <section className="mt-8 rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Feedback review</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">Review draft feedback before release</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Draft feedback is visible here for teachers, remains hidden from students, and can be released in bulk when review is complete.</p>
            </div>
            <form action={releaseDraftFeedback}>
              <button type="submit" className="rounded-full bg-emerald-700 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800">Release feedback to students</button>
            </form>
          </div>
          <ul className="mt-6 grid gap-4">
            {overview.feedbackReview.map((feedback) => (
              <li key={feedback.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-slate-950">{feedback.studentName}</p>
                    <p className="mt-1 text-sm text-slate-600">{feedback.studentEmail ?? "No email"}</p>
                  </div>
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${feedback.releaseState === "RELEASED" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>{feedback.releaseState === "RELEASED" ? "Released" : "Draft"}</span>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-800">{feedback.overallFeedback}</p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{feedback.questionFeedbackCount} question feedback entries · {feedback.followUpActionCount} follow-up actions</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-8 rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
          Participants
        </p>
        <h2 className="mt-2 text-2xl font-bold text-slate-950">Response status</h2>

        {overview.totals.enrolledParticipants === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
            No participants are enrolled in this class yet, so there are no responses to review.
          </div>
        ) : overview.totals.responded === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
            No responses have been saved or submitted for this assignment yet.
          </div>
        ) : null}

        {overview.totals.enrolledParticipants > 0 ? (
          <ul className="mt-6 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
            {overview.participants.map((participant) => (
              <li
                key={participant.id}
                className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold text-slate-950">{participant.displayName}</p>
                  <p className="mt-1 text-sm text-slate-600">{participant.email}</p>
                  <p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                    {participant.response ? participant.response.status : "NO RESPONSE"} · {participant.response ? formatDateTime(participant.response.submittedAt ?? participant.response.updatedAt) : "No saved time"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <p className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${participant.feedbackActions.total === 0 ? "bg-slate-100 text-slate-600" : participant.feedbackActions.pending === 0 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
                      Feedback actions: {participant.feedbackActions.total === 0 ? "none imported" : `${participant.feedbackActions.completed}/${participant.feedbackActions.total} completed (${participant.feedbackActions.pending} pending)`}
                    </p>
                    {"feedbackReleaseState" in participant && participant.feedbackReleaseState ? (
                      <p className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${participant.feedbackReleaseState === "RELEASED" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
                        Feedback: {participant.feedbackReleaseState === "RELEASED" ? "Released" : "Draft"}
                      </p>
                    ) : null}
                  </div>
                </div>
                {participant.response ? (
                  <Link
                    href={`/classes/${overview.class.id}/assignments/${overview.id}/responses/${participant.response.id}`}
                    className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                  >
                    View response
                  </Link>
                ) : (
                  <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-500">
                    Not started
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </main>
  );
}
