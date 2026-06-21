"use client";

import { useMemo, useState } from "react";
import { parseAssignmentImportJson } from "../../../../../lib/assignment-import-parser.mjs";
import { importAssignmentForClass } from "./actions";

type ImportAssignmentFormProps = {
  classId: number;
};

type AssignmentImportQuestion = {
  id: string;
  order: number;
  type: "OPEN_TEXT" | "LONG_TEXT" | "MULTIPLE_CHOICE";
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
};

const placeholderJson = `{
  "formatVersion": "assignment-import-v1",
  "assignment": {
    "title": "Fractions check",
    "instructions": "Answer each question. Show your working where helpful.",
    "dueDate": "2026-06-30",
    "status": "DRAFT",
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

export function ImportAssignmentForm({ classId }: ImportAssignmentFormProps) {
  const [rawJson, setRawJson] = useState("");
  const parseResult = useMemo(() => parseAssignmentImportJson(rawJson), [rawJson]);
  const formAction = importAssignmentForClass.bind(null, classId);
  const hasInput = rawJson.trim().length > 0;
  const assignment = (parseResult.ok ? parseResult.assignment : null) as AssignmentImportAssignment | null;
  const totalPoints = assignment?.questions.reduce((total, question) => total + (question.points ?? 0), 0) ?? 0;

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,28rem)]">
      <section className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
          Paste JSON
        </p>
        <h2 className="mt-2 text-2xl font-bold text-slate-950">
          ChatGPT assignment import
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Paste structured assignment JSON. The parser validates locally before the
          save action creates the assignment and ordered question records.
        </p>
        <textarea
          value={rawJson}
          onChange={(event) => setRawJson(event.target.value)}
          rows={24}
          className="mt-5 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 font-mono text-sm text-slate-950 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
          placeholder={placeholderJson}
          aria-label="Assignment import JSON"
        />
      </section>

      <aside className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
          Validation & preview
        </p>
        {!hasInput ? (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-6 text-slate-600">
            Paste JSON to see validation feedback and a save preview.
          </div>
        ) : !parseResult.ok ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5">
            <h3 className="font-bold text-red-900">Fix these validation errors</h3>
            <ul className="mt-3 grid gap-2 text-sm text-red-800">
              {parseResult.errors.map((error, index) => (
                <li key={`${error.path}-${error.code}-${index}`}>
                  <span className="font-mono font-semibold">{error.path}</span>: {error.message}
                </li>
              ))}
            </ul>
          </div>
        ) : assignment ? (
          <form action={formAction} className="mt-5 grid gap-5">
            <input type="hidden" name="rawJson" value={rawJson} />
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
              JSON is valid. Review the preview, then confirm to save it locally.
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-950">{assignment.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-700">{assignment.instructions}</p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                {assignment.status} · Due: {assignment.dueDate ?? "No due date"} · Total: {totalPoints} pts
              </p>
            </div>
            <ol className="grid gap-4">
              {assignment.questions.map((question: AssignmentImportQuestion) => (
                <li key={question.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                    Question {question.order} · {question.type} · {question.points ? `${question.points} pts` : "No points"}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-950">{question.prompt}</p>
                  {question.options.length > 0 ? (
                    <ul className="mt-3 grid gap-2">
                      {question.options.map((option) => (
                        <li key={option.id} className="rounded-xl bg-white px-3 py-2 text-sm text-slate-700">
                          <span className="font-semibold">{option.id}.</span> {option.text}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {question.image ? (
                    <div className="mt-3 rounded-xl bg-white p-3 text-sm text-slate-700">
                      <p className="font-semibold text-slate-950">Image reference</p>
                      <p className="mt-1 break-all">{question.image.path}</p>
                      {question.image.caption ? <p className="mt-1">Caption: {question.image.caption}</p> : null}
                      {question.image.altText ? <p className="mt-1">Alt text: {question.image.altText}</p> : null}
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
            <button type="submit" className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
              Confirm and create homework
            </button>
          </form>
        ) : null}
      </aside>
    </div>
  );
}
