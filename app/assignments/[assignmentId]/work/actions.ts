"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserState } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { studentFeedbackActionAccessWhere } from "../../../../lib/access-control";
import { persistParticipantSubmission } from "../../../../lib/participant-submission";

export async function saveParticipantSubmission(
  assignmentId: number,
  formData: FormData,
) {
  const { selectedUser } = await getCurrentUserState();

  const saveAsDraft = formData.get("submissionIntent") === "DRAFT";
  await persistParticipantSubmission({ assignmentId, formData, student: selectedUser, intent: saveAsDraft ? "DRAFT" : "SUBMITTED" });

  revalidatePath("/");
  revalidatePath(`/assignments/${assignmentId}/work`);
  redirect(`/assignments/${assignmentId}/work?${saveAsDraft ? "draftSaved=1" : "submitted=1"}`);
}


export async function completeFeedbackFollowUpAction(
  assignmentId: number,
  actionId: number,
  formData: FormData,
) {
  const { selectedUser } = await getCurrentUserState();

  if (!selectedUser || selectedUser.role !== "STUDENT") {
    throw new Error("Select a local development participant before saving feedback actions.");
  }

  const action = await prisma.feedbackFollowUpAction.findFirst({
    where: studentFeedbackActionAccessWhere(actionId, assignmentId, selectedUser),
    select: {
      id: true,
      type: true,
      status: true,
    },
  });

  if (!action) {
    throw new Error("Feedback action was not found for the selected participant.");
  }

  if (action.status === "COMPLETED") {
    redirect(`/assignments/${assignmentId}/work?feedbackAction=already-completed#feedback`);
  }

  const rawResponse = formData.get("responseText");
  const responseText = typeof rawResponse === "string" ? rawResponse.trim() : "";

  if (action.type !== "ACKNOWLEDGEMENT" && responseText.length === 0) {
    throw new Error("Write a short response before completing this feedback action.");
  }

  await prisma.feedbackFollowUpAction.update({
    where: { id: action.id },
    data: {
      status: "COMPLETED",
      responseText: action.type === "ACKNOWLEDGEMENT" ? null : responseText,
      completedAt: new Date(),
    },
  });

  revalidatePath(`/assignments/${assignmentId}/work`);
  redirect(`/assignments/${assignmentId}/work?feedbackAction=completed#feedback`);
}
