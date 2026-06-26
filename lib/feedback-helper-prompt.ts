const FEEDBACK_HELPER_PROMPT_PREFIX = `Create teacher-review draft feedback for Clarion using only the exported Clarion response JSON below. The teacher will paste your JSON back into Clarion, review it, then release it to students. Return valid importable Clarion feedback JSON only. Do not wrap the answer in Markdown or add commentary. Return JSON only, with no explanatory text before or after it.

Context to use from the export:
- Read assignment.title, assignment.instructions, assignment status/due date, class name, keyVocabulary, ordered questions, question prompts, question points, options, images, participants, submissions, and responsesByQuestionId.
- Treat question prompts, multiple-choice options, key vocabulary, instructions, and image captions/alt text as the available assignment context and expected-answer information. If no explicit expected answer is present, infer only from the question and the student's answer; do not invent a hidden mark scheme.
- Match responsesByQuestionId keys to the exported questions[].id values. Preserve every ID exactly.

Required root object shape and schema:
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
- Preserve assignment id, class id, participant/source participant id, submission id, and question ids exactly from the exported response data. IDs must not be renamed, invented for existing records, converted to strings, translated, or reformatted.
- Do not invent students, submissions, question IDs, responses, or extra unsupported fields.
- For each participant who should receive feedback, include participant.id copied from exported participants[].id, participant.name where available, submission.id copied from that participant's submission.id or submission null, overallFeedback, strengths, targets, questionFeedback when relevant to the response, and followUpActions where appropriate.
__FEEDBACK_LANGUAGE_INSTRUCTION__
- Bilingual i18n text fields use string values. Bilingual i18n strengths/targets fields use arrays of strings for en and zh. Omit missing languages rather than returning empty strings or empty Chinese lines.
- If bilingual feedback is requested, write natural Simplified Chinese suitable for students, not literal machine-style translation. Do not invent translations for IDs or change any IDs.
- Question-level feedback must use exported question IDs exactly and may include strengths, targets, and follow-up actions.
- For pseudocode/code-style questions, questionFeedback may also include optional string fields pseudocodeNotes, syntaxGuidance, and formattingGuidance. Use them only when helpful; do not require them for every question. Existing feedback fields are still required.
- If a participant has no submission, use submission null and avoid question-level feedback unless there is a clear reason.

Pseudocode response guidance:
- Some exported questions use responseMode "PSEUDOCODE" and pseudocodeDialect "CAMBRIDGE_9618_2026". Treat those answers as code-style content and preserve indentation, spacing, line breaks, comments, and the ← assignment arrow when referring to them.
- Cambridge 9618 pseudocode convention reminders: keywords are uppercase; identifiers use mixed case and start with a letter; comments use //; assignment uses ←; common structures include DECLARE, CONSTANT, ARRAY, TYPE, IF/ENDIF, CASE/ENDCASE, FOR/NEXT, REPEAT/UNTIL, WHILE/ENDWHILE, PROCEDURE/ENDPROCEDURE, FUNCTION/ENDFUNCTION, file handling commands, and OOP keywords where relevant.
- Do not rewrite a student's pseudocode unless you are explicitly giving a correction or short example. Separate syntax/formatting guidance from algorithmic logic feedback. Syntax hints are guidance for teacher review, not automatic marks.

Feedback quality guidance:
- Make feedback specific to each student's actual answer and aligned with the assignment questions.
- Keep it concise but useful for school use.
- Focus on strengths, targets, and practical next steps.
- Do not over-praise weak or missing answers; acknowledge effort only when supported by the response.
- Do not be harsh, sarcastic, shaming, or personal.
- Prefer clear classroom language over generic comments.
- Do not assign scores unless the import schema already has a supported field for them; this schema does not require scores.

Follow-up action requirements:
- Every follow-up action requires a stable non-empty string id.
- This applies to participant-level followUpActions and question-level followUpActions.
- Do not omit follow-up action ids, and do not rely on the importer to invent ids.
- Example stable ids: pf1-action1, pf1-q86-action1, pf1-q91-action1.
- Each follow-up action must include id, type, prompt, and required. Add promptI18n with en and zh when bilingual feedback is requested.
- Follow-up action type must be ACKNOWLEDGEMENT, SHORT_REFLECTION, or ANSWER_FOLLOW_UP_QUESTION.
- Use required true unless the action is genuinely optional.

Return valid importable feedback JSON only. After this prompt, paste the exported response JSON.`;


export type FeedbackLanguageMode = "english" | "bilingual";

const FEEDBACK_LANGUAGE_INSTRUCTIONS: Record<FeedbackLanguageMode, string> = {
  english: "- Generate English-only feedback. Keep required English fields and do not require Chinese or i18n feedback fields.",
  bilingual: "- Generate bilingual feedback. Keep all required English fields and add i18n fields with en and zh wherever the schema supports them: overallFeedbackI18n { en, zh }, strengthsI18n { en, zh }, targetsI18n { en, zh }, questionFeedback[].feedbackI18n { en, zh }, questionFeedback[].strengthsI18n { en, zh }, questionFeedback[].targetsI18n { en, zh }, and followUpActions[].promptI18n { en, zh }.",
};

export function buildFeedbackHelperPrompt(languageMode: FeedbackLanguageMode = "english") {
  return FEEDBACK_HELPER_PROMPT_PREFIX.replace("__FEEDBACK_LANGUAGE_INSTRUCTION__", FEEDBACK_LANGUAGE_INSTRUCTIONS[languageMode]);
}

export const FEEDBACK_HELPER_PROMPT = buildFeedbackHelperPrompt("english");

export const FEEDBACK_RESPONSE_JSON_SEPARATOR = "Here is the response export JSON to mark:";

export function buildFullFeedbackPrompt(responseJson: string, languageMode: FeedbackLanguageMode = "english") {
  return `${buildFeedbackHelperPrompt(languageMode)}

${FEEDBACK_RESPONSE_JSON_SEPARATOR}

${responseJson}`;
}

export const FEEDBACK_HELPER_DESCRIPTION =
  "Copy this prompt with the response export, then paste ChatGPT’s JSON back into Clarion. It keeps the manual review-and-release workflow explicit, preserves IDs exactly, and matches the current feedback JSON v1 contract, including optional bilingual feedback fields.";
