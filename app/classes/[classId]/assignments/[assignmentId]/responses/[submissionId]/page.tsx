import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSelectedLocalDevelopmentUser } from "../../../../../../../lib/local-dev-user";
import { getResponseDetailData } from "../../../../../../../lib/response-detail";

export const dynamic = "force-dynamic";

type ResponseDetailPageProps = {
  params: Promise<{
    classId: string;
    assignmentId: string;
    submissionId: string;
  }>;
};

function formatDateTime(date: Date | null) {
  if (!date) {
    return "Not available";
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

function ResponseAnswer({ answerText, questionType }: { answerText: string; questionType: string }) {
  if (!answerText) {
    return (
      <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
        No answer was saved for this question.
      </div>
    );
  }

  if (questionType === "MULTIPLE_CHOICE") {
    return (
      <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
          Selected option
        </p>
        <p className="mt-2 text-base font-semibold text-slate-950">{answerText}</p>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
        Written response
      </p>
      <p className="mt-2 whitespace-pre-wrap text-base leading-7 text-slate-950">{answerText}</p>
    </div>
  );
}

export default async function ResponseDetailPage({ params }: ResponseDetailPageProps) {
  const { classId, assignmentId, submissionId } = await params;
  const parsedClassId = Number(classId);
  const parsedAssignmentId = Number(assignmentId);
  const parsedSubmissionId = Number(submissionId);

  if (
    !Number.isInteger(parsedClassId) ||
    !Number.isInteger(parsedAssignmentId) ||
    !Number.isInteger(parsedSubmissionId)
  ) {
    notFound();
  }

  const { selectedUser } = await getSelectedLocalDevelopmentUser();
  const { response, found } = await getResponseDetailData(
    parsedClassId,
    parsedAssignmentId,
    parsedSubmissionId,
    selectedUser,
  );

  if (!found) {
    return (
      <main className="mx-auto min-h-screen max-w-4xl px-6 py-12">
        <Link
          href={`/classes/${parsedClassId}/assignments/${parsedAssignmentId}/responses`}
          className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
        >
          ← Back to response overview
        </Link>
        <section className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-white/80 p-6 shadow-sm sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
            Response not found
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
            This saved response could not be found
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            It may have been removed, or it may not belong to this class and assignment.
          </p>
        </section>
      </main>
    );
  }

  if (!response) {
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
            Teacher detail unavailable
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
            Switch to the class teacher to view this response
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            This read-only page uses the temporary local development user switcher.
            Student users cannot inspect participant submissions.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
      <Link
        href={`/classes/${response.assignment.class.id}/assignments/${response.assignment.id}/responses`}
        className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
      >
        ← Back to response overview
      </Link>

      <section className="mt-8 rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
              Individual response detail
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950">
              {response.assignment.title}
            </h1>
            <p className="mt-4 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              {response.assignment.class.name} · {response.assignment.status} · Due: {formatDateTime(response.assignment.dueAt)}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-950 px-5 py-4 text-white shadow-sm lg:min-w-72">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
              Participant
            </p>
            <p className="mt-2 text-lg font-semibold">{response.participant.displayName}</p>
            <p className="text-sm text-amber-200">{response.participant.email}</p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
              Saved response
            </p>
            <p className="mt-2 font-semibold">
              {response.status} · {formatDateTime(response.submittedAt ?? response.updatedAt)}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-5">
        {response.questions.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white/80 p-6 text-sm text-slate-600 shadow-sm sm:p-8">
            This assignment has no questions to review for this submission.
          </div>
        ) : (
          response.questions.map((question, index) => {
            const choices = getMultipleChoiceChoices(question.options);

            return (
              <article key={question.id} className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm sm:p-8">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                      Question {question.order || index + 1} · {question.questionType}
                    </p>
                    <h2 className="mt-2 text-lg font-semibold leading-7 text-slate-950">
                      {question.prompt}
                    </h2>
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

                {question.questionType === "MULTIPLE_CHOICE" && choices.length > 0 ? (
                  <div className="mt-5 grid gap-2">
                    {choices.map((choice, optionIndex) => {
                      const selected = question.answerText === choice;

                      return (
                        <div
                          key={`${question.id}-${optionIndex}`}
                          className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
                            selected
                              ? "border-emerald-300 bg-emerald-50 text-slate-950"
                              : "border-slate-200 bg-slate-50 text-slate-600"
                          }`}
                        >
                          {selected ? "✓ " : ""}{choice}
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                <ResponseAnswer answerText={question.answerText} questionType={question.questionType} />
              </article>
            );
          })
        )}
      </section>
    </main>
  );
}
