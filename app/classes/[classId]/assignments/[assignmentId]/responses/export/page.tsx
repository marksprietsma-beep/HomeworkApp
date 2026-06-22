import Link from "next/link";
import { notFound } from "next/navigation";
import { getSelectedLocalDevelopmentUser } from "../../../../../../../lib/local-dev-user";
import { getAssignmentResponseExportData } from "../../../../../../../lib/response-export";

export const dynamic = "force-dynamic";

type ResponseExportPageProps = {
  params: Promise<{
    classId: string;
    assignmentId: string;
  }>;
};

function ExportBlock({ label, value }: { label: string; value: string }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
            {label}
          </p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">Copy-ready export</h2>
        </div>
        <p className="text-sm text-slate-600">Select the text below and copy it into ChatGPT.</p>
      </div>
      <textarea
        className="mt-5 h-[32rem] w-full rounded-2xl border border-slate-200 bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-50 shadow-inner outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
        readOnly
        spellCheck={false}
        value={value}
      />
    </section>
  );
}

export default async function ResponseExportPage({ params }: ResponseExportPageProps) {
  const { classId, assignmentId } = await params;
  const parsedClassId = Number(classId);
  const parsedAssignmentId = Number(assignmentId);

  if (!Number.isInteger(parsedClassId) || !Number.isInteger(parsedAssignmentId)) {
    notFound();
  }

  const { selectedUser } = await getSelectedLocalDevelopmentUser();
  const { exportData, markdown, found } = await getAssignmentResponseExportData(
    parsedClassId,
    parsedAssignmentId,
    selectedUser,
  );

  if (!found) {
    notFound();
  }

  if (!exportData || !markdown) {
    return (
      <main className="mx-auto min-h-screen max-w-4xl px-6 py-12">
        <Link
          href={`/classes/${parsedClassId}/assignments/${parsedAssignmentId}/responses`}
          className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
        >
          ← Back to response overview
        </Link>
        <section className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">
            Export unavailable
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
            Switch to the class teacher to export response data
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            The temporary local development user switcher controls this teacher-only export.
            Student users cannot export class-wide response data.
          </p>
        </section>
      </main>
    );
  }

  const jsonExport = JSON.stringify(exportData, null, 2);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <div className="flex flex-wrap gap-3">
        <Link
          href={`/classes/${exportData.assignment.class.id}/assignments/${exportData.assignment.id}/responses`}
          className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
        >
          ← Back to response overview
        </Link>
        <Link
          href={`/classes/${exportData.assignment.class.id}/assignments/${exportData.assignment.id}`}
          className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
        >
          Assignment detail
        </Link>
      </div>

      <section className="mt-8 rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
          Teacher response export
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950">
          {exportData.assignment.title}
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
          JSON is the stable primary format for ChatGPT review and future feedback import work.
          Markdown is included as a human-readable companion export.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-2xl font-bold text-slate-950">{exportData.totals.questions}</p>
            <p className="text-sm font-medium text-slate-600">Questions</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-2xl font-bold text-slate-950">{exportData.totals.participants}</p>
            <p className="text-sm font-medium text-slate-600">Participants</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-2xl font-bold text-slate-950">{exportData.totals.responses}</p>
            <p className="text-sm font-medium text-slate-600">Saved/submitted responses</p>
          </div>
        </div>
        {exportData.totals.responses === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
            No responses have been saved or submitted yet. The export still includes assignment metadata,
            ordered questions, enrolled participants, and null submission entries.
          </div>
        ) : null}
      </section>

      <div className="mt-8 grid gap-8">
        <ExportBlock label="JSON export v2" value={jsonExport} />
        <ExportBlock label="Markdown export" value={markdown} />
      </div>
    </main>
  );
}
