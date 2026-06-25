import Link from "next/link";
import { notFound } from "next/navigation";
import { getSelectedLocalDevelopmentUser } from "../../../../../../../lib/local-dev-user";
import { ChatGptJsonHelper } from "../../../../../../components/chatgpt-json-helper";
import { getAssignmentResponseExportData } from "../../../../../../../lib/response-export";
import { FEEDBACK_HELPER_DESCRIPTION, FEEDBACK_HELPER_PROMPT, buildFullFeedbackPrompt } from "../../../../../../../lib/feedback-helper-prompt";
import { ExportCopyBlock } from "./export-copy-block";

export const dynamic = "force-dynamic";

type ResponseExportPageProps = {
  params: Promise<{
    classId: string;
    assignmentId: string;
  }>;
};

export default async function ResponseExportPage({
  params,
}: ResponseExportPageProps) {
  const { classId, assignmentId } = await params;
  const parsedClassId = Number(classId);
  const parsedAssignmentId = Number(assignmentId);

  if (
    !Number.isInteger(parsedClassId) ||
    !Number.isInteger(parsedAssignmentId)
  ) {
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
            The temporary local development user switcher controls this
            teacher-only export. Student users cannot export class-wide response
            data.
          </p>
        </section>
      </main>
    );
  }

  const jsonExport = JSON.stringify(exportData, null, 2);
  const feedbackChatGptPrompt = FEEDBACK_HELPER_PROMPT;
  const fullFeedbackPrompt = buildFullFeedbackPrompt(jsonExport);


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
        <Link
          href={`/classes/${exportData.assignment.class.id}/assignments/${exportData.assignment.id}/feedback/import`}
          className="inline-flex rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
        >
          Import feedback
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
          Use the recommended copy-ready prompt to keep the manual workflow fast:
          paste it into ChatGPT, copy the returned JSON, import it back into
          Clarion, then review draft feedback before release. The response JSON
          and Markdown exports remain available for debugging and human review.
        </p>
        <p className="mt-4 max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          Teacher approval: AI-generated feedback is saved as draft feedback in
          Clarion and should be checked by the teacher before it is released to
          students.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-2xl font-bold text-slate-950">
              {exportData.totals.questions}
            </p>
            <p className="text-sm font-medium text-slate-600">Questions</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-2xl font-bold text-slate-950">
              {exportData.totals.participants}
            </p>
            <p className="text-sm font-medium text-slate-600">Participants</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-2xl font-bold text-slate-950">
              {exportData.totals.responses}
            </p>
            <p className="text-sm font-medium text-slate-600">
              Saved/submitted responses
            </p>
          </div>
        </div>
        {exportData.totals.responses === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
            No responses have been saved or submitted yet. The export still
            includes assignment metadata, ordered questions, enrolled
            participants, and null submission entries.
          </div>
        ) : null}
        <ChatGptJsonHelper
          title="Ask ChatGPT to generate feedback JSON"
          description={FEEDBACK_HELPER_DESCRIPTION}
          prompt={feedbackChatGptPrompt}
          docsHref="/docs/feedback-json-v1.md"
          docsLabel="Open feedback JSON documentation"
        />
      </section>

      <div className="mt-8 grid gap-8">
        <ExportCopyBlock
          label="Copy feedback prompt (recommended)"
          value={fullFeedbackPrompt}
          copyLabel="Copy feedback prompt"
          description="Copies complete ChatGPT-ready instructions, schema guidance, assignment context, IDs, and student responses in one block. Paste it into ChatGPT, then import the returned JSON back into Clarion for teacher review and release."
        />
        <ExportCopyBlock
          label="Response JSON only (debugging/manual use)"
          value={jsonExport}
          copyLabel="Copy response JSON only"
          description="Use this raw export for debugging or manual workflows. For normal feedback generation, copy the full prompt above."
        />
        <ExportCopyBlock
          label="Markdown export"
          value={markdown}
          copyLabel="Copy Markdown"
          description="Human-readable companion export for review. It is not the feedback import contract."
        />
      </div>
    </main>
  );
}
