import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSelectedLocalDevelopmentUser } from "../../../../lib/local-dev-user";
import { getBilingualTextParts, getLocalizedText, type LanguageMode } from "../../../../lib/i18n-content";
import { getParticipantWorkData } from "../../../../lib/participant-work";
import { completeFeedbackFollowUpAction, saveParticipantSubmission } from "./actions";

export const dynamic = "force-dynamic";

type ParticipantWorkPageProps = {
  params: Promise<{ assignmentId: string }>;
  searchParams: Promise<{ feedbackAction?: string; saved?: string; lang?: string }>;
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

function formatFeedbackActionType(type: string) {
  return type
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}


function getPlainLocalizedText(fallback: string, i18n: unknown, mode: LanguageMode) {
  return mode === "bilingual" ? getBilingualTextParts(fallback, i18n).join(" / ") : getLocalizedText(fallback, i18n, mode);
}

function renderLocalizedText(fallback: string, i18n: unknown, mode: LanguageMode) {
  const parts = mode === "bilingual" ? getBilingualTextParts(fallback, i18n) : [getLocalizedText(fallback, i18n, mode)];
  return <span className="grid gap-1">{parts.map((part, index) => <span key={index}>{part}</span>)}</span>;
}

function renderChoiceText(fallback: string, options: unknown, optionIndex: number, mode: LanguageMode) {
  const i18n = typeof options === "object" && options && "choicesI18n" in options && Array.isArray(options.choicesI18n) ? options.choicesI18n[optionIndex] : null;
  return renderLocalizedText(fallback, i18n, mode);
}

function renderVocabularyTerm(item: { englishTerm: string; chineseTerm: string; termI18n?: unknown }, mode: LanguageMode) {
  return getPlainLocalizedText(item.englishTerm, item.termI18n ?? { en: item.englishTerm, zh: item.chineseTerm }, mode);
}

function renderVocabularyDefinition(item: { englishDefinition: string; chineseDefinition: string; definitionI18n?: unknown }, mode: LanguageMode) {
  return renderLocalizedText(item.englishDefinition, item.definitionI18n ?? { en: item.englishDefinition, zh: item.chineseDefinition }, mode);
}

function LanguageLinks({ assignmentId, mode }: { assignmentId: number; mode: LanguageMode }) {
  const items: { value: LanguageMode; label: string }[] = [
    { value: "en", label: "English" },
    { value: "zh", label: "中文" },
    { value: "bilingual", label: "Bilingual" },
  ];
  return <div className="mt-5 inline-flex rounded-full border border-slate-200 bg-slate-50 p-1 shadow-sm">{items.map((item) => <Link key={item.value} href={`/assignments/${assignmentId}/work?lang=${item.value}`} className={mode === item.value ? "rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white" : "rounded-full px-4 py-2 text-sm font-semibold text-slate-700 hover:text-slate-950"}>{item.label}</Link>)}</div>;
}

function FeedbackActionCard({ action, assignmentId }: { action: { id: number; type: string; prompt: string; required: boolean; status: string; responseText: string | null; completedAt: Date | null }; assignmentId: number }) {
  const isCompleted = action.status === "COMPLETED";
  const completeAction = completeFeedbackFollowUpAction.bind(null, assignmentId, action.id);
  const needsWrittenResponse = action.type !== "ACKNOWLEDGEMENT";

  return (
    <li className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="font-semibold text-slate-950">{formatFeedbackActionType(action.type)} · {action.required ? "Required" : "Optional"}</p>
      <p className="mt-1 leading-6">{action.prompt}</p>
      {isCompleted ? (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">
          <p className="text-xs font-bold uppercase tracking-[0.14em]">Completed{action.completedAt ? ` · ${formatDate(action.completedAt)}` : ""}</p>
          {action.responseText ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{action.responseText}</p> : <p className="mt-2 text-sm">Acknowledged.</p>}
        </div>
      ) : (
        <form action={completeAction} className="mt-3 grid gap-3">
          {needsWrittenResponse ? (
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Your response
              <textarea name="responseText" rows={3} required className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200" placeholder={action.type === "SHORT_REFLECTION" ? "Write a short reflection or next step..." : "Answer the follow-up question..."} />
            </label>
          ) : (
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input name="acknowledged" type="checkbox" required className="mt-1 h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400" />
              <span>I have read and understood this feedback.</span>
            </label>
          )}
          <button type="submit" className="justify-self-start rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">Mark action completed</button>
        </form>
      )}
    </li>
  );
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
  const { feedbackAction, saved, lang } = await searchParams;
  const languageMode: LanguageMode = lang === "zh" || lang === "bilingual" ? lang : "en";
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
    return (
      <main className="mx-auto min-h-screen max-w-3xl px-6 py-12">
        <Link
          href="/"
          className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
        >
          ← Back to assigned work
        </Link>
        <section className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">
            Assignment unavailable
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
            This assignment is not available to students.
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            It may still be a teacher draft, may not be assigned to one of your enrolled classes, or may have been removed. Published assignments for your enrolled classes appear on your assigned-work dashboard.
          </p>
        </section>
      </main>
    );
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
              {renderLocalizedText(work.title, work.titleI18n, languageMode)}
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
              {renderLocalizedText(work.description ?? "No instructions have been added for this assignment.", work.descriptionI18n, languageMode)}
            </p>
            <p className="mt-4 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              {work.class.name} · {work.status} · Due: {formatDate(work.dueAt)}
            </p>
          </div>
          <LanguageLinks assignmentId={work.id} mode={languageMode} />
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

        {feedbackAction === "completed" ? (
          <div id="feedback-action-saved" className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <p className="font-semibold">Feedback action completed</p>
            <p className="mt-1">Your feedback action was saved locally for your teacher to review.</p>
          </div>
        ) : feedbackAction === "already-completed" ? (
          <div id="feedback-action-saved" className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">Feedback action already completed</p>
            <p className="mt-1">Completed feedback actions are shown read-only.</p>
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

        {work.feedback ? (
          <section id="feedback" className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                Feedback
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                Teacher feedback
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Your teacher has added feedback for this assignment.
              </p>
            </div>
            <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
              <p className="font-semibold">Added {formatDate(work.feedback.feedbackImport.importedAt)}</p>
            </div>
          </div>


            <div className="mt-5 grid gap-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-lg font-semibold text-slate-950">Overall feedback</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {work.feedback.overallFeedback}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <h3 className="font-semibold text-emerald-950">Strengths</h3>
                  {work.feedback.strengths.length > 0 ? (
                    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-emerald-900">
                      {work.feedback.strengths.map((strength, index) => (
                        <li key={`strength-${index}`}>{strength}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-emerald-900">No strengths were included in the imported feedback.</p>
                  )}
                </div>
                <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
                  <h3 className="font-semibold text-sky-950">Targets / next steps</h3>
                  {work.feedback.targets.length > 0 ? (
                    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-sky-900">
                      {work.feedback.targets.map((target, index) => (
                        <li key={`target-${index}`}>{target}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-sky-900">No targets were included in the imported feedback.</p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <h3 className="font-semibold text-slate-950">Required follow-up actions</h3>
                {work.feedback.followUpActions.length > 0 ? (
                  <ul className="mt-3 grid gap-3 text-sm text-slate-700">
                    {work.feedback.followUpActions.map((action) => (
                      <FeedbackActionCard key={action.id} action={action} assignmentId={work.id} />
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-slate-600">No overall follow-up actions were included in the imported feedback.</p>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <h3 className="font-semibold text-slate-950">Question-level feedback</h3>
                {work.feedback.questionFeedback.length > 0 ? (
                  <div className="mt-3 grid gap-3">
                    {work.feedback.questionFeedback.map((questionFeedback) => {
                      const linkedQuestion = questionFeedback.questionId
                        ? work.questions.find((question) => question.id === questionFeedback.questionId)
                        : null;

                      return (
                        <article key={questionFeedback.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="font-semibold text-slate-950">
                                Question {linkedQuestion?.order ?? questionFeedback.questionOrder ?? "unknown"}
                              </p>
                              {linkedQuestion ? (
                                <a href={`#question-${linkedQuestion.id}`} className="mt-1 inline-flex font-semibold text-slate-950 underline-offset-4 hover:underline">
                                  Jump to original question prompt
                                </a>
                              ) : (
                                <p className="mt-1 text-slate-500">Original question could not be linked.</p>
                              )}
                            </div>
                          </div>
                          {linkedQuestion ? (
                            <blockquote className="mt-3 rounded-xl border-l-4 border-slate-300 bg-white px-4 py-3 text-slate-600">
                              {renderLocalizedText(linkedQuestion.prompt, linkedQuestion.promptI18n, languageMode)}
                            </blockquote>
                          ) : null}
                          <p className="mt-3 whitespace-pre-wrap leading-6">{questionFeedback.feedback}</p>
                          {(questionFeedback.strengths.length > 0 || questionFeedback.targets.length > 0) ? (
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                              {questionFeedback.strengths.length > 0 ? (
                                <div>
                                  <p className="font-semibold text-emerald-900">Strengths</p>
                                  <ul className="mt-1 list-disc space-y-1 pl-5">{questionFeedback.strengths.map((strength, index) => <li key={`q-strength-${questionFeedback.id}-${index}`}>{strength}</li>)}</ul>
                                </div>
                              ) : null}
                              {questionFeedback.targets.length > 0 ? (
                                <div>
                                  <p className="font-semibold text-sky-900">Targets</p>
                                  <ul className="mt-1 list-disc space-y-1 pl-5">{questionFeedback.targets.map((target, index) => <li key={`q-target-${questionFeedback.id}-${index}`}>{target}</li>)}</ul>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                          {questionFeedback.followUpActions.length > 0 ? (
                            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                              <p className="font-semibold text-amber-950">Question follow-up</p>
                              <ul className="mt-2 grid gap-3">
                                {questionFeedback.followUpActions.map((action) => (
                                  <FeedbackActionCard key={action.id} action={action} assignmentId={work.id} />
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-600">No question-level feedback was included in the imported feedback.</p>
                )}
              </div>
            </div>
          </section>
        ) : null}
      </section>

      {work.keyVocabulary.length > 0 ? (
        <section className="mt-8 rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Key vocabulary / 关键词</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">Words that may help</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {work.keyVocabulary.map((item) => (
              <article key={`${item.englishTerm}-${item.chineseTerm}`} className="rounded-2xl border border-emerald-100 bg-white p-4 text-sm shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-950">{renderVocabularyTerm(item, languageMode)}</h3>
                  {item.category ? <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-900">{item.category}</span> : null}
                </div>
                <p className="mt-3 leading-6 text-slate-700">{renderVocabularyDefinition(item, languageMode)}</p>
                {item.questionIds.length > 0 ? <p className="mt-3 text-xs font-semibold text-slate-500">Useful for: {item.questionIds.join(", ")}</p> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <form action={saveAction} className="mt-8 grid gap-5">
        {work.questions.map((question) => {
          const choices = getMultipleChoiceChoices(question.options);

          return (
            <section
              id={`question-${question.id}`}
              key={question.id}
              className="scroll-mt-6 rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm sm:p-8"
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
                    {renderLocalizedText(question.prompt, question.promptI18n, languageMode)}
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
                  <legend className="sr-only">{renderLocalizedText(question.prompt, question.promptI18n, languageMode)}</legend>
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
                        <span>{renderChoiceText(choice, question.options, optionIndex, languageMode)}</span>
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
