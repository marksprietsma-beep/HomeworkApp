"use client";

import { useState } from "react";
import { HomeworkAssignmentStatus, HomeworkQuestionType } from "@prisma/client";
import { createAssignmentForClass } from "./actions";

type AssignmentCreateFormProps = {
  classId: number;
};

type DraftQuestion = {
  id: number;
  questionType: HomeworkQuestionType;
};

const questionTypeLabels: Record<HomeworkQuestionType, string> = {
  OPEN_TEXT: "Open text",
  LONG_TEXT: "Long text",
  MULTIPLE_CHOICE: "Multiple choice",
};

export function AssignmentCreateForm({ classId }: AssignmentCreateFormProps) {
  const [questions, setQuestions] = useState<DraftQuestion[]>([
    { id: 1, questionType: HomeworkQuestionType.OPEN_TEXT },
  ]);

  const formAction = createAssignmentForClass.bind(null, classId);

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

              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <label className="text-sm font-semibold text-slate-700">
                  Image path / reference (optional)
                  <input
                    name="questionImagePath"
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                    placeholder="/images/local-diagram.png"
                  />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Caption (optional)
                  <input
                    name="questionImageCaption"
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                    placeholder="Diagram caption"
                  />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Alt text (optional)
                  <input
                    name="questionImageAltText"
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                    placeholder="Describe the image"
                  />
                </label>
              </div>
            </fieldset>
          ))}
        </div>
      </div>

      <button
        type="submit"
        className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 sm:justify-self-start"
      >
        Create assignment
      </button>
    </form>
  );
}
