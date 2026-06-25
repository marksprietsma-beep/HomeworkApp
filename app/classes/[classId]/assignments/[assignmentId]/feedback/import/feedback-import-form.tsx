"use client";

import { useActionState, useMemo, useState } from "react";
import { ChatGptJsonHelper } from "../../../../../../components/chatgpt-json-helper";
import { FEEDBACK_HELPER_DESCRIPTION, FEEDBACK_HELPER_PROMPT } from "../../../../../../../lib/feedback-helper-prompt";
import { parseFeedbackImportJson } from "../../../../../../../lib/feedback-import-parser.mjs";
import { releaseFeedbackForAssignment, saveFeedbackImport } from "./actions";

type Props = {
  classId: number;
  assignmentId: number;
  context: Record<string, unknown>;
  existingImportCount: number;
};

type PreviewAction = {
  id: string;
  type: string;
  prompt: string;
  required: boolean;
};
type PreviewQuestionFeedback = {
  questionId: number;
  questionOrder: number | null;
  feedback: string;
  strengths: string[];
  targets: string[];
  followUpActions: PreviewAction[];
};
type PreviewParticipantFeedback = {
  participant: { id: number; name?: string; email?: string | null };
  submission: { id: number; status?: string } | null;
  overallFeedback: string;
  strengths: string[];
  targets: string[];
  questionFeedback: PreviewQuestionFeedback[];
  followUpActions: PreviewAction[];
};
type PreviewFeedback = {
  feedbackFormat: string;
  feedbackVersion: number;
  sourceExport: { exportFormat: string; exportVersion: number } | null;
  assignment: { id: number | null; title?: string } | null;
  class: { id: number | null; name?: string } | null;
  generatedBy?: string;
  generatedAt?: string;
  participantFeedback: PreviewParticipantFeedback[];
};

const placeholderJson = `{
  "feedbackFormat": "homework-feedback",
  "feedbackVersion": 1,
  "sourceExport": { "exportFormat": "homework-assignment-responses-v2", "exportVersion": 2, "generatedAt": "2026-06-22T00:00:00.000Z" },
  "assignment": { "id": 1, "title": "Assignment title" },
  "class": { "id": 1, "name": "Class name" },
  "generatedBy": "ChatGPT",
  "generatedAt": "2026-06-22T00:00:00.000Z",
  "participantFeedback": []
}`;

const feedbackImportChatGptPrompt = FEEDBACK_HELPER_PROMPT;


function List({ items }: { items: string[] }) {
  return items.length ? (
    <ul className="mt-2 list-disc space-y-1 pl-5">
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ul>
  ) : (
    <p className="mt-2 text-slate-500">None provided.</p>
  );
}

