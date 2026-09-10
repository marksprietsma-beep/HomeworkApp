import "server-only";

export function automaticEmailEnabled() {
  return process.env.EMAIL_NOTIFICATIONS_ENABLED === "true";
}

export function getPublicMailDiagnostics() {
  const required = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "MAIL_FROM_ADDRESS", "APP_BASE_URL"];
  const missing = required.filter((name) => !process.env[name]);
  return {
    automaticEnabled: automaticEmailEnabled(),
    smtpConfigured: missing.length === 0,
    missing,
    senderName: process.env.MAIL_FROM_NAME || "Harrow Haikou Clarion",
    senderAddress: process.env.MAIL_FROM_ADDRESS || null,
    baseUrlIsHttps: process.env.APP_BASE_URL?.startsWith("https://") ?? false,
  };
}

export function getMailConfig() {
  const diagnostics = getPublicMailDiagnostics();
  if (!diagnostics.smtpConfigured) throw new Error(`Email transport is incomplete. Missing: ${diagnostics.missing.join(", ")}.`);
  const port = Number(process.env.SMTP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("SMTP_PORT must be a valid port number.");
  return {
    host: process.env.SMTP_HOST!, port,
    secure: process.env.SMTP_SECURE === "true",
    requireTLS: process.env.SMTP_REQUIRE_TLS !== "false",
    auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASSWORD! },
    from: { name: diagnostics.senderName, address: process.env.MAIL_FROM_ADDRESS! },
  };
}

export function getClarionBaseUrl() {
  const url = process.env.APP_BASE_URL;
  if (!url || !url.startsWith("https://")) throw new Error("APP_BASE_URL must be configured as an HTTPS URL before automatic email can be queued.");
  return url.replace(/\/$/, "");
}
