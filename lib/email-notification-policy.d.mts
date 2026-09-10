export type StudentIdentity = { role: string; accountStatus: string } | null | undefined;
export function isEligibleStudent<T extends StudentIdentity>(student: T): student is Exclude<T, null | undefined>;
export function isValidRecipientEmail(email: unknown): boolean;
export function shouldQueuePublication(previousStatus: string, nextStatus: string): boolean;
export function shouldQueueFeedback(previousState: string, nextState: string): boolean;
export function notificationTypeEnabled(settings: { homeworkEnabled: boolean; feedbackEnabled: boolean }, type: string): boolean;
export function homeworkIdempotencyKey(assignmentId: number, publicationVersion: number, studentId: number): string;
export function feedbackIdempotencyKey(feedbackId: number, studentId: number): string;
