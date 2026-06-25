export type AssignmentImportError = {
  path: string;
  code: string;
  message: string;
};

export type I18nText = { en: string; zh: string } | null;

export type AssignmentImportGlossaryItem = {
  englishTerm: string;
  chineseTerm: string;
  englishDefinition: string;
  chineseDefinition: string;
  termI18n?: I18nText;
  definitionI18n?: I18nText;
  category: string | null;
  questionIds: string[];
};

export type AssignmentImportQuestion = {
  id: string;
  order: number;
  type: "OPEN_TEXT" | "MULTIPLE_CHOICE";
  responseMode: "TEXT" | "PSEUDOCODE";
  prompt: string;
  textI18n?: I18nText;
  points: number | null;
  options: { id: string; text: string; textI18n?: I18nText }[];
  image: { path: string; caption: string; altText: string } | null;
};

export type AssignmentImportAssignment = {
  title: string;
  titleI18n?: I18nText;
  instructions: string;
  instructionsI18n?: I18nText;
  dueDate: string | null;
  status: "DRAFT" | "PUBLISHED";
  questions: AssignmentImportQuestion[];
  keyVocabulary: AssignmentImportGlossaryItem[];
};

export type AssignmentImportParseResult =
  | { ok: true; assignment: AssignmentImportAssignment; errors: [] }
  | { ok: false; assignment: null; errors: AssignmentImportError[] };

export function parseAssignmentImportJson(rawJsonText: string): AssignmentImportParseResult;
export const FORMAT_VERSION: "assignment-import-v1";
export const ALLOWED_STATUSES: Set<string>;
export const ALLOWED_QUESTION_TYPES: Set<string>;
export const ALLOWED_RESPONSE_MODES: Set<string>;
