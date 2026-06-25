import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type ResponseExportPageProps = {
  params: Promise<{
    classId: string;
    assignmentId: string;
  }>;
};

export default async function ResponseExportPage({
  params,
}: ResponseExportPageProps) {
  const { classId, assignmentId } = await params;
  const parsedClassId = Number(classId);
  const parsedAssignmentId = Number(assignmentId);

  if (!Number.isInteger(parsedClassId) || !Number.isInteger(parsedAssignmentId)) {
    notFound();
  }

  redirect(`/classes/${parsedClassId}/assignments/${parsedAssignmentId}/responses#feedback-workflow`);
}
