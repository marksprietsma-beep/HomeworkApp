import "server-only";
export { automaticEmailEnabled, getMailConfig, getPublicMailDiagnostics } from "./email-core.cjs";

export function getClarionBaseUrl() {
  const url = process.env.APP_BASE_URL;
  if (!url || !url.startsWith("https://")) throw new Error("APP_BASE_URL must be configured as an HTTPS URL before automatic email can be queued.");
  return url.replace(/\/$/, "");
}
