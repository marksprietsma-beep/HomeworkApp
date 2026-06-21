/* eslint-disable @next/next/no-img-element */
"use client";

import { useActionState, useState } from "react";
import { HomeworkAssignmentStatus, HomeworkQuestionType } from "@prisma/client";
import { createAssignmentForClass, type CreateAssignmentFormState } from "./actions";

type AssignmentCreateFormProps = {
  classId: number;
};

type DraftQuestion = {
  id: number;
  questionType: HomeworkQuestionType;
  imagePreviewUrl?: string;
};

const localMediaMaxBytes = 5 * 1024 * 1024;

const questionTypeLabels: Record<HomeworkQuestionType, string> = {
  OPEN_TEXT: "Open text",
  LONG_TEXT: "Long text",
  MULTIPLE_CHOICE: "Multiple choice",
};

export function AssignmentCreateForm({ classId }: AssignmentCreateFormProps) {
  const [questions, setQuestions] = useState<DraftQuestion[]>([
    { id: 1, questionType: HomeworkQuestionType.OPEN_TEXT },
  ]);
  const [clientError, setClientError] = useState<string | null>(null);

  const initialFormState: CreateAssignmentFormState = { error: null };
  const [formState, formAction, isPending] = useActionState(
    createAssignmentForClass.bind(null, classId),
    initialFormState,
  );

  function addQuestion() {
    setQuestions((currentQuestions) => [
      ...currentQuestions,
      { id: Date.now(), questionType: HomeworkQuestionType.OPEN_TEXT },
    ]);
  }

  function removeQuestion(id: number) {
    setQuestions((currentQuestions) =>
      currentQuestions.length === 1
        ? currentQuestions
        : currentQuestions.filter((question) => question.id !== id),
    );
  }

  function updateImagePreview(id: number, file: File | null) {
    setClientError(null);

    setQuestions((currentQuestions) =>
      currentQuestions.map((question) =>
        question.id === id
          ? { ...question, imagePreviewUrl: file ? URL.createObjectURL(file) : undefined }
          : question,
      ),
    );
  }

  function updateQuestionType(id: number, questionType: HomeworkQuestionType) {
    setQuestions((currentQuestions) =>
      currentQuestions.map((question) =>
        question.id === id ? { ...question, questionType } : question,
      ),
    );
  }

  return (
    <form action={formAction} className="mt-6 grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700">
          Assignment title
          <input
            name="title"
            required
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
            placeholder="e.g. Ratio practice"
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Due date (optional)
          <input
            name="dueAt"
            type="datetime-local"
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_14rem]">
        <label className="text-sm font-semibold text-slate-700">
          Description / instructions
          <textarea
            name="description"
            rows={4}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
            placeholder="What should students do?"
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Status
          <select
            name="status"
            defaultValue={HomeworkAssignmentStatus.DRAFT}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
          >
            {Object.values(HomeworkAssignmentStatus).map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
              Questions
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Add prompts in the order students should see them.
            </p>
          </div>
          <button
            type="button"
            onClick={addQuestion}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:text-slate-950"
          >
            Add question
          </button>
        </div>

        <div className="mt-4 grid gap-4">
          {questions.map((question, index) => (
            <fieldset
              key={question.id}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <legend className="text-sm font-bold text-slate-950">
                  Question {index + 1}
                </legend>
                <button
                  type="button"
                  onClick={() => removeQuestion(question.id)}
                  disabled={questions.length === 1}
                  className="text-left text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:text-slate-400"
                >
                  Remove
                </button>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_14rem_10rem]">
                <label className="text-sm font-semibold text-slate-700">
                  Prompt
                  <textarea
                    name="questionPrompt"
                    required
                    rows={3}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                    placeholder="Write the question prompt"
                  />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Type
                  <select
                    name="questionType"
                    value={question.questionType}
                    onChange={(event) =>
                      updateQuestionType(
                        question.id,
                        event.target.value as HomeworkQuestionType,
                      )
                    }
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                  >
                    {Object.values(HomeworkQuestionType).map((type) => (
                      <option key={type} value={type}>
                        {questionTypeLabels[type]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Points (optional)
                  <input
                    name="questionPoints"
                    type="number"
                    min="1"
                    step="1"
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                    placeholder="e.g. 2"
                  />
                </label>
              </div>

              {question.questionType === HomeworkQuestionType.MULTIPLE_CHOICE ? (
                <label className="mt-4 block text-sm font-semibold text-slate-700">
                  Multiple choice options (one per line)
                  <textarea
                    name="questionOptions"
                    required
                    rows={4}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                    placeholder={"Option A\nOption B\nOption C"}
                  />
                </label>
              ) : (
                <input type="hidden" name="questionOptions" value="" />
              )}

              <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                  <label className="block flex-1 text-sm font-semibold text-slate-700">
                    Attach image (optional)
                    <input
                      name="questionImageFile"
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;

                        if (file && file.size > localMediaMaxBytes) {
                          event.target.value = "";
                          updateImagePreview(question.id, null);
                          setClientError("Image file must be 5 MB or smaller.");
                          return;
                        }

                        updateImagePreview(question.id, file);
                      }}
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm file:mr-3 file:rounded-full file:border-0 file:bg-slate-950 file:px-3 file:py-1 file:text-sm file:font-semibold file:text-white focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                    />
                    <span className="mt-2 block text-xs font-normal text-slate-500">PNG, JPEG, WEBP, or GIF up to 5 MB. Files are stored locally.</span>
                  </label>
                  {question.imagePreviewUrl ? (
                    <img src={question.imagePreviewUrl} alt="Selected question attachment preview" className="h-24 w-32 rounded-xl border border-slate-200 object-cover" />
                  ) : null}
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <label className="text-sm font-semibold text-slate-700">
                    Existing image path / reference
                    <input name="questionImagePath" className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200" placeholder="/media/assignment-question-images/..." />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Caption (optional)
                    <input name="questionImageCaption" className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200" placeholder="Diagram caption" />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Alt text (optional)
                    <input name="questionImageAltText" className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200" placeholder="Describe the image" />
                  </label>
                </div>
              </div>
            </fieldset>
          ))}
        </div>
      </div>

      {clientError || formState.error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800" role="alert">
          {clientError || formState.error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400 sm:justify-self-start"
      >
        {isPending ? "Creating…" : "Create assignment"}
      </button>
    </form>
  );
}
