export type AssignmentImportError = {
  path: string;
  code: string;
  message: string;
};

export type AssignmentImportGlossaryItem = {
  englishTerm: string;
  chineseTerm: string;
  englishDefinition: string;
  chineseDefinition: string;
  category: string | null;
  questionIds: string[];
};

export type AssignmentImportQuestion = {
  id: string;
  order: number;
  type: "OPEN_TEXT" | "MULTIPLE_CHOICE";
  prompt: string;
  points: number | null;
  options: { id: string; text: string }[];
  image: { path: string; caption: string; altText: string } | null;
};

export type AssignmentImportAssignment = {
  title: string;
  instructions: string;
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
