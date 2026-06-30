export const CHATGPT_JSON_QUALITY_CONTROL_REQUIREMENT = `Quality-control requirement before returning:
1. Build the complete JSON object first.
2. Internally check that every { has a matching }, every [ has a matching ], and every array item is separated by a comma.
3. Check that the whole response would succeed with JSON.parse.
4. Do not return the response unless it is valid parseable JSON.
5. Do not include Markdown fences, comments, explanations, trailing commas, or any text outside the JSON object.
6. Prefer flatter structures where valid. Use participant-level followUpActions unless question-level followUpActions are essential.
7. Preserve every ID exactly as provided in the Clarion export.
8. If an attached export file is available, use the full attached file contents rather than relying only on visible pasted text in the chat.`;

export const CHATGPT_RAW_JSON_ONLY_INSTRUCTION =
  "Return raw importable JSON only. No Markdown. No explanation. No comments. No trailing commas.";
