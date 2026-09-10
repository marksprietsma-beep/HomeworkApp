import "server-only";
export { createMailTransport } from "./email-outbox-runtime.mjs";
export { sanitiseMailError } from "./email-core.cjs";
export type MailMessage = { to: string; subject: string; text: string; html: string };
