import { ClassStatus, Prisma } from "@prisma/client";
import { classCanBePurged, classPurgeConfirmationMatches } from "./class-lifecycle";

type PurgeTransaction = Pick<Prisma.TransactionClient,
  "class" | "classEnrollment" | "homeworkAssignment" | "homeworkQuestion" | "submission" |
  "submissionAnswer" | "feedbackImport" | "participantFeedback" | "questionFeedback" |
  "feedbackFollowUpAction" | "emailNotification" | "curriculumHomeworkLibraryItem">;

export async function purgeClassInTransaction(tx: PurgeTransaction, classId: number, confirmation: string) {
  const target = await tx.class.findUnique({ where: { id: classId }, select: { name: true, status: true } });
  if (!target) throw new Error("This class no longer exists.");
  if (!classCanBePurged(target.status)) throw new Error("Make this class inactive before permanently purging it.");
  if (!classPurgeConfirmationMatches(confirmation, target.name)) {
    throw new Error(`Confirmation did not match. Type DELETE or the exact class name (${target.name}).`);
  }

  const assignmentWhere = { classId };
  const feedbackWhere = { assignment: assignmentWhere };
  const submissionWhere = { assignment: assignmentWhere };
  const notificationWhere = { OR: [{ assignment: assignmentWhere }, { participantFeedback: feedbackWhere }] };
  const counts = {
    enrollments: await tx.classEnrollment.count({ where: { classId } }),
    assignments: await tx.homeworkAssignment.count({ where: assignmentWhere }),
    submissions: await tx.submission.count({ where: submissionWhere }),
    answers: await tx.submissionAnswer.count({ where: { submission: submissionWhere } }),
    feedback: await tx.participantFeedback.count({ where: feedbackWhere }),
    notifications: await tx.emailNotification.count({ where: notificationWhere }),
  };

  await tx.emailNotification.deleteMany({ where: notificationWhere });
  await tx.feedbackFollowUpAction.deleteMany({ where: { participantFeedback: feedbackWhere } });
  await tx.questionFeedback.deleteMany({ where: { participantFeedback: feedbackWhere } });
  await tx.participantFeedback.deleteMany({ where: feedbackWhere });
  await tx.feedbackImport.deleteMany({ where: { assignment: assignmentWhere } });
  await tx.submissionAnswer.deleteMany({ where: { submission: submissionWhere } });
  await tx.submission.deleteMany({ where: submissionWhere });
  await tx.homeworkQuestion.deleteMany({ where: { assignment: assignmentWhere } });
  const assignmentIds = await tx.homeworkAssignment.findMany({ where: assignmentWhere, select: { id: true } });
  await tx.curriculumHomeworkLibraryItem.updateMany({ where: { sourceAssignmentId: { in: assignmentIds.map(({ id }) => id) } }, data: { sourceAssignmentId: null } });
  await tx.homeworkAssignment.deleteMany({ where: assignmentWhere });
  await tx.classEnrollment.deleteMany({ where: { classId } });
  const removed = await tx.class.deleteMany({ where: { id: classId, status: ClassStatus.INACTIVE } });
  if (removed.count !== 1) throw new Error("The class was reactivated or removed by another request. Nothing was purged.");
  return { name: target.name, counts };
}
