import { PublicationIntent } from "./publication-intent.mjs";

export async function createAssignmentWithIntent(db, data, intent, transitionStatus) {
  const created = await db.homeworkAssignment.create({
    data: { ...data, status: "DRAFT" },
    select: { id: true },
  });
  if (intent === PublicationIntent.PUBLISH) {
    await transitionStatus(db, created.id, "PUBLISHED");
  }
  return created;
}

export async function transitionAssignmentStatusWithNotification(db, assignmentId, status, queuePublication) {
  if (status !== "PUBLISHED") {
    return db.homeworkAssignment.update({ where: { id: assignmentId }, data: { status }, select: { id: true, status: true, publicationVersion: true } });
  }
  const changed = await db.homeworkAssignment.updateMany({ where: { id: assignmentId, status: { not: "PUBLISHED" } }, data: { status, publicationVersion: { increment: 1 } } });
  const assignment = await db.homeworkAssignment.findUniqueOrThrow({ where: { id: assignmentId }, select: { id: true, status: true, publicationVersion: true } });
  if (changed.count === 1) await queuePublication(db, assignment.id, assignment.publicationVersion);
  return assignment;
}

export async function releaseFeedbackWithNotification(db, assignmentId, releasedById, queueReleases, feedbackIds) {
  const drafts = await db.participantFeedback.findMany({ where: { assignmentId, releaseState: "DRAFT", ...(feedbackIds ? { id: { in: feedbackIds } } : {}) }, select: { id: true } });
  if (!drafts.length) return 0;
  const ids = drafts.map(({ id }) => id);
  const result = await db.participantFeedback.updateMany({ where: { assignmentId, id: { in: ids }, releaseState: "DRAFT" }, data: { releaseState: "RELEASED", releasedAt: new Date(), releasedById } });
  if (result.count) await queueReleases(db, ids);
  return result.count;
}

export async function saveFeedbackWithIntent(intent, persistDraft, releasePersisted) {
  const saved = await persistDraft();
  const releasedCount = intent === PublicationIntent.PUBLISH
    ? await releasePersisted(saved.feedbackIds)
    : 0;
  return { ...saved, releasedCount };
}

export function feedbackImportProtection(existingImportId, existingFeedback, confirmReplace) {
  if (existingImportId != null) return { kind: "DUPLICATE", importId: existingImportId };
  if (existingFeedback.length > 0 && !confirmReplace) return { kind: "REPLACE_CONFIRMATION_REQUIRED" };
  return { kind: "PROCEED" };
}
