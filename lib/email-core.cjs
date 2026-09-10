const TEMPLATE_VARIABLES = ["studentName", "className", "assignmentTitle", "dueDate", "clarionLink"];
const DEFAULT_EMAIL_TEMPLATES = Object.freeze({
  homeworkSubject: "New homework: {{assignmentTitle}}",
  homeworkBody: `Hi {{studentName}},

New homework has been assigned to you in {{className}}.

{{assignmentTitle}}
{{dueDate}}

Open Clarion to view the questions and complete your work:
{{clarionLink}}

Harrow Haikou Clarion
This is an automated notification. Please do not reply.`,
  feedbackSubject: "Feedback ready: {{assignmentTitle}}",
  feedbackBody: `Hi {{studentName}},

Your teacher has released feedback for {{assignmentTitle}} in {{className}}.

Open Clarion to view your feedback and any follow-up actions:
{{clarionLink}}

Harrow Haikou Clarion
This is an automated notification. Please do not reply.`,
});
const PLACEHOLDER = /{{\s*([^{}]+?)\s*}}/g;

function validateTemplate(template, allowed = TEMPLATE_VARIABLES) {
  const unknown = [...template.matchAll(PLACEHOLDER)].map((match) => match[1]).filter((name) => !allowed.includes(name));
  if (unknown.length) throw new Error(`Unsupported template placeholder${unknown.length === 1 ? "" : "s"}: ${[...new Set(unknown)].map((item) => `{{${item}}}`).join(", ")}.`);
  if (template.includes("{{") && ![...template.matchAll(PLACEHOLDER)].length) throw new Error("Template contains an invalid placeholder.");
}
function renderTemplate(template, data) {
  validateTemplate(template);
  return template.replace(PLACEHOLDER, (_match, name) => data[name] ?? "").replace(/^\s*\n/gm, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
function escapeHtml(value) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;"); }
function renderSafeHtml(text, link, cta) {
  const paragraphs = text.split(/\n\n+/).map((part) => `<p style="margin:0 0 16px;line-height:1.6">${escapeHtml(part).replaceAll("\n", "<br>")}</p>`).join("");
  return `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a"><div style="max-width:640px;margin:24px auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:32px"><div style="font-weight:800;color:#b45309;margin-bottom:24px">CLARION</div>${paragraphs}<a href="${escapeHtml(link)}" style="display:inline-block;background:#f59e0b;color:#0f172a;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:999px">${escapeHtml(cta)}</a></div></body></html>`;
}
function automaticEmailEnabled(env = process.env) { return env.EMAIL_NOTIFICATIONS_ENABLED === "true"; }
function getPublicMailDiagnostics(env = process.env) {
  const required = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "MAIL_FROM_ADDRESS", "APP_BASE_URL"];
  const missing = required.filter((name) => !env[name]);
  const problems = missing.map((name) => `${name} is not configured.`);
  let baseUrlIsHttps = false;
  if (env.APP_BASE_URL) {
    try { const url = new URL(env.APP_BASE_URL); baseUrlIsHttps = url.protocol === "https:" && Boolean(url.hostname); } catch { /* reported below */ }
    if (!baseUrlIsHttps) problems.push("APP_BASE_URL must be a valid HTTPS URL.");
  }
  if (env.SMTP_PORT && (!Number.isInteger(Number(env.SMTP_PORT)) || Number(env.SMTP_PORT) < 1 || Number(env.SMTP_PORT) > 65535)) problems.push("SMTP_PORT must be a valid port number.");
  const timeZone = env.SCHOOL_TIME_ZONE || "Asia/Shanghai";
  try { new Intl.DateTimeFormat("en-GB", { timeZone }).format(new Date(0)); } catch { problems.push("SCHOOL_TIME_ZONE must be a valid IANA time zone."); }
  return { automaticEnabled: automaticEmailEnabled(env), smtpConfigured: missing.filter((name) => name.startsWith("SMTP_") || name === "MAIL_FROM_ADDRESS").length === 0, configurationValid: problems.length === 0, missing, problems, senderName: env.MAIL_FROM_NAME || "Harrow Haikou Clarion", senderAddress: env.MAIL_FROM_ADDRESS || null, baseUrlIsHttps, schoolTimeZone: timeZone };
}
function getMailConfig(env = process.env) {
  const diagnostics = getPublicMailDiagnostics(env);
  if (!diagnostics.smtpConfigured) throw new Error(`Email transport is incomplete. Missing: ${diagnostics.missing.join(", ")}.`);
  const port = Number(env.SMTP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("SMTP_PORT must be a valid port number.");
  return { host: env.SMTP_HOST, port, secure: env.SMTP_SECURE === "true", requireTLS: env.SMTP_REQUIRE_TLS !== "false", auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }, from: { name: diagnostics.senderName, address: env.MAIL_FROM_ADDRESS } };
}
function getAutomaticNotificationPreparation(env = process.env) {
  const diagnostics = getPublicMailDiagnostics(env);
  if (!diagnostics.configurationValid) return { ok: false, error: `Automatic email skipped: ${diagnostics.problems.join(" ")}` };
  return { ok: true, baseUrl: new URL(env.APP_BASE_URL).toString().replace(/\/$/, "") };
}
function sanitiseMailError(error) {
  const message = error instanceof Error ? error.message : "Unknown SMTP failure";
  return message.replace(/(pass(word)?|token|secret|auth)\s*[=:]\s*\S+/gi, "$1=[redacted]").slice(0, 500);
}
function formatSchoolDueDate(date, env = process.env) {
  const timeZone = env.SCHOOL_TIME_ZONE || "Asia/Shanghai";
  try {
    return `Due: ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone }).format(date)} (${timeZone})`;
  } catch {
    throw new Error("SCHOOL_TIME_ZONE must be a valid IANA time zone.");
  }
}

module.exports = { TEMPLATE_VARIABLES, DEFAULT_EMAIL_TEMPLATES, validateTemplate, renderTemplate, renderSafeHtml, automaticEmailEnabled, getPublicMailDiagnostics, getMailConfig, getAutomaticNotificationPreparation, sanitiseMailError, formatSchoolDueDate };
