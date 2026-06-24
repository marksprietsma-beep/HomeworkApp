export const FEEDBACK_HELPER_PROMPT = `Use the exported Clarion response JSON below as the only source data. Return valid importable Clarion feedback JSON only. Do not wrap the answer in Markdown or add commentary. Return JSON only, with no explanatory text before or after it.

Required root object shape:
- feedbackFormat
- feedbackVersion
- sourceExport
- assignment
- class
- participantFeedback

Feedback import contract:
- Use feedbackFormat "homework-feedback" and feedbackVersion 1.
- Copy sourceExport.exportFormat, sourceExport.exportVersion, and sourceExport.generatedAt from the export.
- The assignment object must be at the root and include the exported assignment.id exactly. Include assignment.title where available.
- The class object must be at the root and include the exported assignment.class.id exactly. Include assignment.class.name where available.
- The participantFeedback array must be at the root. Use participantFeedback, not participants.
- Do not return root-level participants.
- Do not rename participantFeedback to participants.
- Do not nest class inside assignment. Do not return assignment.class. Use root-level class instead.
- Preserve assignment id, class id, participant/source participant id, submission id, and question ids exactly from the exported response data. IDs must not be renamed, invented for existing records, or converted to strings.
- For each participant who should receive feedback, include participant.id copied from exported participants[].id, participant.name where available, submission.id copied from that participant's submission.id or submission null, overallFeedback, strengths, targets, questionFeedback where useful, and followUpActions where appropriate.
- English-only feedback remains valid. When bilingual feedback is requested, keep the existing English fields and additionally include optional i18n fields: overallFeedbackI18n { en, zh }, strengthsI18n { en, zh }, targetsI18n { en, zh }, questionFeedback[].feedbackI18n { en, zh }, questionFeedback[].strengthsI18n { en, zh }, questionFeedback[].targetsI18n { en, zh }, and followUpActions[].promptI18n { en, zh } where useful.
- Bilingual i18n text fields use string values. Bilingual i18n strengths/targets fields use arrays of strings for en and zh. Omit missing languages rather than returning empty strings or empty Chinese lines.
- If you include Chinese, write natural Simplified Chinese for students, not literal machine-style translation. Do not invent translations for IDs or change any IDs.
- Question-level feedback must use exported question IDs exactly and may include strengths, targets, and follow-up actions.
- If a participant has no submission, use submission null and avoid question-level feedback unless there is a clear reason.

Follow-up action requirements:
- Every follow-up action requires a stable non-empty string id.
- This applies to participant-level followUpActions and question-level followUpActions.
- Do not omit follow-up action ids, and do not rely on the importer to invent ids.
- Example stable ids: pf1-action1, pf1-q86-action1, pf1-q91-action1.
- Each follow-up action must include id, type, prompt, and required. It may also include promptI18n when bilingual feedback is requested.
- Follow-up action type must be ACKNOWLEDGEMENT, SHORT_REFLECTION, or ANSWER_FOLLOW_UP_QUESTION.
- Use required true unless the action is genuinely optional.

Return valid importable feedback JSON only. After this prompt, paste the exported response JSON.`;

export const FEEDBACK_RESPONSE_JSON_SEPARATOR = "Here is the response export JSON to mark:";

export function buildFullFeedbackPrompt(responseJson: string) {
  return `${FEEDBACK_HELPER_PROMPT}

${FEEDBACK_RESPONSE_JSON_SEPARATOR}

${responseJson}`;
}

export const FEEDBACK_HELPER_DESCRIPTION =
  "Copy this prompt with the response export. It keeps the manual ChatGPT export/import workflow explicit, preserves IDs, and matches the current feedback JSON contract, including optional bilingual feedback fields.";
