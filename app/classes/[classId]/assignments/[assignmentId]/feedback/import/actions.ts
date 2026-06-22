"use server";

import { FeedbackFollowUpActionType, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { parseFeedbackImportJson } from "../../../../../../../lib/feedback-import-parser.mjs";
import { getFeedbackImportPageData } from "../../../../../../../lib/feedback-import";
import { getSelectedLocalDevelopmentUser } from "../../../../../../../lib/local-dev-user";
import { prisma } from "../../../../../../../lib/prisma";

type SaveFeedbackImportState = { ok: boolean; message: string };

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
  const context = pageData.context as ImportContext;
  const students = new Set(context.participants.map((participant) => participant.id));
  const submissions = new Set(context.participants.flatMap((participant) => participant.submission ? [participant.submission.id] : []));
  const questions = new Set(context.questions.map((question) => question.id));

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
  return { ok: true, message: `Saved feedback import #${saved.id}. Feedback remains teacher-only until the participant feedback view is implemented.` };
}
