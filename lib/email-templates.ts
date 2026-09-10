export const TEMPLATE_VARIABLES = ["studentName", "className", "assignmentTitle", "dueDate", "clarionLink"] as const;
export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number];
export type EmailTemplateData = Record<TemplateVariable, string>;

export const DEFAULT_EMAIL_TEMPLATES = {
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
} as const;

const PLACEHOLDER = /{{\s*([^{}]+?)\s*}}/g;

export function validateTemplate(template: string, allowed: readonly TemplateVariable[] = TEMPLATE_VARIABLES) {
  const unknown = [...template.matchAll(PLACEHOLDER)]
    .map((match) => match[1])
    .filter((name) => !allowed.includes(name as TemplateVariable));
  if (unknown.length) throw new Error(`Unsupported template placeholder${unknown.length === 1 ? "" : "s"}: ${[...new Set(unknown)].map((item) => `{{${item}}}`).join(", ")}.`);
  if (template.includes("{{") && ![...template.matchAll(PLACEHOLDER)].length) throw new Error("Template contains an invalid placeholder.");
}

export function renderTemplate(template: string, data: EmailTemplateData) {
  validateTemplate(template);
  return template.replace(PLACEHOLDER, (_match, name: TemplateVariable) => data[name] ?? "").replace(/^\s*\n/gm, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export function renderSafeHtml(text: string, link: string, cta: string) {
  const paragraphs = text.split(/\n\n+/).map((part) => `<p style="margin:0 0 16px;line-height:1.6">${escapeHtml(part).replaceAll("\n", "<br>")}</p>`).join("");
  return `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a"><div style="max-width:640px;margin:24px auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:32px"><div style="font-weight:800;color:#b45309;margin-bottom:24px">CLARION</div>${paragraphs}<a href="${escapeHtml(link)}" style="display:inline-block;background:#f59e0b;color:#0f172a;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:999px">${escapeHtml(cta)}</a></div></body></html>`;
}
