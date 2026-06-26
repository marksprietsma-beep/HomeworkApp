# Clarion ChatGPT JSON guidance

Use this guide when a teacher asks an external/custom GPT to produce Clarion-compatible assignment JSON or feedback JSON. Clarion is local-first: it does **not** send student data directly to ChatGPT or OpenAI. Teachers manually copy prompts/exports to ChatGPT, manually paste returned JSON back into Clarion, review draft feedback, and then release feedback to students.

When importable output is requested, return raw valid JSON only: no Markdown fence, no commentary, no trailing commas.

## Assignment import JSON (`assignment-import-v1`)

Top-level shape:

```json
{
  "formatVersion": "assignment-import-v1",
  "assignment": {
    "title": "...",
    "titleI18n": { "en": "...", "zh": "..." },
    "instructions": "...",
    "instructionsI18n": { "en": "...", "zh": "..." },
    "dueDate": null,
    "status": "DRAFT",
    "questions": [],
    "keyVocabulary": []
  }
}
```

Required assignment fields are `title`, `instructions`, `status`, and a non-empty `questions` array. `formatVersion` must be exactly `assignment-import-v1`. `status` must be `DRAFT` or `PUBLISHED`. `dueDate` is optional and must be a real `YYYY-MM-DD` date or `null`.

Keep `instructions` concise and student-facing. Do not copy teacher planning notes, syllabus metadata, question mix notes, or prompt instructions into it.

### Question fields

Supported question types are:

- `OPEN_TEXT`: any written response, including short answer, longer explanation, evaluation, trace/debug explanations, and pseudocode/code-style answers.
- `MULTIPLE_CHOICE`: a choice question with at least two `options`.

Each question requires:

- `id`: stable non-empty string such as `q1`. IDs only need to be unique inside the imported assignment.
- `order`: positive integer. Orders must be sequential starting at `1`.
- `type`: `OPEN_TEXT` or `MULTIPLE_CHOICE`.
- `prompt` (or `text`): non-empty student-facing prompt.

Optional question fields:

- `textI18n`: `{ "en": "...", "zh": "..." }` for bilingual prompt text.
- `points`: positive integer.
- `image`: `{ "path": "...", "caption": "...", "altText": "..." }`; metadata only, no binary data.
- `responseMode`: `TEXT` or `PSEUDOCODE`.
- `pseudocodeDialect`: currently `CAMBRIDGE_9618_2026`.

`MULTIPLE_CHOICE` questions must include `options`, each with stable string `id`, `text`, and optional `textI18n`. Do not add `options` to `OPEN_TEXT` questions.

### Bilingual fields

Clarion supports optional English/Chinese fields with `en` and `zh` keys:

- `assignment.titleI18n`
- `assignment.instructionsI18n`
- `questions[].textI18n`
- `questions[].options[].textI18n`
- glossary `termI18n` and `definitionI18n`

Keep required English fields even when adding Chinese. Use natural Simplified Chinese; do not translate IDs.

### Key vocabulary / glossary

Use either `keyVocabulary` or `glossary`, not both. Entries may include:

- `englishTerm` and `englishDefinition` (required)
- `chineseTerm`, `chineseDefinition`
- `termI18n`, `definitionI18n`
- `category`
- `questionIds` linking to assignment question IDs

## Pseudocode question metadata

Use:

```json
"responseMode": "PSEUDOCODE",
"pseudocodeDialect": "CAMBRIDGE_9618_2026"
```

only when students are expected to write, complete, trace, debug, or explain pseudocode/code-style answers and the answer box benefits from preserved code formatting. Do **not** add pseudocode metadata to ordinary prose, short-answer, or explanation-only questions unless the answer is genuinely code-style.

Cambridge 9618 pseudocode conventions:

- Keywords uppercase.
- Identifiers mixed case and starting with a letter.
- Comments use `//`.
- Assignment uses `←`.
- Preserve indentation and line breaks.
- Common structures include `DECLARE`, `CONSTANT`, `ARRAY`, `TYPE`, `IF`/`ENDIF`, `CASE`/`ENDCASE`, `FOR`/`NEXT`, `REPEAT`/`UNTIL`, `WHILE`/`ENDWHILE`, `PROCEDURE`/`ENDPROCEDURE`, `FUNCTION`/`ENDFUNCTION`, file handling commands, and OOP keywords where relevant.

## Assignment examples

### Standard short-answer/open-text homework

```json
{
  "formatVersion": "assignment-import-v1",
  "assignment": {
    "title": "Binary numbers practice",
    "instructions": "Answer all questions. Show working where appropriate.",
    "dueDate": null,
    "status": "DRAFT",
    "questions": [
      { "id": "q1", "order": 1, "type": "OPEN_TEXT", "prompt": "Convert 101101₂ to denary.", "points": 2 },
      { "id": "q2", "order": 2, "type": "MULTIPLE_CHOICE", "prompt": "Which denary value equals 1111₂?", "points": 1, "options": [
        { "id": "a", "text": "14" },
        { "id": "b", "text": "15" },
        { "id": "c", "text": "16" }
      ] }
    ]
  }
}
```

### Bilingual assignment

