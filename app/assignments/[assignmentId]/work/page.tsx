import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSelectedLocalDevelopmentUser } from "../../../../lib/local-dev-user";
import { getParticipantWorkData } from "../../../../lib/participant-work";
import { saveParticipantSubmission } from "./actions";

export const dynamic = "force-dynamic";

type ParticipantWorkPageProps = {
  params: Promise<{ assignmentId: string }>;
  searchParams: Promise<{ saved?: string }>;
};

function formatDate(date: Date | null) {
  if (!date) {
    return "No due date";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getMultipleChoiceChoices(options: unknown) {
  if (
    typeof options === "object" &&
    options &&
    "choices" in options &&
    Array.isArray(options.choices)
  ) {
    return options.choices.filter((choice): choice is string =>
      typeof choice === "string",
    );
  }

  return [];
}

export default async function ParticipantWorkPage({
  params,
  searchParams,
}: ParticipantWorkPageProps) {
  const { assignmentId } = await params;
  const { saved } = await searchParams;
  const parsedAssignmentId = Number(assignmentId);

  if (!Number.isInteger(parsedAssignmentId)) {
    notFound();
  }

  const { selectedUser } = await getSelectedLocalDevelopmentUser();

  if (!selectedUser) {
    redirect("/");
  }

  if (selectedUser.role !== "STUDENT") {
    redirect("/");
  }

  const work = await getParticipantWorkData(parsedAssignmentId, selectedUser.id);

  if (!work) {
    notFound();
  }

  const saveAction = saveParticipantSubmission.bind(null, work.id);

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
      <Link
        href="/"
        className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
      >
        ← Back to assigned work
      </Link>

      <section className="mt-8 rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
              Participant work
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950">
              {work.title}
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
              {work.description ?? "No instructions have been added for this assignment."}
            </p>
            <p className="mt-4 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              {work.class.name} · {work.status} · Due: {formatDate(work.dueAt)}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-950 px-5 py-4 text-white shadow-sm lg:min-w-72">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
              Working as
            </p>
            <p className="mt-2 text-lg font-semibold">{selectedUser.displayName}</p>
            <p className="text-sm text-amber-200">{selectedUser.email}</p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
              Total
            </p>
            <p className="mt-2 font-semibold">
              {work.totals.questions} questions · {work.totals.points ?? "No"} points
            </p>
          </div>
        </div>

        {saved === "1" ? (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <p className="font-semibold">Response submitted</p>
            <p className="mt-1">
              Your answers were saved for this assignment and will reload here if
              you return later.
            </p>
          </div>
        ) : null}

        {work.submission ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-950">
              Current response: {work.submission.status}
            </p>
            <p className="mt-1">
              Last submitted: {formatDate(work.submission.submittedAt)}
            </p>
          </div>
        ) : null}
      </section>

      <form action={saveAction} className="mt-8 grid gap-5">
        {work.questions.map((question) => {
          const choices = getMultipleChoiceChoices(question.options);

          return (
            <section
              key={question.id}
              className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm sm:p-8"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                    Question {question.order} · {question.questionType}
                  </p>
                  <label
                    htmlFor={`question-${question.id}`}
                    className="mt-2 block text-lg font-semibold leading-7 text-slate-950"
                  >
                    {question.prompt}
                  </label>
                </div>
                <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700 shadow-sm ring-1 ring-slate-200">
                  {question.points === null ? "No points" : `${question.points} pts`}
                </p>
              </div>

              {question.imagePath ? (
                <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  {question.imagePath.startsWith("/media/") ? (
                    <Image
                      src={question.imagePath}
                      alt={question.imageAltText || question.imageCaption || "Question attachment"}
                      width={520}
                      height={320}
                      className="max-h-80 w-full rounded-xl border border-slate-200 bg-white object-contain"
                    />
                  ) : null}
                  {question.imageCaption ? (
                    <p className="mt-3 font-medium text-slate-950">{question.imageCaption}</p>
                  ) : null}
                  {question.imageAltText ? (
                    <p className="mt-1 text-slate-600">Alt text: {question.imageAltText}</p>
                  ) : null}
                  <p className="mt-2 break-all font-mono text-xs text-slate-500">
                    {question.imagePath}
                  </p>
                </div>
              ) : null}

              {question.questionType === "LONG_TEXT" ? (
                <textarea
                  id={`question-${question.id}`}
                  name={`question-${question.id}`}
                  defaultValue={question.answerText}
                  rows={8}
                  className="mt-5 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                />
              ) : question.questionType === "MULTIPLE_CHOICE" ? (
                <fieldset className="mt-5 grid gap-3">
                  <legend className="sr-only">{question.prompt}</legend>
                  {choices.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                      No multiple-choice options were stored for this question.
                    </p>
                  ) : (
                    choices.map((choice, optionIndex) => (
                      <label
                        key={`${question.id}-${optionIndex}`}
                        className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800"
                      >
                        <input
                          type="radio"
                          name={`question-${question.id}`}
                          value={choice}
                          defaultChecked={question.answerText === choice}
                          className="mt-1"
                        />
                        <span>{choice}</span>
                      </label>
                    ))
                  )}
                </fieldset>
              ) : (
                <input
                  id={`question-${question.id}`}
                  name={`question-${question.id}`}
                  type="text"
                  defaultValue={question.answerText}
                  className="mt-5 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                />
              )}
            </section>
          );
        })}

        <div className="sticky bottom-4 rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur">
          <button
            type="submit"
            className="w-full rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 sm:w-auto"
          >
            Save and submit response
          </button>
        </div>
      </form>
    </main>
  );
}