export function FeedbackImportForm({
  classId,
  assignmentId,
  context,
  existingImportCount,
}: Props) {
  const [rawJson, setRawJson] = useState("");
  const [state, formAction, pending] = useActionState(
    saveFeedbackImport.bind(null, classId, assignmentId),
    { ok: false, message: "" },
  );
  const [releaseState, releaseAction, releasePending] = useActionState(
    releaseFeedbackForAssignment.bind(null, classId, assignmentId),
    { ok: false, message: "" },
  );
  const parseResult = useMemo(
    () => parseFeedbackImportJson(rawJson, context),
    [rawJson, context],
  );
  const hasInput = rawJson.trim().length > 0;
  const feedback = parseResult.ok
    ? (parseResult.feedback as PreviewFeedback)
    : null;
  const payloadSaved = Boolean(state.ok && state.submittedRawJson === rawJson);
  const importedStudents = feedback?.participantFeedback.length ?? 0;
  const questionFeedbackCount = feedback?.participantFeedback.reduce((total, entry) => total + entry.questionFeedback.length, 0) ?? 0;
  const followUpActionCount = feedback?.participantFeedback.reduce((total, entry) => total + entry.followUpActions.length + entry.questionFeedback.reduce((qTotal, question) => qTotal + question.followUpActions.length, 0), 0) ?? 0;
  const bilingualDetected = rawJson.includes("I18n");

  function startNewImport() {
    setRawJson("");
  }

  return (
    <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(22rem,0.9fr)_minmax(0,1.1fr)]">
      <section className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm sm:p-8 xl:sticky xl:top-6 xl:self-start">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
          Paste JSON
        </p>
        <h2 className="mt-2 text-2xl font-bold text-slate-950">
          ChatGPT feedback import
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Paste feedback JSON for this assignment. English-only JSON still works; optional bilingual fields such as overallFeedbackI18n, feedbackI18n, strengthsI18n, targetsI18n, and promptI18n can use only en and zh. Validation runs locally
          against the current class, questions, participants, submissions, and
          responses.
        </p>
        <ChatGptJsonHelper
          title="Ask ChatGPT for importable feedback JSON"
          description={FEEDBACK_HELPER_DESCRIPTION}
          prompt={feedbackImportChatGptPrompt}
          docsHref="/docs/feedback-json-v1.md"
          docsLabel="Open feedback JSON documentation"
        />
        <textarea
          value={rawJson}
          onChange={(event) => setRawJson(event.target.value)}
          rows={24}
          className="mt-5 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 font-mono text-sm text-slate-950 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 xl:min-h-[34rem]"
          placeholder={placeholderJson}
          aria-label="Feedback import JSON"
        />
      </section>

      <aside className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
              Validation & preview
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">
              Review before saving
            </h2>
          </div>
          {feedback ? (
            <p className="text-sm font-semibold text-emerald-700">
              Ready to save
            </p>
          ) : null}
        </div>

        {existingImportCount > 0 ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            This assignment already has {existingImportCount} feedback import
            {existingImportCount === 1 ? "" : "s"}. V1 keeps historical
            draft/released feedback. Saving another payload for the same student or submission requires one replace confirmation, and exact duplicate payloads are blocked.
          </div>
        ) : null}
        {releaseState.message ? (
          <div
            className={`mt-5 rounded-2xl border p-4 text-sm font-semibold ${releaseState.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"}`}
          >
            {releaseState.message}
          </div>
        ) : null}
        {state.message ? (
          <div
            className={`mt-5 rounded-2xl border p-4 text-sm font-semibold ${state.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"}`}
          >
            {state.message}
          </div>
        ) : null}

        {!hasInput ? (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-6 text-slate-600">
            Paste feedback JSON to see validation feedback and a complete
            preview.
          </div>
        ) : !parseResult.ok ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5">
            <h3 className="font-bold text-red-900">
              Fix these validation errors
            </h3>
            <ul className="mt-3 grid gap-2 text-sm text-red-800">
              {parseResult.errors.map((error, index) => (
                <li key={`${error.path}-${error.code}-${index}`}>
                  <span className="font-mono font-semibold">{error.path}</span>:{" "}
                  {error.message}
                </li>
              ))}
            </ul>
          </div>
        ) : feedback ? (
          <form action={formAction} className="mt-5 grid gap-5">
            <input type="hidden" name="rawJson" value={rawJson} />
            <div className="sticky top-3 z-10 rounded-2xl border border-emerald-200 bg-white/95 p-4 shadow-lg shadow-slate-200/70 backdrop-blur">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-emerald-900">
                    {payloadSaved
                      ? "Feedback saved. Import another feedback file to continue."
                      : "JSON is valid. Review the summary, then save as Draft when ready."}
                  </p>
                  {payloadSaved ? (
                    <p className="mt-1 text-xs font-medium text-emerald-800">
                      This exact pasted payload is protected from repeat saves.
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {payloadSaved ? (
                    <button
                      type="button"
                      onClick={startNewImport}
                      className="rounded-full border border-emerald-300 bg-white px-5 py-3 text-sm font-semibold text-emerald-900 shadow-sm transition hover:border-emerald-400"
                    >
                      Keep draft / new import
                    </button>
                  ) : null}
                  <button
                    type="submit"
                    disabled={pending || payloadSaved}
                    className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    {pending ? "Saving…" : payloadSaved ? "Saved as Draft" : "Save as Draft"}
                  </button>
                
                {payloadSaved && state.canRelease ? (
                  <button
                    formAction={releaseAction}
                    disabled={releasePending}
                    className="rounded-full bg-emerald-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-emerald-300"
                  >
                    {releasePending ? "Releasing…" : "Release feedback to students"}
                  </button>
                ) : null}</div>
              </div>
            </div>
            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Import summary</p>
              <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <p><strong>Assignment:</strong> {feedback.assignment?.title ?? "Untitled assignment"}</p>
                <p><strong>Class:</strong> {feedback.class?.name ?? "Unnamed"}</p>
                <p><strong>Students with feedback:</strong> {importedStudents}</p>
                <p><strong>Question feedback entries:</strong> {questionFeedbackCount}</p>
                <p><strong>Follow-up actions:</strong> {followUpActionCount}</p>
                <p><strong>Bilingual fields detected:</strong> {bilingualDetected ? "Yes" : "No"}</p>
                <p><strong>Initial state:</strong> Draft (hidden from students)</p>
                <p><strong>Warnings:</strong> {existingImportCount > 0 ? "Existing feedback may be replaced if it matches these students/submissions." : "None"}</p>
              </div>
              {existingImportCount > 0 && !payloadSaved ? (
                <label className="mt-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-950">
                  <input type="checkbox" name="confirmReplace" className="mt-1" />
                  I understand this import may replace existing draft/released feedback for matching students or submissions.
                </label>
              ) : null}
            </section>
            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Source and match
              </p>
              <h3 className="mt-2 text-xl font-bold text-slate-950">
                {feedback.assignment?.title ?? "Untitled assignment"}
              </h3>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <p>
                  <strong>Source:</strong> {feedback.sourceExport?.exportFormat}{" "}
                  v{feedback.sourceExport?.exportVersion}
                </p>
                <p>
                  <strong>Feedback:</strong> {feedback.feedbackFormat} v
                  {feedback.feedbackVersion}
                </p>
                <p>
                  <strong>Assignment ID:</strong> {feedback.assignment?.id}
                </p>
                <p>
                  <strong>Class:</strong> {feedback.class?.name ?? "Unnamed"} (
                  {feedback.class?.id})
                </p>
                <p>
                  <strong>Generated by:</strong>{" "}
                  {feedback.generatedBy ?? "Not provided"}
                </p>
                <p>
                  <strong>Generated at:</strong>{" "}
                  {feedback.generatedAt ?? "Not provided"}
                </p>
              </div>
            </section>
            <section className="grid gap-4">
              {feedback.participantFeedback.map((entry) => (
                <article
                  key={entry.participant.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                    Participant feedback
                  </p>
                  <h3 className="mt-2 text-xl font-bold text-slate-950">
                    {entry.participant.name ??
                      `Participant ${entry.participant.id}`}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {entry.participant.email ?? "No email"} · Submission{" "}
                    {entry.submission?.id ?? "none"}
                  </p>
                  <p className="mt-4 text-sm leading-6 text-slate-800">
                    <strong>Overall:</strong> {entry.overallFeedback}
                  </p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="font-semibold text-slate-950">Strengths</p>
                      <List items={entry.strengths} />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-950">Targets</p>
                      <List items={entry.targets} />
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="font-semibold text-slate-950">
                      Required follow-up actions
                    </p>
                    <List
                      items={entry.followUpActions.map(
                        (action) => `${action.type}: ${action.prompt}`,
                      )}
                    />
                  </div>
                  <div className="mt-5 grid gap-3">
                    {entry.questionFeedback.map((question) => (
                      <div
                        key={question.questionId}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                          Question{" "}
                          {question.questionOrder ?? question.questionId}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-800">
                          {question.feedback}
                        </p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="text-sm font-semibold">Strengths</p>
                            <List items={question.strengths} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold">Targets</p>
                            <List items={question.targets} />
                          </div>
                        </div>
                        <div className="mt-3 text-sm">
                          <p className="font-semibold">
                            Question follow-up actions
                          </p>
                          <List
                            items={question.followUpActions.map(
                              (action) => `${action.type}: ${action.prompt}`,
                            )}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </section>
          </form>
        ) : null}
      </aside>
    </div>
  );
}
