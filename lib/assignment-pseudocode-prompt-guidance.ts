const THREE_BACKTICKS = "```";

export const ASSIGNMENT_PSEUDOCODE_PROMPT_GUIDANCE = String.raw`Pseudocode sample presentation rules:
- The opening delimiter is exactly THREE backtick characters followed immediately by pseudocode: ${THREE_BACKTICKS}pseudocode
- The closing delimiter is exactly THREE backtick characters: ${THREE_BACKTICKS}
- A single backtick is invalid. Two backticks are invalid. Do not substitute inline-code syntax.
- These fences are presentation syntax inside an ordinary JSON prompt string and are independent from responseMode.
- A fenced pseudocode sample in a question prompt does not require a pseudocode answer. Keep responseMode as "TEXT" when students should give prose, a value/result or output, an explanation, identify errors, or provide other ordinary text.
- Preserve indentation. Represent every line break inside the serialized JSON string using \n; do not insert raw line breaks inside a JSON string.
- Apply this rule independently inside textI18n.en and textI18n.zh when either localized prompt contains a multi-line sample.
- Exact serialized JSON example (the response must contain the three literal backticks shown here):
"prompt":"Consider the pseudocode:\n${THREE_BACKTICKS}pseudocode\nDECLARE X : INTEGER\nOUTPUT X\n${THREE_BACKTICKS}\nExplain what the code does."

Strict JSON character rules:
- Do not escape underscores. OPEN_TEXT, MULTIPLE_CHOICE, and CAMBRIDGE_9618_2026 must remain exactly those values.
- Do not escape colons and do not add backslashes before ordinary punctuation. Keep dueDate as normal JSON syntax, for example "dueDate":null.
- Quotes that are part of string content must be JSON-escaped, for example: "prompt":"Store the text \"Ready\" in Status."
- Return strict serialized JSON only. Validate the exact final response using JSON.parse or an equivalent strict parser before returning it.`;

export const ASSIGNMENT_JSON_OUTPUT_INSTRUCTIONS = `Do not wrap the overall JSON response in Markdown fences. Triple-backtick pseudocode fences are permitted only inside JSON string values where required by the pseudocode sample presentation rules. Do not include comments, explanations, trailing commas, or any text outside the root JSON object.

Return raw importable JSON only. Do not wrap the overall response in Markdown. No explanation. No comments. No trailing commas.`;
