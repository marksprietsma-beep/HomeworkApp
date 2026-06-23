"use server";

import { createHash } from "node:crypto";
import { FeedbackFollowUpActionType, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { parseFeedbackImportJson } from "../../../../../../../lib/feedback-import-parser.mjs";
import { getFeedbackImportPageData } from "../../../../../../../lib/feedback-import";
import { getSelectedLocalDevelopmentUser } from "../../../../../../../lib/local-dev-user";
import { prisma } from "../../../../../../../lib/prisma";

type SaveFeedbackImportState = { ok: boolean; message: string; payloadHash?: string; submittedRawJson?: string };

type ImportContext = { participants: Array<{ id: number; submission: { id: number } | null }>; questions: Array<{ id: number }> };

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
    strengths: string[];
    targets: string[];
    teacherNotes?: string;
    questionFeedback: Array<{
      questionId: number;
      questionOrder: number | null;
      feedback: string;
      strengths: string[];
      targets: string[];
      teacherNotes?: string;
      followUpActions: Array<{ id: string; type: string; prompt: string; required: boolean; status: string }>;
    }>;
    followUpActions: Array<{ id: string; type: string; prompt: string; required: boolean; status: string }>;
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
  const students = new Set(context.participants.map((participant) => participant.id));
  const submissions = new Set(context.participants.flatMap((participant) => participant.submission ? [participant.submission.id] : []));
  const questions = new Set(context.questions.map((question) => question.id));

  try {
    const saved = await prisma.$transaction(async (tx) => {
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
          overallFeedback: entry.overallFeedback,
          strengths: entry.strengths,
          targets: entry.targets,
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
            strengths: question.strengths,
            targets: question.targets,
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
    return { ok: true, message: `Feedback saved as import #${saved.id}. Saved. Import another feedback file to continue.`, payloadHash: importPayloadHash, submittedRawJson: rawJson };
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