```json
{
  "formatVersion": "assignment-import-v1",
  "assignment": {
    "title": "Logic gates recap",
    "titleI18n": { "en": "Logic gates recap", "zh": "逻辑门复习" },
    "instructions": "Answer each question in full sentences.",
    "instructionsI18n": { "en": "Answer each question in full sentences.", "zh": "请用完整句子回答每一道题。" },
    "status": "DRAFT",
    "questions": [
      { "id": "q1", "order": 1, "type": "OPEN_TEXT", "prompt": "Describe the output of an AND gate.", "textI18n": { "en": "Describe the output of an AND gate.", "zh": "描述 AND 门的输出。" } }
    ],
    "keyVocabulary": [
      { "englishTerm": "AND gate", "chineseTerm": "与门", "englishDefinition": "Outputs 1 only when all inputs are 1.", "chineseDefinition": "只有当所有输入为 1 时才输出 1。", "questionIds": ["q1"] }
    ]
  }
}
```

### Cambridge 9618 pseudocode loops

```json
{
  "formatVersion": "assignment-import-v1",
  "assignment": {
    "title": "Cambridge 9618 pseudocode loops",
    "instructions": "Write pseudocode using Cambridge 9618 conventions. Preserve indentation.",
    "status": "DRAFT",
    "questions": [
      { "id": "q1", "order": 1, "type": "OPEN_TEXT", "prompt": "Write pseudocode that inputs 10 test scores and outputs their total.", "points": 5, "responseMode": "PSEUDOCODE", "pseudocodeDialect": "CAMBRIDGE_9618_2026" },
      { "id": "q2", "order": 2, "type": "OPEN_TEXT", "prompt": "Complete a WHILE loop that repeatedly inputs values until -1 is entered, then outputs the count of values entered.", "points": 6, "responseMode": "PSEUDOCODE", "pseudocodeDialect": "CAMBRIDGE_9618_2026" }
    ]
  }
}
```

### Arrays and records pseudocode

```json
{
  "formatVersion": "assignment-import-v1",
  "assignment": {
    "title": "Arrays and records",
    "instructions": "Use Cambridge 9618 pseudocode for code-style answers.",
    "status": "DRAFT",
    "questions": [
      { "id": "q1", "order": 1, "type": "OPEN_TEXT", "prompt": "Declare a one-dimensional array named Scores that stores 30 INTEGER values.", "responseMode": "PSEUDOCODE", "pseudocodeDialect": "CAMBRIDGE_9618_2026" },
      { "id": "q2", "order": 2, "type": "OPEN_TEXT", "prompt": "Define a record type StudentRecord with Name as STRING and Mark as INTEGER, then declare one variable of that type.", "responseMode": "PSEUDOCODE", "pseudocodeDialect": "CAMBRIDGE_9618_2026" }
    ]
  }
}
```

## Feedback import JSON (`homework-feedback` v1)

When a teacher pastes exported response JSON, produce feedback based only on that export. Preserve all IDs exactly.

Top-level shape:

```json
{
  "feedbackFormat": "homework-feedback",
  "feedbackVersion": 1,
  "sourceExport": { "exportFormat": "homework-assignment-responses-v2", "exportVersion": 2, "generatedAt": "..." },
  "assignment": { "id": 123, "title": "..." },
  "class": { "id": 45, "name": "..." },
  "generatedBy": "ChatGPT",
  "generatedAt": "2026-06-26T00:00:00.000Z",
  "participantFeedback": []
}
```

Each `participantFeedback` item must include:

- `participant`: copied from exported `participants[].id`, with optional `name` and `email`.
- `submission`: copied submission object with `id` and optional `status`, or `null` for no submission.
- `overallFeedback`: non-empty student-facing string.
- `strengths`: non-empty array of strings.
- `targets`: non-empty array of strings.

Optional participant fields include `overallFeedbackI18n`, `strengthsI18n`, `targetsI18n`, `teacherNotes`, `questionFeedback`, and `followUpActions`.

Question feedback items may include:

- `questionId`: copied exported question ID.
- `questionOrder`: exported order when useful.
- `feedback`: non-empty string.
- Optional `strengths`, `targets`, `teacherNotes`, i18n variants, and `followUpActions`.
- Optional pseudocode-specific strings: `pseudocodeNotes`, `syntaxGuidance`, `formattingGuidance`. Use only when helpful and only for code-style/pseudocode responses.

Follow-up actions require unique stable string `id`, `type` (`ACKNOWLEDGEMENT`, `SHORT_REFLECTION`, or `ANSWER_FOLLOW_UP_QUESTION`), `prompt`, and `required`.

For pseudocode feedback, preserve snippets, indentation, line breaks, comments, and `←`. Separate syntax/formatting comments from algorithmic logic comments. Syntax hints are guidance, not automatic marks. Do not rewrite the student's pseudocode unless giving a correction or example.

## Failure modes to avoid

- Do not wrap raw JSON in Markdown when importable JSON is requested.
- Do not add trailing commas.
- Do not invent unsupported fields.
- Do not change IDs from exported response JSON.
- Do not lose pseudocode indentation.
- Do not replace `←` with `=` in pseudocode.
- Do not mark algorithmic correctness purely from syntax.
- Do not add pseudocode metadata to normal prose questions.
