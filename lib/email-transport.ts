import "server-only";
import { getMailConfig } from "./email-config";

export type MailMessage = { to: string; subject: string; text: string; html: string };

export async function createMailTransport() {
  const config = getMailConfig();
  // The dependency is installed by npm in production and must never enter a client bundle.
  const moduleName = "nodemailer";
  const nodemailer = (await import(moduleName)).default as { createTransport(options: Record<string, unknown>): { verify(): Promise<unknown>; sendMail(message: Record<string, unknown>): Promise<unknown> } };
  const transport = nodemailer.createTransport({ host: config.host, port: config.port, secure: config.secure, requireTLS: config.requireTLS, auth: config.auth });
  return {
    verify: () => transport.verify(),
    send: (message: MailMessage) => transport.sendMail({ ...message, from: config.from }),
  };
}

export function sanitiseMailError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown SMTP failure";
  return message.replace(/(pass(word)?|token|secret|auth)\s*[=:]\s*\S+/gi, "$1=[redacted]").slice(0, 500);
}
