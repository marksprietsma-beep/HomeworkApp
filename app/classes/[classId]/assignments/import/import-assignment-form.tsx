/* eslint-disable @next/next/no-img-element */
"use client";

import { useActionState, useMemo, useState } from "react";
import { parseAssignmentImportJson } from "../../../../../lib/assignment-import-parser.mjs";
import { ChatGptJsonHelper } from "../../../../components/chatgpt-json-helper";
import { importAssignmentForClass, type ImportAssignmentActionState } from "./actions";

type ImportAssignmentFormProps = {
  classId: number;
};

type AssignmentImportGlossaryItem = {
  englishTerm: string;
  chineseTerm: string;
  englishDefinition: string;
  chineseDefinition: string;
  category: string | null;
  questionIds: string[];
};

type AssignmentImportQuestion = {
  id: string;
  order: number;
  type: "OPEN_TEXT" | "MULTIPLE_CHOICE";
  prompt: string;
  points: number | null;
  options: { id: string; text: string }[];
  image: { path: string; caption: string; altText: string } | null;
};

type AssignmentImportAssignment = {
  title: string;
  instructions: string;
  dueDate: string | null;
  status: "DRAFT" | "PUBLISHED";
  questions: AssignmentImportQuestion[];
  keyVocabulary: AssignmentImportGlossaryItem[];
};

const placeholderJson = `{
  "formatVersion": "assignment-import-v1",
  "assignment": {
    "title": "Fractions check",
    "instructions": "Answer each question. Show your working where helpful.",
    "dueDate": "2026-06-30",
    "status": "DRAFT",
    "keyVocabulary": [
      {
        "englishTerm": "equivalent fraction",
        "chineseTerm": "等值分数",
        "englishDefinition": "Fractions that name the same amount.",
        "chineseDefinition": "表示相同数量的分数。",
        "category": "Maths",
        "questionIds": ["q1", "q2"]
      }
    ],
    "questions": [
      {
        "id": "q1",
        "order": 1,
        "type": "OPEN_TEXT",
        "prompt": "Explain why 1/2 is the same as 2/4.",
        "points": 2,
        "image": {
          "path": "local-reference/fraction-bars.png",
          "caption": "Fraction bars",
          "altText": "A diagram comparing one half and two quarters"
        }
      },
      {
        "id": "q2",
        "order": 2,
        "type": "MULTIPLE_CHOICE",
        "prompt": "Which fraction is equivalent to 3/6?",
        "points": 1,
        "options": [
          { "id": "a", "text": "1/2" },
          { "id": "b", "text": "1/3" },
          { "id": "c", "text": "2/3" }
        ]
      }
    ]
  }
}`;

const assignmentChatGptPrompt = `Create an assignment for Homework App. Return only valid JSON. Do not wrap the answer in Markdown or add commentary.

Teacher choices to use:
- Subject: [fill in subject]
- Topic: [fill in topic]
- Syllabus context or learning objectives: [fill in syllabus/learning objectives]
- Student level/year group: [fill in year group or level]
- Number of questions: [fill in count]
- Desired question mix: [for example, short written answer, longer written answer, multiple choice]
- Difficulty: [fill in difficulty]
- Marks/points expectations: [fill in total marks or per-question guidance]
- Bilingual key vocabulary/glossary wanted? [yes/no; if yes, include English and Chinese terms/definitions]

Use the Homework App assignment import JSON v1 structure:
- Root object with formatVersion set to "assignment-import-v1" and an assignment object.
- Assignment fields: title, instructions, optional dueDate as YYYY-MM-DD or null, status as DRAFT or PUBLISHED, questions, and optional keyVocabulary.
- Questions must have stable string ids such as q1, sequential order values, type values of OPEN_TEXT or MULTIPLE_CHOICE, student-facing prompt text, and optional positive integer points/marks.
- Use OPEN_TEXT for any written answer, including longer explanation or evaluation questions.
- MULTIPLE_CHOICE questions must include options with stable ids and text. Do not add options to OPEN_TEXT questions.
- Optional image metadata may be included as image with path, caption, and altText. Use metadata only; do not include binary image data.
- Optional keyVocabulary/glossary entries may include englishTerm, chineseTerm, englishDefinition, chineseDefinition, category, and questionIds.

Do not include answers, rubrics, scores, explanations outside the JSON, or unsupported fields. Make the content appropriate for the teacher choices above.`;

