"use client";

import { useActionState, useState } from "react";
import { HomeworkAssignmentStatus, HomeworkQuestionResponseMode, HomeworkQuestionType, PseudocodeDialect } from "@prisma/client";
import { updateAssignmentDetails, type EditAssignmentFormState } from "./actions";

type EditableQuestion = {
  id: number;
  order: number;
  prompt: string;
  questionType: HomeworkQuestionType;
  responseMode: HomeworkQuestionResponseMode;
  points: number | null;
  options: unknown;
  imagePath: string | null;
  imageCaption: string | null;
  imageAltText: string | null;
};

type EditAssignmentFormProps = {
  assignment: {
    id: number;
    classId: number;
    title: string;
    description: string | null;
    status: HomeworkAssignmentStatus;
    dueAt: Date | null;
    questions: EditableQuestion[];
    hasResponses: boolean;
  };
};

const questionTypeLabels: Record<HomeworkQuestionType, string> = {
  OPEN_TEXT: "Open text",
  LONG_TEXT: "Long text",
  MULTIPLE_CHOICE: "Multiple choice",
};

function formatDateTimeLocal(date: Date | null) {
  if (!date) {
    return "";
  }

  return date.toISOString().slice(0, 16);
}

function getChoices(options: unknown) {
  if (
    typeof options === "object" &&
    options &&
    "choices" in options &&
    Array.isArray(options.choices)
  ) {
    return options.choices.filter((choice): choice is string => typeof choice === "string");
  }

  return [];
}

export function EditAssignmentForm({ assignment }: EditAssignmentFormProps) {
  const [questionTypes, setQuestionTypes] = useState<Record<number, HomeworkQuestionType>>(
    Object.fromEntries(
      assignment.questions.map((question) => [question.id, question.questionType]),
    ),
  );
  const initialFormState: EditAssignmentFormState = { error: null };
  const [formState, formAction, isPending] = useActionState(
    updateAssignmentDetails.bind(null, assignment.classId, assignment.id),
    initialFormState,
  );

  return (
    <form action={formAction} className="mt-6 grid gap-5">
      {assignment.hasResponses ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This assignment already has student responses. Existing answers and feedback will be preserved, question deletion is not available here, and question type changes are locked to avoid breaking student work.
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          This conservative editor updates existing assignment and question records. It does not delete questions or responses.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700">
          Assignment title
          <input name="title" required defaultValue={assignment.title} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200" />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Due date (optional)
          <input name="dueAt" type="datetime-local" defaultValue={formatDateTimeLocal(assignment.dueAt)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200" />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_14rem]">
        <label className="text-sm font-semibold text-slate-700">
          Description / instructions
          <textarea name="description" rows={4} defaultValue={assignment.description ?? ""} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200" />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Status
          <select name="status" defaultValue={assignment.status} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200">
            {Object.values(HomeworkAssignmentStatus).map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </label>
      </div>

      <section className="grid gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Questions</p>
          <p className="mt-1 text-sm text-slate-600">Edit prompts, points, multiple-choice options, and image references without removing existing question records.</p>
        </div>

        {assignment.questions.map((question) => {
          const selectedType = questionTypes[question.id] ?? question.questionType;

          return (
            <fieldset key={question.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <input type="hidden" name="questionId" value={question.id} />
              <legend className="text-sm font-bold text-slate-950">Question {question.order}</legend>
              <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem_12rem_10rem]">
                <label className="text-sm font-semibold text-slate-700">
                  Prompt
                  <textarea name="questionPrompt" required rows={3} defaultValue={question.prompt} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200" />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Type
                  <select name="questionType" value={selectedType} disabled={assignment.hasResponses} onChange={(event) => setQuestionTypes((current) => ({ ...current, [question.id]: event.target.value as HomeworkQuestionType }))} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm disabled:bg-slate-100 disabled:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200">
                    {Object.values(HomeworkQuestionType).map((type) => (
                      <option key={type} value={type}>{questionTypeLabels[type]}</option>
                    ))}
                  </select>
                  {assignment.hasResponses ? <input type="hidden" name="questionType" value={question.questionType} /> : null}
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Response mode
                  <select name="questionResponseMode" defaultValue={question.responseMode} disabled={selectedType === HomeworkQuestionType.MULTIPLE_CHOICE} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm disabled:bg-slate-100 disabled:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200">
                    <option value={HomeworkQuestionResponseMode.TEXT}>Text</option>
                    <option value={HomeworkQuestionResponseMode.PSEUDOCODE}>Pseudocode</option>
                  </select>
                  {selectedType === HomeworkQuestionType.MULTIPLE_CHOICE ? <input type="hidden" name="questionResponseMode" value={HomeworkQuestionResponseMode.TEXT} /> : null}
                  {question.responseMode === HomeworkQuestionResponseMode.PSEUDOCODE && selectedType !== HomeworkQuestionType.MULTIPLE_CHOICE ? (
                    <input type="hidden" name="questionPseudocodeDialect" value={PseudocodeDialect.CAMBRIDGE_9618_2026} />
                  ) : (
                    <input type="hidden" name="questionPseudocodeDialect" value="" />
                  )}
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Points (optional)
                  <input name="questionPoints" type="number" min="1" step="1" defaultValue={question.points ?? ""} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200" />
                </label>
              </div>

              {selectedType === HomeworkQuestionType.MULTIPLE_CHOICE ? (
                <label className="mt-4 block text-sm font-semibold text-slate-700">
                  Multiple choice options (one per line)
                  <textarea name="questionOptions" required rows={4} defaultValue={getChoices(question.options).join("\n")} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200" />
                </label>
              ) : (
                <input type="hidden" name="questionOptions" value="" />
              )}

              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <label className="text-sm font-semibold text-slate-700">Image path / reference<input name="questionImagePath" defaultValue={question.imagePath ?? ""} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200" /></label>
                <label className="text-sm font-semibold text-slate-700">Caption<input name="questionImageCaption" defaultValue={question.imageCaption ?? ""} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200" /></label>
                <label className="text-sm font-semibold text-slate-700">Alt text<input name="questionImageAltText" defaultValue={question.imageAltText ?? ""} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200" /></label>
              </div>
            </fieldset>
          );
        })}
      </section>

      {formState.error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800" role="alert">{formState.error}</div> : null}

      <button type="submit" disabled={isPending} className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400 sm:justify-self-start">{isPending ? "Saving…" : "Save assignment changes"}</button>
    </form>
  );
}
