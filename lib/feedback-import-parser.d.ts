export type FeedbackValidationError = {
  path: string;
  code: string;
  message: string;
};

export type FeedbackImportContext = {
  assignmentId?: number;
  classId?: number;
  assignment?: { id?: number; class?: { id?: number } };
  class?: { id?: number };
  questions?: { id: number }[];
  participants?: {
    id: number;
    submission?: {
      id: number;
      responsesByQuestionId?: Record<string, string>;
    } | null;
  }[];
};

export type NormalizedFeedbackImport = {
  feedbackFormat: "homework-feedback";
  feedbackVersion: 1;
  sourceExport: { exportFormat: "homework-assignment-responses-v2"; exportVersion: 2; generatedAt?: string } | null;
  assignment: { id: number | null; title?: string } | null;
  class: { id: number | null; name?: string } | null;
  generatedBy?: string;
  generatedAt?: string;
  participantFeedback: unknown[];
};

export function parseFeedbackImportJson(rawJsonText: string, context?: FeedbackImportContext):
  | { ok: true; feedback: NormalizedFeedbackImport; errors: [] }
  | { ok: false; feedback: null; errors: FeedbackValidationError[] };

export const FEEDBACK_FORMAT: "homework-feedback";
export const FEEDBACK_VERSION: 1;
export const SOURCE_EXPORT_FORMAT: "homework-assignment-responses-v2";
export const SOURCE_EXPORT_VERSION: 2;
export const FOLLOW_UP_ACTION_TYPES: Set<string>;
export const FOLLOW_UP_ACTION_STATUS: "PENDING";
