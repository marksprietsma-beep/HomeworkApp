export { DEFAULT_EMAIL_TEMPLATES, formatSchoolDueDate, renderSafeHtml, renderTemplate, TEMPLATE_VARIABLES, validateTemplate } from "./email-core.cjs";
export type TemplateVariable = "studentName" | "className" | "assignmentTitle" | "dueDate" | "clarionLink";
export type EmailTemplateData = Record<TemplateVariable, string>;
