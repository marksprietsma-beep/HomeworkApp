export function isEligibleStudent(student) {
  return student?.role === "STUDENT" && student.accountStatus === "ACTIVE";
}
export function isValidRecipientEmail(email) {
  return typeof email === "string" && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
export function shouldQueuePublication(previousStatus, nextStatus) {
  return previousStatus !== "PUBLISHED" && nextStatus === "PUBLISHED";
}
export function shouldQueueFeedback(previousState, nextState) {
  return previousState === "DRAFT" && nextState === "RELEASED";
}
export function notificationTypeEnabled(settings, type) {
  return type === "HOMEWORK_PUBLISHED" ? settings.homeworkEnabled : type === "FEEDBACK_RELEASED" ? settings.feedbackEnabled : false;
}
export function homeworkIdempotencyKey(assignmentId, publicationVersion, studentId) {
  return `homework:${assignmentId}:${publicationVersion}:${studentId}`;
}
export function feedbackIdempotencyKey(feedbackId, studentId) {
  return `feedback:${feedbackId}:${studentId}`;
}
