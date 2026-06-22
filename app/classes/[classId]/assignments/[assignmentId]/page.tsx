import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getHomeworkDetailData } from "../../../../../lib/homework-detail";
import { getSelectedLocalDevelopmentUser } from "../../../../../lib/local-dev-user";

export const dynamic = "force-dynamic";

type HomeworkDetailPageProps = {
  params: Promise<{
    classId: string;
    assignmentId: string;
  }>;
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

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-3xl font-bold text-slate-950">{value}</p>
      <p className="mt-1 text-sm font-medium text-slate-600">{label}</p>
    </div>
  );
}

export default async function HomeworkDetailPage({
  params,
}: HomeworkDetailPageProps) {
  const { classId, assignmentId } = await params;
  const parsedClassId = Number(classId);
  const parsedAssignmentId = Number(assignmentId);

  if (!Number.isInteger(parsedClassId) || !Number.isInteger(parsedAssignmentId)) {
    notFound();
  }

  const [{ selectedUser }, homework] = await Promise.all([
    getSelectedLocalDevelopmentUser(),
    getHomeworkDetailData(
      parsedClassId,
      parsedAssignmentId,
    ),
  ]);

  if (!homework) {
    notFound();
  }

  const canViewResponseOverview =
    selectedUser?.role === "TEACHER" && selectedUser.id === homework.class.teacher.id;

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <Link
        href={`/classes/${homework.class.id}`}
        className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
      >
        ← Back to class details
      </Link>

      <section className="mt-8 rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
          Homework detail
        </p>
        <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-950">
              {homework.title}
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
              {homework.description ?? "No instructions have been added for this assignment."}
            </p>
            <p className="mt-4 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              {homework.status} · Due: {formatDate(homework.dueAt)}
            </p>
            {canViewResponseOverview ? (
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href={`/classes/${homework.class.id}/assignments/${homework.id}/responses`}
                  className="inline-flex rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                >
                  View response overview
                </Link>
                <Link
                  href={`/classes/${homework.class.id}/assignments/${homework.id}/responses/export`}
                  className="inline-flex rounded-full bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-amber-300"
                >
                  Export responses
                </Link>
                <Link
                  href={`/classes/${homework.class.id}/assignments/${homework.id}/feedback/import`}
                  className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:text-slate-950"
                >
                  Import feedback
                </Link>
              </div>
            ) : null}
          </div>
          <div className="rounded-2xl bg-slate-950 px-5 py-4 text-white shadow-sm lg:min-w-72">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
              Class
            </p>
            <p className="mt-2 text-lg font-semibold">{homework.class.name}</p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
              Teacher
            </p>
            <p className="mt-2 font-semibold">{homework.class.teacher.displayName}</p>
            <p className="text-sm text-amber-200">{homework.class.teacher.email}</p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <StatCard label="Questions" value={homework.totals.questions} />
          <StatCard label="Total points" value={homework.totals.points} />
          <StatCard label="Submissions" value={homework.totals.submissions} />
        </div>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
        <section className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
            Questions
          </p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">
            Ordered question list
          </h2>

          {homework.questions.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
              No questions have been added to this assignment yet.
            </div>
          ) : (
            <ol className="mt-6 grid gap-4">
              {homework.questions.map((question) => (
                <li
                  key={question.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                        Question {question.order} · {question.questionType}
                      </p>
                      <p className="mt-2 text-base leading-7 text-slate-950">
                        {question.prompt}
                      </p>
                    </div>
                    <p className="rounded-xl bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
                      {question.points ? `${question.points} pts` : "No points"}
                    </p>
                  </div>
                  {question.questionType === "MULTIPLE_CHOICE" &&
                  getMultipleChoiceChoices(question.options).length > 0 ? (
                    <ul className="mt-4 grid gap-2">
                      {getMultipleChoiceChoices(question.options).map(
                        (choice, optionIndex) => (
                          <li
                            key={`${question.id}-${optionIndex}`}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                          >
                            {choice}
                          </li>
                        ),
                      )}
                    </ul>
                  ) : null}
                  {question.imagePath ? (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                      <p className="font-semibold text-slate-950">Image reference</p>
                      {question.imagePath.startsWith("/media/") ? (
                        <Image
                          src={question.imagePath}
                          alt={question.imageAltText || question.imageCaption || "Question attachment"}
                          width={320}
                          height={224}
                          className="mt-3 max-h-56 w-full rounded-xl border border-slate-200 object-contain sm:w-80"
                        />
                      ) : null}
                      <p className="mt-3 break-all font-mono text-xs">{question.imagePath}</p>
                      {question.imageCaption ? <p className="mt-2">Caption: {question.imageCaption}</p> : null}
                      {question.imageAltText ? <p className="mt-1">Alt text: {question.imageAltText}</p> : null}
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
            Submissions
          </p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">Summary</h2>

          {homework.submissions.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
              No students have started or submitted this assignment yet.
            </div>
          ) : (
            <ul className="mt-6 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
              {homework.submissions.map((submission) => (
                <li key={submission.id} className="px-4 py-4">
                  <p className="font-semibold text-slate-950">
                    {submission.student.displayName}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {submission.student.email}
                  </p>
                  <p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                    {submission.status} · {formatDate(submission.submittedAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
