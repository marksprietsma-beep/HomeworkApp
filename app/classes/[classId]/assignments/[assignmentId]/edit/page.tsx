import Link from "next/link";
import { notFound } from "next/navigation";
import { HomeworkAssignmentStatus, HomeworkQuestionType, UserRole } from "@prisma/client";
import { getSelectedLocalDevelopmentUser } from "../../../../../../lib/local-dev-user";
import { prisma } from "../../../../../../lib/prisma";
import { EditAssignmentForm } from "./edit-assignment-form";

export const dynamic = "force-dynamic";

type EditAssignmentPageProps = {
  params: Promise<{
    classId: string;
    assignmentId: string;
  }>;
};

export default async function EditAssignmentPage({ params }: EditAssignmentPageProps) {
  const { classId, assignmentId } = await params;
  const parsedClassId = Number(classId);
  const parsedAssignmentId = Number(assignmentId);

  if (!Number.isInteger(parsedClassId) || !Number.isInteger(parsedAssignmentId)) {
    notFound();
  }

  const [{ selectedUser }, assignment] = await Promise.all([
    getSelectedLocalDevelopmentUser(),
    prisma.homeworkAssignment.findFirst({
      where: { id: parsedAssignmentId, classId: parsedClassId },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            teacher: { select: { id: true, displayName: true, email: true } },
          },
        },
        questions: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            order: true,
            prompt: true,
            questionType: true,
            points: true,
            options: true,
            imagePath: true,
            imageCaption: true,
            imageAltText: true,
          },
        },
        _count: { select: { submissions: true } },
      },
    }),
  ]);

  if (!assignment) {
    notFound();
  }

  const canEdit = selectedUser?.role === UserRole.TEACHER && selectedUser.id === assignment.class.teacher.id;

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
      <Link href={`/classes/${assignment.class.id}/assignments/${assignment.id}`} className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950">
        ← Back to assignment detail
      </Link>

      <section className="mt-8 rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Edit assignment</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950">{assignment.title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Update assignment details and existing questions for {assignment.class.name}. This flow keeps existing submissions, answers, and feedback in place.
        </p>

        {canEdit ? (
          <EditAssignmentForm
            assignment={{
              id: assignment.id,
              classId: assignment.class.id,
              title: assignment.title,
              description: assignment.description,
              status: assignment.status as HomeworkAssignmentStatus,
              dueAt: assignment.dueAt,
              questions: assignment.questions.map((question) => ({
                ...question,
                questionType: question.questionType as HomeworkQuestionType,
              })),
              hasResponses: assignment._count.submissions > 0,
            }}
          />
        ) : (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
            <p className="font-semibold text-slate-950">Editing is unavailable for the current local user.</p>
            <p className="mt-2">Switch to {assignment.class.teacher.displayName} ({assignment.class.teacher.email}) in the temporary local role switcher to edit this assignment.</p>
          </div>
        )}
      </section>
    </main>
  );
}
