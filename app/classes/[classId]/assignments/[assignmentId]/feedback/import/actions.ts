"use server";

import { createHash } from "node:crypto";
import { FeedbackFollowUpActionType, FeedbackReleaseState, Prisma, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { parseFeedbackImportJson } from "../../../../../../../lib/feedback-import-parser.mjs";
import { getFeedbackImportPageData } from "../../../../../../../lib/feedback-import";
import { getSelectedLocalDevelopmentUser } from "../../../../../../../lib/local-dev-user";
import { prisma } from "../../../../../../../lib/prisma";

type SaveFeedbackImportState = { ok: boolean; message: string; payloadHash?: string; submittedRawJson?: string; savedImportId?: number; canRelease?: boolean };

type ImportContext = { participants: Array<{ id: number; submission: { id: number } | null }>; questions: Array<{ id: number }> };

type JsonI18n = Prisma.InputJsonValue;

type NormalizedFeedback = {
  feedbackFormat: string;
  feedbackVersion: number;
  sourceExport: { exportFormat: string; exportVersion: number; generatedAt?: string } | null;
  generatedBy?: string;
  generatedAt?: string;
  participantFeedback: Array<{
    participant: { id: number; name?: string; email?: string | null };
    submission: { id: number; status?: string } | null;
    overallFeedback: string;
    overallFeedbackI18n?: JsonI18n;
    strengths: string[];
    strengthsI18n?: JsonI18n;
    targets: string[];
    targetsI18n?: JsonI18n;
    teacherNotes?: string;
    questionFeedback: Array<{
      questionId: number;
      questionOrder: number | null;
      feedback: string;
      feedbackI18n?: JsonI18n;
      strengths: string[];
      strengthsI18n?: JsonI18n;
      targets: string[];
      targetsI18n?: JsonI18n;
      teacherNotes?: string;
      followUpActions: Array<{ id: string; type: string; prompt: string; promptI18n?: JsonI18n; required: boolean; status: string }>;
    }>;
    followUpActions: Array<{ id: string; type: string; prompt: string; promptI18n?: JsonI18n; required: boolean; status: string }>;
  }>;
};

function optionalDate(value: string | undefined) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function payloadHash(feedback: NormalizedFeedback) {
  return createHash("sha256").update(stableStringify(feedback)).digest("hex");
}

export async function saveFeedbackImport(
  classId: number,
  assignmentId: number,
  _previousState: SaveFeedbackImportState,
  formData: FormData,
): Promise<SaveFeedbackImportState> {
  const rawJson = String(formData.get("rawJson") ?? "");
  const confirmReplace = formData.get("confirmReplace") === "on";
  const { selectedUser } = await getSelectedLocalDevelopmentUser();

  if (!selectedUser || selectedUser.role !== UserRole.TEACHER) {
    return { ok: false, message: "Switch to the seeded teacher user to import feedback." };
  }

  const pageData = await getFeedbackImportPageData(classId, assignmentId, selectedUser);
  if (!pageData.found || !pageData.assignment || !pageData.context || !pageData.canImport) {
    return { ok: false, message: "Feedback import is only available to the class teacher." };
  }

  const parseResult = parseFeedbackImportJson(rawJson, pageData.context);
  if (!parseResult.ok) {
    return { ok: false, message: `Fix the feedback JSON before saving: ${parseResult.errors.map((error) => `${error.path} ${error.message}`).join("; ")}` };
  }

  const feedback = parseResult.feedback as NormalizedFeedback;
  const importPayloadHash = payloadHash(feedback);

  const existingImport = await prisma.feedbackImport.findUnique({
    where: { assignmentId_importPayloadHash: { assignmentId, importPayloadHash } },
    select: { id: true },
  });

  if (existingImport) {
    return {
      ok: true,
      message: `Feedback already saved for this exact payload as import #${existingImport.id}. It was not saved again; import another feedback file to continue.`,
      payloadHash: importPayloadHash,
      submittedRawJson: rawJson,
    };
  }

  const context = pageData.context as ImportContext;
  const incomingKeys = feedback.participantFeedback.map((entry) => ({
    studentId: entry.participant.id,
    submissionId: entry.submission?.id ?? null,
  }));
  const existingFeedback = await prisma.participantFeedback.findMany({
    where: {
      assignmentId,
      OR: incomingKeys.map((key) => ({ studentId: key.studentId, submissionId: key.submissionId })),
    },
    select: { id: true, releaseState: true },
  });
  if (existingFeedback.length > 0 && !confirmReplace) {
    const released = existingFeedback.filter((item) => item.releaseState === FeedbackReleaseState.RELEASED).length;
    const draft = existingFeedback.length - released;
    return {
      ok: false,
      message: `This will replace existing feedback for ${existingFeedback.length} student${existingFeedback.length === 1 ? "" : "s"} (${draft} draft, ${released} released). Tick the replace confirmation and save again.`,
      submittedRawJson: rawJson,
      payloadHash: importPayloadHash,
    };
  }

  const students = new Set(context.participants.map((participant) => participant.id));
  const submissions = new Set(context.participants.flatMap((participant) => participant.submission ? [participant.submission.id] : []));
  const questions = new Set(context.questions.map((question) => question.id));

  try {
    const saved = await prisma.$transaction(async (tx) => {
    if (existingFeedback.length > 0) {
      await tx.participantFeedback.deleteMany({ where: { id: { in: existingFeedback.map((item) => item.id) } } });
    }

    const questionFeedbackCount = feedback.participantFeedback.reduce((total, entry) => total + entry.questionFeedback.length, 0);
    const followUpActionCount = feedback.participantFeedback.reduce((total, entry) => total + entry.followUpActions.length + entry.questionFeedback.reduce((qTotal, question) => qTotal + question.followUpActions.length, 0), 0);
    const hasBilingualFields = JSON.stringify(feedback).includes("I18n");

    const feedbackImport = await tx.feedbackImport.create({
      data: {
        assignmentId,
        feedbackFormat: feedback.feedbackFormat,
        feedbackVersion: feedback.feedbackVersion,
        sourceExportFormat: feedback.sourceExport?.exportFormat,
        sourceExportVersion: feedback.sourceExport?.exportVersion,
        sourceExportGeneratedAt: optionalDate(feedback.sourceExport?.generatedAt),
        generatedBy: feedback.generatedBy,
        generatedAt: optionalDate(feedback.generatedAt),
        importPayloadHash,
        importedById: selectedUser.id,
        classId,
        operationSummary: {
          created: feedback.participantFeedback.length - existingFeedback.length,
          replaced: existingFeedback.length,
          releaseState: "DRAFT",
          students: feedback.participantFeedback.length,
          questionFeedback: questionFeedbackCount,
          followUpActions: followUpActionCount,
          bilingualFieldsDetected: hasBilingualFields,
        },
      },
      select: { id: true },
    });

    for (const entry of feedback.participantFeedback) {
      const participantFeedback = await tx.participantFeedback.create({
        data: {
          feedbackImportId: feedbackImport.id,
          assignmentId,
          studentId: students.has(entry.participant.id) ? entry.participant.id : undefined,
          submissionId: entry.submission?.id && submissions.has(entry.submission.id) ? entry.submission.id : undefined,
          sourceParticipantId: entry.participant.id,
          sourceParticipantName: entry.participant.name,
          sourceParticipantEmail: entry.participant.email,
          sourceSubmissionId: entry.submission?.id,
          sourceSubmissionStatus: entry.submission?.status,
          releaseState: FeedbackReleaseState.DRAFT,
          importedById: selectedUser.id,
          importAction: existingFeedback.length > 0 ? "replaced" : "created",
          overallFeedback: entry.overallFeedback,
          overallFeedbackI18n: entry.overallFeedbackI18n,
          strengths: entry.strengths,
          strengthsI18n: entry.strengthsI18n,
          targets: entry.targets,
          targetsI18n: entry.targetsI18n,
          teacherNotes: entry.teacherNotes,
        },
        select: { id: true },
      });

      for (const action of entry.followUpActions) {
        await tx.feedbackFollowUpAction.create({
          data: {
            participantFeedbackId: participantFeedback.id,
            sourceActionId: action.id,
            type: action.type as FeedbackFollowUpActionType,
            prompt: action.prompt,
            promptI18n: action.promptI18n,
            required: action.required,
            status: "PENDING",
          },
        });
      }

      for (const question of entry.questionFeedback) {
        const questionFeedback = await tx.questionFeedback.create({
          data: {
            participantFeedbackId: participantFeedback.id,
            questionId: questions.has(question.questionId) ? question.questionId : undefined,
            sourceQuestionId: question.questionId,
            questionOrder: question.questionOrder,
            feedback: question.feedback,
            feedbackI18n: question.feedbackI18n,
            strengths: question.strengths,
            strengthsI18n: question.strengthsI18n,
            targets: question.targets,
            targetsI18n: question.targetsI18n,
            teacherNotes: question.teacherNotes,
          },
          select: { id: true },
        });

        for (const action of question.followUpActions) {
          await tx.feedbackFollowUpAction.create({
            data: {
              participantFeedbackId: participantFeedback.id,
              questionFeedbackId: questionFeedback.id,
              sourceActionId: action.id,
              type: action.type as FeedbackFollowUpActionType,
              prompt: action.prompt,
              promptI18n: action.promptI18n,
              required: action.required,
              status: "PENDING",
            },
          });
        }
      }
    }

    return feedbackImport;
  });

    revalidatePath(`/classes/${classId}/assignments/${assignmentId}/feedback/import`);
    revalidatePath(`/classes/${classId}/assignments/${assignmentId}/responses`);
    return { ok: true, message: `Feedback saved as draft import #${saved.id}. Review it below, then release feedback to students when ready.`, payloadHash: importPayloadHash, submittedRawJson: rawJson, savedImportId: saved.id, canRelease: true };
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      const duplicate = await prisma.feedbackImport.findUnique({
        where: { assignmentId_importPayloadHash: { assignmentId, importPayloadHash } },
        select: { id: true },
      });
      return {
        ok: true,
        message: `Feedback already saved for this exact payload${duplicate ? ` as import #${duplicate.id}` : ""}. It was not saved again; import another feedback file to continue.`,
        payloadHash: importPayloadHash,
        submittedRawJson: rawJson,
      };
    }
    throw error;
  }
}


export async function releaseFeedbackForAssignment(classId: number, assignmentId: number) {
  const { selectedUser } = await getSelectedLocalDevelopmentUser();
  if (!selectedUser || selectedUser.role !== UserRole.TEACHER) {
    return { ok: false, message: "Switch to the class teacher to release feedback." };
  }
  const pageData = await getFeedbackImportPageData(classId, assignmentId, selectedUser);
  if (!pageData.found || !pageData.assignment || !pageData.canImport) {
    return { ok: false, message: "Feedback release is only available to the class teacher." };
  }
  const result = await prisma.participantFeedback.updateMany({
    where: { assignmentId, releaseState: FeedbackReleaseState.DRAFT },
    data: { releaseState: FeedbackReleaseState.RELEASED, releasedAt: new Date(), releasedById: selectedUser.id },
  });
  revalidatePath(`/classes/${classId}/assignments/${assignmentId}/feedback/import`);
  revalidatePath(`/classes/${classId}/assignments/${assignmentId}/responses`);
  revalidatePath(`/assignments/${assignmentId}/work`);
  return { ok: true, message: result.count > 0 ? `Released feedback for ${result.count} student${result.count === 1 ? "" : "s"}.` : "No draft feedback is waiting for release." };
}
