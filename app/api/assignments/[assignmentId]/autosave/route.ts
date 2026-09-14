import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserState } from "../../../../../lib/auth";
import { ParticipantSubmissionError, persistParticipantSubmission } from "../../../../../lib/participant-submission";
import { runAutosaveSequentially } from "../../../../../lib/autosave-request-queue";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Promise<{ assignmentId: string }> }) {
  const assignmentId = Number((await context.params).assignmentId);
  if (!Number.isInteger(assignmentId)) return NextResponse.json({ error: "Invalid assignment." }, { status: 400 });

  const { selectedUser } = await getCurrentUserState();
  try {
    const formData = await request.formData();
    const submission = await runAutosaveSequentially(`${selectedUser?.id ?? "anonymous"}:${assignmentId}`, () =>
      persistParticipantSubmission({ assignmentId, formData, student: selectedUser, intent: "AUTOSAVE" }),
    );
    return NextResponse.json({ saved: true, updatedAt: submission.updatedAt.toISOString() });
  } catch (error) {
    if (error instanceof ParticipantSubmissionError) {
      const status = error.code === "FORBIDDEN" ? 403 : error.code === "NOT_FOUND" ? 404 : 409;
      return NextResponse.json({ error: error.message }, { status });
    }
    throw error;
  }
}
