import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ classId: string; assignmentId: string }> };

export default async function FeedbackImportPage({ params }: Props) {
  const { classId, assignmentId } = await params;
  const parsedClassId = Number(classId);
  const parsedAssignmentId = Number(assignmentId);

  if (!Number.isInteger(parsedClassId) || !Number.isInteger(parsedAssignmentId)) {
    notFound();
  }

  redirect(`/classes/${parsedClassId}/assignments/${parsedAssignmentId}/responses#feedback-workflow`);
}
