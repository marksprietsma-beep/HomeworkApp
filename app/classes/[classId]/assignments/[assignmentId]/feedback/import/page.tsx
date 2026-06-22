import Link from "next/link";
import { notFound } from "next/navigation";
import { getFeedbackImportPageData } from "../../../../../../../lib/feedback-import";
import { getSelectedLocalDevelopmentUser } from "../../../../../../../lib/local-dev-user";
import { FeedbackImportForm } from "./feedback-import-form";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ classId: string; assignmentId: string }> };

export default async function FeedbackImportPage({ params }: Props) {
  const { classId, assignmentId } = await params;
  const parsedClassId = Number(classId);
  const parsedAssignmentId = Number(assignmentId);
  if (!Number.isInteger(parsedClassId) || !Number.isInteger(parsedAssignmentId)) notFound();

  const { selectedUser } = await getSelectedLocalDevelopmentUser();
  const data = await getFeedbackImportPageData(parsedClassId, parsedAssignmentId, selectedUser);
  if (!data.found || !data.assignment) notFound();

  if (!data.canImport || !data.context) {
    return (
      <main className="mx-auto min-h-screen max-w-4xl px-6 py-12">
        <Link href={`/classes/${parsedClassId}/assignments/${parsedAssignmentId}/responses`} className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950">← Back to response overview</Link>
        <section className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">Feedback import unavailable</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">Switch to the class teacher to import feedback</h1>
          <p className="mt-3 text-sm leading-6 text-slate-700">The temporary local development user switcher controls this teacher-only workflow. Student users cannot import or view feedback.</p>
        </section>
      </main>
    );
  }

  const responseCount = data.context.participants.filter((participant) => participant.submission).length;

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <div className="flex flex-wrap gap-3">
        <Link href={`/classes/${data.assignment.class.id}/assignments/${data.assignment.id}/responses`} className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950">← Back to response overview</Link>
        <Link href={`/classes/${data.assignment.class.id}/assignments/${data.assignment.id}/responses/export`} className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950">Export responses</Link>
      </div>
      <section className="mt-8 rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Teacher feedback import</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950">{data.assignment.title}</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">Paste ChatGPT-generated feedback JSON, validate it against the current response export context, preview every attachment point, and save it to teacher-only feedback tables.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-2xl font-bold text-slate-950">{data.context.questions.length}</p><p className="text-sm font-medium text-slate-600">Questions</p></div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-2xl font-bold text-slate-950">{data.context.participants.length}</p><p className="text-sm font-medium text-slate-600">Participants</p></div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-2xl font-bold text-slate-950">{responseCount}</p><p className="text-sm font-medium text-slate-600">Responses</p></div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-2xl font-bold text-slate-950">{data.existingImports.length}</p><p className="text-sm font-medium text-slate-600">Prior imports</p></div>
        </div>
        {responseCount === 0 ? <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">No responses have been saved or submitted yet. You can still validate assignment metadata, but useful feedback imports normally require response data.</div> : null}
      </section>
      <FeedbackImportForm classId={data.assignment.class.id} assignmentId={data.assignment.id} context={data.context} existingImportCount={data.existingImports.length} />
    </main>
  );
}