const questionTypeLabels: Record<AssignmentImportQuestion["type"], string> = {
  OPEN_TEXT: "Open text",
  MULTIPLE_CHOICE: "Multiple choice",
};

function formatPoints(points: number | null) {
  return points ? `${points} pt${points === 1 ? "" : "s"}` : "No points";
}

export function ImportAssignmentForm({ classId }: ImportAssignmentFormProps) {
  const [rawJson, setRawJson] = useState("");
  const [imagePreviewUrls, setImagePreviewUrls] = useState<
    Record<string, string>
  >({});
  const parseResult = useMemo(
    () => parseAssignmentImportJson(rawJson),
    [rawJson],
  );
  const [actionState, formAction, isPending] = useActionState<
    ImportAssignmentActionState,
    FormData
  >(importAssignmentForClass.bind(null, classId), null);
  const hasInput = rawJson.trim().length > 0;
  const assignment = (
    parseResult.ok ? parseResult.assignment : null
  ) as AssignmentImportAssignment | null;
  const totalPoints =
    assignment?.questions.reduce(
      (total, question) => total + (question.points ?? 0),
      0,
    ) ?? 0;

  function updateImagePreview(questionId: string, file: File | null) {
    setImagePreviewUrls((current) => ({
      ...current,
      [questionId]: file ? URL.createObjectURL(file) : "",
    }));
  }

  return (
    <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(22rem,0.9fr)_minmax(0,1.1fr)]">
      <section className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm sm:p-8 xl:sticky xl:top-6 xl:self-start">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
          Paste JSON
        </p>
        <h2 className="mt-2 text-2xl font-bold text-slate-950">
          ChatGPT assignment import
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Paste structured assignment JSON. The parser validates locally before
          the save action creates the assignment and ordered question records.
        </p>
        <ChatGptJsonHelper
          title="Ask ChatGPT for assignment JSON"
          description="Generic prompt for any subject. Fill in your topic, year group, question mix, difficulty, marks, and vocabulary needs."
          prompt={assignmentChatGptPrompt}
          docsHref="/docs/assignment-import-json-v1.md"
          docsLabel="Open assignment JSON documentation"
        />
        <textarea
          value={rawJson}
          onChange={(event) => setRawJson(event.target.value)}
          rows={24}
          className="mt-5 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 font-mono text-sm text-slate-950 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 xl:min-h-[34rem]"
          placeholder={placeholderJson}
          aria-label="Assignment import JSON"
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
          {assignment ? (
            <p className="text-sm font-semibold text-emerald-700">
              Ready to create
            </p>
          ) : null}
        </div>
        {!hasInput ? (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-6 text-slate-600">
            Paste JSON to see validation feedback and a save preview.
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
        ) : assignment ? (
          <form action={formAction} className="mt-5 grid gap-5">
            {actionState ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-800" role="alert">
                {actionState.message}
              </div>
            ) : null}
            <input type="hidden" name="rawJson" value={rawJson} />
            <div className="sticky top-3 z-10 rounded-2xl border border-emerald-200 bg-white/95 p-4 shadow-lg shadow-slate-200/70 backdrop-blur">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-emerald-900">
                  JSON is valid. Review the full preview, then save when ready.
                </p>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {isPending ? "Creating…" : "Confirm and create"}
                </button>
              </div>
            </div>

            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                    Assignment summary
                  </p>
                  <h3 className="mt-2 text-xl font-bold text-slate-950">
                    {assignment.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {assignment.instructions}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 lg:min-w-80 lg:grid-cols-2">
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Status
                    </p>
                    <p className="mt-1 font-bold text-slate-950">
                      {assignment.status}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Due
                    </p>
                    <p className="mt-1 font-bold text-slate-950">
                      {assignment.dueDate ?? "No due date"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Questions
                    </p>
                    <p className="mt-1 font-bold text-slate-950">
                      {assignment.questions.length}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Points
                    </p>
                    <p className="mt-1 font-bold text-slate-950">
                      {totalPoints || "Not set"}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {assignment.keyVocabulary.length > 0 ? (
              <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
                  Key vocabulary / 关键词
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {assignment.keyVocabulary.map((item) => (
                    <article
                      key={`${item.englishTerm}-${item.chineseTerm}`}
                      className="rounded-xl border border-emerald-100 bg-white p-4 text-sm shadow-sm"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-bold text-slate-950">
                          {item.englishTerm} / {item.chineseTerm}
                        </h4>
                        {item.category ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-900">
                            {item.category}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 leading-6 text-slate-700">
                        {item.englishDefinition}
                      </p>
                      <p className="mt-1 leading-6 text-slate-700">
                        {item.chineseDefinition}
                      </p>
                      {item.questionIds.length > 0 ? (
                        <p className="mt-2 text-xs font-semibold text-slate-500">
                          Linked questions: {item.questionIds.join(", ")}
                        </p>
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            <ol className="grid gap-3">
              {assignment.questions.map(
                (question: AssignmentImportQuestion) => (
                  <li
                    key={question.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-bold text-white">
                          {question.order}
                        </span>
                        <div>
                          <p className="text-sm font-bold text-slate-950">
                            Question {question.order}
                          </p>
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            {questionTypeLabels[question.type]}
                          </p>
                        </div>
                      </div>
                      <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
                        {formatPoints(question.points)}
                      </span>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-slate-950">
                      {question.prompt}
                    </p>
                    {question.options.length > 0 ? (
                      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                        {question.options.map((option) => (
                          <li
                            key={option.id}
                            className="flex gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                          >
                            <span className="font-bold uppercase text-slate-950">
                              {option.id}.
                            </span>
                            <span>{option.text}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {question.image ? (
                      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="font-semibold text-slate-950">
                              Image reference
                            </p>
                            <p className="mt-1 break-all font-mono text-xs text-slate-800">
                              {question.image.path}
                            </p>
                          </div>
                          {imagePreviewUrls[question.id] ? (
                            <img
                              src={imagePreviewUrls[question.id]}
                              alt="Selected import attachment preview"
                              className="h-20 w-28 rounded-xl border border-slate-200 object-cover"
                            />
                          ) : null}
                        </div>
                        <label className="mt-3 block text-sm font-semibold text-slate-700">
                          Attach image
                          <input
                            name="questionImageFile"
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/gif"
                            onChange={(event) =>
                              updateImagePreview(
                                question.id,
                                event.target.files?.[0] ?? null,
                              )
                            }
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm file:mr-3 file:rounded-full file:border-0 file:bg-slate-950 file:px-3 file:py-1 file:text-sm file:font-semibold file:text-white focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                          />
                          <span className="mt-2 block text-xs font-normal text-slate-500">
                            PNG, JPEG, WEBP, or GIF up to 5 MB. The saved
                            question will use the new local /media path.
                          </span>
                        </label>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <label className="text-sm font-semibold text-slate-700">
                            Caption
                            <input
                              name="questionImageCaption"
                              defaultValue={question.image.caption}
                              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                            />
                          </label>
                          <label className="text-sm font-semibold text-slate-700">
                            Alt text
                            <input
                              name="questionImageAltText"
                              defaultValue={question.image.altText}
                              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                            />
                          </label>
                        </div>
                      </div>
                    ) : (
                      <>
                        <input
                          type="hidden"
                          name="questionImageFile"
                          value=""
                        />
                        <input
                          type="hidden"
                          name="questionImageCaption"
                          value=""
                        />
                        <input
                          type="hidden"
                          name="questionImageAltText"
                          value=""
                        />
                      </>
                    )}
                  </li>
                ),
              )}
            </ol>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
              <button
                type="submit"
                disabled={isPending}
                className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {isPending ? "Creating…" : "Confirm and create homework"}
              </button>
            </div>
          </form>
        ) : null}
      </aside>
    </div>
  );
}
