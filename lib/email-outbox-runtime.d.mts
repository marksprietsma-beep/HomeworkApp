/* eslint-disable @typescript-eslint/no-explicit-any */
export const MAX_AUTOMATIC_ATTEMPTS: number;
export const CLAIM_LEASE_MS: number;
export type EmailTransport = { verify(): Promise<unknown>; send(message: { to: string; subject: string; text: string; html: string }): Promise<unknown> };
export function createMailTransport(env?: NodeJS.ProcessEnv): Promise<EmailTransport>;
export function claimNotification(db: any, id: number, options?: { manual?: boolean; now?: Date }): Promise<any | null>;
export function processEmailOutbox(options: { db: any; limit?: number; ids?: number[]; manual?: boolean; transport?: EmailTransport; now?: Date; clock?: () => Date }): Promise<{ processed: number; sent: number; failed: number; skipped: number; message: string }>;
export function sendTestEmail(to: string, options?: { transport?: EmailTransport; env?: NodeJS.ProcessEnv }): Promise<string>;
