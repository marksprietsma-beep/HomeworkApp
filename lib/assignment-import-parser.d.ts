export type AssignmentImportError = { path: string; code: string; message: string };
export type AssignmentImportQuestion = {
  id: string; order: number; type: "OPEN_TEXT" | "MULTIPLE_CHOICE";
  responseMode: "TEXT" | "PSEUDOCODE" | "STRUCTURED";
  pseudocodeDialect: "CAMBRIDGE_9618_2026" | null; prompt: string;
  textI18n: { en: string; zh: string } | null; points: number | null;
  options: { id: string; text: string; textI18n: { en: string; zh: string } | null }[];
  image: { path: string; caption: string; altText: string } | null; responseSchema: unknown | null;
};
export type ParsedAssignmentImport = { title: string; titleI18n: unknown; instructions: string; instructionsI18n: unknown; dueDate: string | null; status: "DRAFT" | "PUBLISHED"; questions: AssignmentImportQuestion[]; keyVocabulary: unknown[] };
export type AssignmentImportResult = { ok: true; assignment: ParsedAssignmentImport; errors: []; repaired?: boolean; repairedJson?: string } | { ok: false; assignment: null; errors: AssignmentImportError[] };
export function parseAssignmentImportJson(rawJsonText: string): AssignmentImportResult;
export function normalizeSingleBacktickPseudocodeFences(value: string): string;
export const FORMAT_VERSION: "assignment-import-v1";
export const FORMAT_VERSION_V2: "assignment-import-v2";
export const ALLOWED_STATUSES: Set<string>; export const ALLOWED_QUESTION_TYPES: Set<string>; export const ALLOWED_RESPONSE_MODES: Set<string>; export const ALLOWED_PSEUDOCODE_DIALECTS: Set<string>;
