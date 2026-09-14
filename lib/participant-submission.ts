import { Prisma, SubmissionStatus, UserRole } from "@prisma/client";
import { studentAssignmentAccessWhere } from "./access-control";
import { prisma } from "./prisma";
import { submissionStateAfterSave } from "./question-response-mode";
import { structuredFields, validateStructuredAnswer } from "./structured-response";
import { participantSubmissionAdvisoryLockQuery } from "./participant-submission-lock";

export class ParticipantSubmissionError extends Error {
  constructor(message: string, public readonly code: "FORBIDDEN" | "NOT_FOUND" | "ALREADY_SUBMITTED") {
    super(message);
  }
}

type Student = { id: number; role: UserRole };

/** The single persistence path used by both explicit saves and background autosave. */
export async function persistParticipantSubmission({
  assignmentId,
  formData,
  student,
  intent,
}: {
  assignmentId: number;
  formData: FormData;
  student: Student | null;
  intent: "DRAFT" | "SUBMITTED" | "AUTOSAVE";
}) {
  if (!student || student.role !== "STUDENT") {
    throw new ParticipantSubmissionError("A student session is required.", "FORBIDDEN");
  }

  const assignment = await prisma.homeworkAssignment.findFirst({
    where: studentAssignmentAccessWhere(assignmentId, student),
    select: {
      id: true,
      questions: { select: { id: true, responseMode: true, responseSchema: true } },
    },
  });
  if (!assignment) {
    throw new ParticipantSubmissionError("Assignment is not published for this student.", "NOT_FOUND");
  }

  return prisma.$transaction(async (tx) => {
    // Serialize this student's assignment writes in PostgreSQL as well as in the
    // route process, so concurrent app instances cannot reorder answer snapshots.
    // Use executeRaw because PostgreSQL exposes the blocking lock function as a
    // void result. queryRaw asks Prisma to deserialize that void column (P2010).
    await tx.$executeRaw(participantSubmissionAdvisoryLockQuery(assignmentId, student.id));
    const current = await tx.submission.findUnique({
      where: { assignmentId_studentId: { assignmentId, studentId: student.id } },
      select: { id: true, status: true, submittedAt: true },
    });
    if (intent === "AUTOSAVE" && current?.status === SubmissionStatus.SUBMITTED) {
      throw new ParticipantSubmissionError("Submitted work cannot be autosaved.", "ALREADY_SUBMITTED");
    }

    const nextState = intent === "AUTOSAVE" ? { status: SubmissionStatus.DRAFT, submittedAt: null } : submissionStateAfterSave(current, intent === "DRAFT", new Date());
    let submission: { id: number; updatedAt: Date; status: SubmissionStatus };
    if (intent === "AUTOSAVE" && current) {
      // The status predicate closes the race with an explicit Submit request.
      const updated = await tx.submission.updateMany({
        where: { id: current.id, status: SubmissionStatus.DRAFT },
        data: { status: SubmissionStatus.DRAFT, submittedAt: null },
      });
      if (updated.count !== 1) throw new ParticipantSubmissionError("Submitted work cannot be autosaved.", "ALREADY_SUBMITTED");
      submission = await tx.submission.findUniqueOrThrow({ where: { id: current.id }, select: { id: true, updatedAt: true, status: true } });
    } else if (intent === "AUTOSAVE") {
      // Create rather than upsert so a concurrent explicit submit can never be downgraded.
      submission = await tx.submission.create({
        data: { assignmentId, studentId: student.id, status: SubmissionStatus.DRAFT, submittedAt: null },
        select: { id: true, updatedAt: true, status: true },
      });
    } else {
      submission = await tx.submission.upsert({
        where: { assignmentId_studentId: { assignmentId, studentId: student.id } },
        update: { status: nextState.status as SubmissionStatus, submittedAt: nextState.submittedAt },
        create: { assignmentId, studentId: student.id, status: nextState.status as SubmissionStatus, submittedAt: nextState.submittedAt },
        select: { id: true, updatedAt: true, status: true },
      });
    }

    for (const question of assignment.questions) {
      const rawAnswer = formData.get(`question-${question.id}`);
      const answerText = question.responseMode === "STRUCTURED" ? "" : typeof rawAnswer === "string" ? rawAnswer : "";
      const answerData = question.responseMode === "STRUCTURED"
        ? validateStructuredAnswer(question.responseSchema, {
          schemaVersion: 1,
          values: Object.fromEntries(structuredFields(question.responseSchema).map((field) => [field.id, String(formData.get(`structured-${question.id}-${field.id}`) ?? "")])),
        })
        : null;
      await tx.submissionAnswer.upsert({
        where: { submissionId_questionId: { submissionId: submission.id, questionId: question.id } },
        update: { answerText, answerData: answerData as Prisma.InputJsonValue ?? Prisma.JsonNull },
        create: { submissionId: submission.id, questionId: question.id, answerText, answerData: answerData as Prisma.InputJsonValue ?? undefined },
      });
    }
    return submission;
  });
}
