import "server-only";
import { prisma } from "./prisma";
import { processEmailOutbox as processSharedOutbox, type EmailTransport } from "./email-outbox-runtime.mjs";
export { CLAIM_LEASE_MS, MAX_AUTOMATIC_ATTEMPTS, claimNotification } from "./email-outbox-runtime.mjs";

export function processEmailOutbox(options: { limit?: number; ids?: number[]; manual?: boolean; transport?: EmailTransport; now?: Date } = {}) {
  return processSharedOutbox({ ...options, db: prisma });
}
