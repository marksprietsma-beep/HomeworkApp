/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PublicationIntentValue } from "./publication-intent.mjs";

type AssignmentDb = { homeworkAssignment: { create(args: unknown): Promise<{ id: number }> } };
export function createAssignmentWithIntent(db: AssignmentDb, data: Record<string, unknown>, intent: PublicationIntentValue, transitionStatus: (db: any, id: number, status: "PUBLISHED") => Promise<unknown>): Promise<{ id: number }>;
export function transitionAssignmentStatusWithNotification(db: any, assignmentId: number, status: string, queuePublication: (db: any, id: number, version: number) => Promise<unknown>): Promise<any>;
export function releaseFeedbackWithNotification(db: any, assignmentId: number, releasedById: number, queueReleases: (db: any, ids: number[]) => Promise<unknown>, feedbackIds?: number[]): Promise<number>;
export function saveFeedbackWithIntent<T extends { feedbackIds: number[] }>(intent: PublicationIntentValue, persistDraft: () => Promise<T>, releasePersisted: (ids: number[]) => Promise<number>): Promise<T & { releasedCount: number }>;
export function feedbackImportProtection(existingImportId: number | null, existingFeedback: unknown[], confirmReplace: boolean): { kind: "DUPLICATE"; importId: number } | { kind: "REPLACE_CONFIRMATION_REQUIRED" } | { kind: "PROCEED" };
