/* eslint-disable @next/next/no-img-element */
"use client";

import { useActionState, useMemo, useState } from "react";
import { parseAssignmentImportJson } from "../../../../../lib/assignment-import-parser.mjs";
import {
  ASSIGNMENT_JSON_OUTPUT_INSTRUCTIONS,
  ASSIGNMENT_PSEUDOCODE_PROMPT_GUIDANCE,
} from "../../../../../lib/assignment-pseudocode-prompt-guidance";
import { StructuredResponseRenderer } from "../../../../components/structured-response-renderer";
import { QuestionPrompt } from "../../../../components/question-prompt";
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
  responseMode?: "TEXT" | "PSEUDOCODE" | "STRUCTURED";
  pseudocodeDialect?: "CAMBRIDGE_9618_2026" | null;
  prompt: string;
  points: number | null;
  options: { id: string; text: string }[];
  image: { path: string; caption: string; altText: string } | null;
  responseSchema?: unknown;
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

const assignmentChatGptPrompt = String.raw`Create a Clarion assignment from the teacher context below. Return only one complete, strict JSON object with no outer Markdown fence or commentary.

Teacher context:
- Subject: [fill in]
- Topic and learning objectives/syllabus: [fill in]
- Student level/year group: [fill in]
- Number and mix of questions: [fill in]
- Difficulty and marks/points expectations: [fill in]
- Bilingual en/zh output? [yes/no]

Contract:
- Use "assignment-import-v1" for TEXT, PSEUDOCODE, and MULTIPLE_CHOICE work. Use "assignment-import-v2" only if at least one OPEN_TEXT question has responseMode "STRUCTURED" and a responseSchema.
- The root contains formatVersion and assignment. assignment contains title, concise student-facing instructions, "status":"DRAFT", ordered questions, optional "dueDate":null or a YYYY-MM-DD string, and optional keyVocabulary. Never copy teacher planning context into instructions.
- Give questions stable ids (q1, q2...), sequential order, type OPEN_TEXT or MULTIPLE_CHOICE, prompt, optional positive integer points, and optional textI18n. MULTIPLE_CHOICE requires stable-id options and no other question type may have options.
- For bilingual work, retain required English fields and add only en/zh titleI18n, instructionsI18n, question/option textI18n, and glossary termI18n/definitionI18n. Use natural Simplified Chinese. English-only output remains valid.
- OPEN_TEXT defaults to responseMode "TEXT". Use "PSEUDOCODE" with pseudocodeDialect "CAMBRIDGE_9618_2026" only when the student must write or rewrite code. A prompt may show pseudocode while expecting TEXT prose, a result/output, an explanation, or error identification.
- Cambridge pseudocode uses preserved indentation, uppercase keywords, mixed-case identifiers beginning with a letter, // comments, the ← assignment arrow, and standard Cambridge structures such as DECLARE, CONSTANT, ARRAY, TYPE, IF/ENDIF, CASE/ENDCASE, loops, procedures/functions, file handling, and OOP keywords where relevant.
${ASSIGNMENT_PSEUDOCODE_PROMPT_GUIDANCE}
- STRUCTURED questions use v2, type OPEN_TEXT, responseMode "STRUCTURED", and responseSchema schemaVersion 1. A table has columns and rows with cells keyed by column id; a t_account has title and debit/credit entries. IDs must be stable, unique, semantic identifiers beginning with a letter. Cells/entry fields may be editable text, number, or currency values, static values, or blanks. Rows may be normal, section_header, subtotal, total, or spacer. Do not emit HTML, CSS, JavaScript, formulas, or coordinate-only IDs.
- Optional image metadata contains path, caption, and altText only. Optional vocabulary may contain English/Chinese terms and definitions, i18n text, category, and questionIds.
- Do not include answers, rubrics, scores, unsupported fields, or teacher-only notes.

Serialize the complete object as JSON. Escape quotes that occur inside string content as \", literal backslashes as \\, and line breaks as \n. Do not escape underscores, colons, angle brackets, or ordinary punctuation. Validate the exact final text with JSON.parse before returning it.

${ASSIGNMENT_JSON_OUTPUT_INSTRUCTIONS}`;


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
  const jsonParseError = parseResult.ok
    ? null
    : parseResult.errors.find((item) => item.code === "invalid_json") ?? null;
  const correctionPrompt = jsonParseError
    ? `Repair the malformed Clarion assignment JSON below.\n\nParser error:\n${jsonParseError.message}\n\nReturn the complete assignment object as strict serialized JSON. Preserve its intended content and schema values, but correct every JSON syntax error. Escape quotation marks inside string values. Do not return Markdown fences, commentary, or a partial fragment. Validate the exact response with JSON.parse before returning it.\n\nMalformed JSON:\n${rawJson}`
    : "";

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
          variant="direct-copy"
          eyebrow="ChatGPT assignment helper"
          title="Create an assignment with ChatGPT"
          description="Copy the Clarion prompt, paste it into ChatGPT, replace the bracketed teacher choices, then paste the returned JSON into Clarion."
          prompt={assignmentChatGptPrompt}
          copyLabel="Copy Clarion prompt"
          successMessage="Assignment prompt copied."
          failureMessage="Could not copy the assignment prompt. Use View/edit prompt to copy it manually."
          manualCopyLabel="View/edit prompt"
          docsHref="/docs/assignment-import-json-v2.md"
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
              {parseResult.errors.map((error, index) => {
                const [friendly, technical] = error.message.split(" Technical details: ");
                return (
                  <li key={`${error.path}-${error.code}-${index}`}>
                    <span className="font-mono font-semibold">{error.path}</span>: {friendly}
                    {technical ? (
                      <details className="mt-2 text-xs">
                        <summary className="cursor-pointer font-semibold">Technical details</summary>
                        <code className="mt-1 block break-words">{technical}</code>
                      </details>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            {jsonParseError ? (
              <ChatGptJsonHelper
                variant="direct-copy"
                eyebrow="JSON repair"
                title="Ask ChatGPT to correct the complete object"
                description="Copy a concise correction request containing the parser error and your pasted JSON."
                prompt={correctionPrompt}
                copyLabel="Copy correction prompt"
                successMessage="Correction prompt copied."
                failureMessage="Could not copy the correction prompt. View it below and copy it manually."
              />
            ) : null}
          </div>
        ) : assignment ? (
          <form action={formAction} className="mt-5 grid gap-5">
            {"repaired" in parseResult && parseResult.repaired ? (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950" role="status">
                <p className="font-bold">Clarion repaired a small JSON formatting issue before validation.</p>
                <p className="mt-1">Please review the assignment preview before importing.</p>
                <details className="mt-3">
                  <summary className="cursor-pointer font-semibold">View repaired JSON</summary>
                  <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-white p-3 font-mono text-xs">{parseResult.repairedJson}</pre>
                </details>
              </div>
            ) : null}
            {actionState ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-800" role="alert">
                {actionState.message}
              </div>
            ) : null}
            <input type="hidden" name="rawJson" value={rawJson} />
            <div className="sticky top-3 z-10 rounded-2xl border border-emerald-200 bg-white/95 p-4 shadow-lg shadow-slate-200/70 backdrop-blur">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-emerald-900">
                  JSON is valid. Review the preview, then choose whether students should see it now.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button type="submit" name="intent" value="DRAFT" disabled={isPending} className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400">
                    {isPending ? "Creating…" : "Save as Draft"}
                  </button>
                  <button type="submit" name="intent" value="PUBLISH" disabled={isPending} className="rounded-full bg-emerald-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-emerald-300">
                    {isPending ? "Creating…" : "Publish Assignment"}
                  </button>
                </div>
              </div>
              <p className="mt-2 text-xs font-medium text-emerald-800">Publishing makes this visible to enrolled students immediately. The imported status is shown for compatibility, but your button choice decides.</p>
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
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Student-facing instructions
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-700">
                    {assignment.instructions}
                  </p>
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    Keep this concise for students. Teacher generation context should stay out of instructions.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 lg:min-w-80 lg:grid-cols-2">
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Imported status
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
                    <div className="mt-4 text-sm leading-6 text-slate-950">
                      <QuestionPrompt prompt={question.prompt} />
                    </div>
                    {question.responseMode === "STRUCTURED" ? <div className="mt-4"><StructuredResponseRenderer questionId={question.order} schema={question.responseSchema} readOnly /></div> : null}
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
