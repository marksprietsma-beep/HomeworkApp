# ChatGPT assignment import JSON v1

This document defines the stable JSON shape that ChatGPT should generate for assignment import. The format is intentionally small, paste-friendly, and easy for a future parser to validate.

## Prompt snippet for ChatGPT

Mark can paste this into ChatGPT when asking it to create an assignment:

> Return only valid JSON using the Homework App assignment import JSON v1 format. Do not wrap it in Markdown. Use this root shape: `formatVersion`, `assignment`. Use my teacher generation context to create the homework, but do not copy teacher choices, syllabus notes, question mix, difficulty, marks expectations, glossary choices, or other prompt metadata into `assignment.instructions`. The assignment must include `title`, `instructions`, `status`, and ordered `questions`. `assignment.instructions` must be concise and student-facing, for example: “Answer all questions. Show your working where appropriate. Use full sentences for explanation questions.” `dueDate` is optional and must be `YYYY-MM-DD` or `null`. Status must be `DRAFT` or `PUBLISHED`. Question types must be `OPEN_TEXT` or `MULTIPLE_CHOICE`. Use `OPEN_TEXT` for any written answer, including longer explanation or evaluation questions. Questions may include optional `points` as a positive integer. Multiple choice questions must include an `options` array with stable string `id` values and `text` values. Optional question images use an `image` object with `path`, `caption`, and `altText`.

## Stable root shape

```json
{
  "formatVersion": "assignment-import-v1",
  "assignment": {
    "title": "string",
    "instructions": "string",
    "dueDate": "YYYY-MM-DD or null",
    "status": "DRAFT or PUBLISHED",
    "questions": [
      {
        "id": "q1",
        "order": 1,
        "type": "OPEN_TEXT",
        "prompt": "string",
        "points": 1,
        "image": {
          "path": "string",
          "caption": "string",
          "altText": "string"
        }
      }
    ]
  }
}
```

### Root fields

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `formatVersion` | Yes | string | Must be exactly `assignment-import-v1`. This lets later versions change safely. |
| `assignment` | Yes | object | Contains the assignment to import. |

### Assignment fields

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `title` | Yes | string | Short teacher-facing assignment title. Must not be empty after trimming. |
| `instructions` | Yes | string | Concise student-facing assignment instructions. Must not be empty after trimming. Do not include teacher generation context, syllabus notes, question mix, difficulty, marks expectations, or glossary choices here. |
| `dueDate` | No | string or null | Optional local due date in `YYYY-MM-DD` format. Use `null` or omit the field when there is no due date. Do not include times or time zones in v1. |
| `status` | Yes | string | Must be `DRAFT` or `PUBLISHED`. ChatGPT should normally use `DRAFT` unless Mark asks for a published assignment. |
| `questions` | Yes | array | Ordered list of questions. Must contain at least one question. |

`ARCHIVED` exists in the app data model, but imports should not create archived assignments in v1.

### Question fields

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `id` | Yes | string | Stable question ID inside this JSON document, such as `q1`, `q2`, `q3`. Must be unique within the assignment. |
| `order` | Yes | integer | 1-based display order. Must be unique and sequential with no gaps. |
| `type` | Yes | string | Must be `OPEN_TEXT` or `MULTIPLE_CHOICE`. |
| `prompt` | Yes | string | Student-facing question prompt. Must not be empty after trimming. |
| `points` | No | integer | Optional point value for this question. When present, it must be a positive integer. |
| `options` | Required only for `MULTIPLE_CHOICE` | array | Array of option objects. Must be omitted for `OPEN_TEXT`. |
| `image` | No | object or null | Optional image reference metadata. This is only a reference; v1 does not upload or store image files. |

Use `OPEN_TEXT` for any written answer, including longer explanation or evaluation questions, and `MULTIPLE_CHOICE` when the student should select one option.

### Multiple choice option fields

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `id` | Yes | string | Stable option ID within the question, such as `a`, `b`, `c`, `d`. Must be unique within that question. |
| `text` | Yes | string | Student-facing option text. Must not be empty after trimming. |

The v1 contract includes optional per-question `points`, but does not include a correct answer, rubric, or automatic scoring field. If ChatGPT includes those fields, MAR-120 should reject them or ignore them according to the parser decision documented at implementation time.

### Image reference fields

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `path` | Yes, when `image` is present | string | Paste-friendly reference such as `images/cell-diagram.png`, `worksheet page 2`, or `teacher-provided image A`. Must not be empty after trimming. |
| `caption` | No | string | Optional visible caption for the student. |
| `altText` | No | string | Optional accessibility description. Strongly recommended whenever an image is referenced. |

The image object is metadata only. It should not contain base64 data, external file uploads, or binary content.

## Complete valid example

The documented valid example below is mirrored in [`docs/fixtures/assignment-import/valid/fractions-check.json`](fixtures/assignment-import/valid/fractions-check.json). Run `npm run check:assignment-json-fixtures` after changing it so the fixture file and this documentation stay in sync.

<!-- fixture: docs/fixtures/assignment-import/valid/fractions-check.json -->
```json
{
  "formatVersion": "assignment-import-v1",
  "assignment": {
    "title": "Year 7 Fractions Check",
    "instructions": "Answer each question carefully. Show your working for written responses.",
    "dueDate": "2026-07-03",
    "status": "DRAFT",
    "questions": [
      {
        "id": "q1",
        "order": 1,
        "type": "OPEN_TEXT",
        "prompt": "Write one equivalent fraction for 1/2.",
        "points": 1
      },
      {
        "id": "q2",
        "order": 2,
        "type": "OPEN_TEXT",
        "prompt": "Explain how to compare 3/4 and 5/8 without using a calculator.",
        "image": {
          "path": "teacher-provided fraction wall image",
          "caption": "Fraction wall for comparison",
          "altText": "A fraction wall showing halves, quarters, eighths, and other equal partitions."
        },
        "points": 3
      },
      {
        "id": "q3",
        "order": 3,
        "type": "MULTIPLE_CHOICE",
        "prompt": "Which fraction is equal to 0.25?",
        "options": [
          {
            "id": "a",
            "text": "1/2"
          },
          {
            "id": "b",
            "text": "1/3"
          },
          {
            "id": "c",
            "text": "1/4"
          },
          {
            "id": "d",
            "text": "3/4"
          }
        ],
        "points": 1
      }
    ]
  }
}
```

## Invalid examples

The invalid examples below are still parseable JSON, but they intentionally violate the v1 import contract. They are mirrored in fixture files and are checked by `npm run check:assignment-json-fixtures`.

### Invalid example: contract violations

This example is mirrored in [`docs/fixtures/assignment-import/invalid/contract-violations.json`](fixtures/assignment-import/invalid/contract-violations.json).

<!-- fixture: docs/fixtures/assignment-import/invalid/contract-violations.json -->
```json
{
  "formatVersion": "assignment-import-v1",
  "assignment": {
    "title": "Broken assignment",
    "instructions": "This example should fail validation.",
    "dueDate": "next Friday",
    "status": "READY",
    "questions": [
      {
        "id": "q1",
        "order": 1,
        "type": "MULTIPLE_CHOICE",
        "prompt": "Pick one.",
        "options": [
          {
            "id": "a",
            "text": "First answer"
          },
          {
            "id": "a",
            "text": "Duplicate option id"
          }
        ]
      },
      {
        "id": "q1",
        "order": 3,
        "type": "SHORT_TEXT",
        "prompt": "This uses an unsupported type.",
        "points": 0
      }
    ]
  }
}
```

This example is invalid because:

- `dueDate` is not in `YYYY-MM-DD` format.
- `status` is not `DRAFT` or `PUBLISHED`.
- Question IDs are duplicated.
- Question orders skip `2`, so they are not sequential.
- `SHORT_TEXT` is not a supported v1 question type.
- Question points must be positive integers when present.
- The multiple choice option ID `a` is duplicated within `q1`.

### Invalid example: text question with options

This example is mirrored in [`docs/fixtures/assignment-import/invalid/text-question-with-options.json`](fixtures/assignment-import/invalid/text-question-with-options.json).

<!-- fixture: docs/fixtures/assignment-import/invalid/text-question-with-options.json -->
```json
{
  "formatVersion": "assignment-import-v1",
  "assignment": {
    "title": "Text question with options",
    "instructions": "This example is JSON but violates the v1 contract.",
    "dueDate": null,
    "status": "DRAFT",
    "questions": [
      {
        "id": "q1",
        "order": 1,
        "type": "OPEN_TEXT",
        "prompt": "Explain your thinking in one sentence.",
        "options": [
          {
            "id": "a",
            "text": "This should not be here."
          },
          {
            "id": "b",
            "text": "Neither should this."
          }
        ],
        "image": {
          "path": "images/number-line.png",
          "caption": "Number line reference",
          "altText": "A number line from zero to one marked in quarters."
        },
        "points": 2
      }
    ]
  }
}
```

This example is invalid because:

- `OPEN_TEXT` questions must not include `options`.
- Image reference metadata is present and parseable, but the question still fails the contract because options only belong on `MULTIPLE_CHOICE` questions.

## Parser implementation

MAR-120 adds reusable parser logic in `lib/assignment-import-parser.mjs`. Call `parseAssignmentImportJson(rawJsonText)` with the raw pasted JSON string. The parser safely parses JSON, validates the v1 contract, and returns one of these result shapes:

```js
{ ok: true, assignment, errors: [] }
{ ok: false, assignment: null, errors: [{ path, code, message }] }
```

The normalised `assignment` trims string fields, converts an omitted `dueDate` to `null`, sorts questions by `order`, keeps optional `points` as a positive integer or `null`, returns text-question `options` as an empty array, and normalises optional image metadata without uploading or storing files.

The parser rejects unknown fields in the root, assignment, question, option, and image objects. This is intentional for v1 so unexpected ChatGPT output is visible before the paste workflow creates database records.

Run the parser fixture check locally with:

```bash
npm run check:assignment-json-fixtures
```

## Fixture smoke check

Run the fixture quality gate locally with:

```bash
npm run check:assignment-json-fixtures
```

The check parses every valid and invalid fixture as JSON, requires the valid fixtures to pass a small structural smoke check, requires the invalid fixtures to fail that smoke check, and compares the fenced examples in this document with their fixture files. This is deliberately not the full MAR-120 parser and does not write database records.

## Validation rules for MAR-120

MAR-120 should enforce these rules before writing anything to the database:

1. The pasted content must parse as JSON and the root value must be an object.
2. `formatVersion` must exist and equal `assignment-import-v1`.
3. `assignment` must exist and be an object.
4. Reject unknown root fields and unknown assignment, question, option, or image fields unless MAR-120 explicitly documents a more permissive policy.
5. `assignment.title` and `assignment.instructions` must be strings with non-empty trimmed values.
6. `assignment.dueDate` may be omitted or `null`; when present as a string, it must match `YYYY-MM-DD` and represent a real calendar date.
7. `assignment.status` must be `DRAFT` or `PUBLISHED`.
8. `assignment.questions` must be a non-empty array.
9. Every question must be an object with `id`, `order`, `type`, and `prompt`.
10. Question `id` values must be non-empty strings and unique within the assignment.
11. Question `order` values must be integers, unique, start at `1`, and be sequential with no gaps.
12. Question `type` must be one of `OPEN_TEXT` or `MULTIPLE_CHOICE`.
13. Question `prompt` values must be strings with non-empty trimmed values.
14. Optional question `points` must be a positive integer when present.
15. `OPEN_TEXT` questions must not include `options`.
16. `MULTIPLE_CHOICE` questions must include an `options` array with at least two options.
17. Every option must be an object with non-empty string `id` and non-empty string `text`.
18. Option `id` values must be unique within their question.
19. If `image` is omitted or `null`, the question has no image reference.
20. If `image` is present, it must be an object with a non-empty string `path`.
21. `image.caption` and `image.altText` may be omitted, but when present they must be strings.
22. The parser should trim string fields before saving where that does not change meaning.
23. The parser should map `assignment.instructions` to the existing assignment description field unless a later issue adds a dedicated instructions column.
24. The parser should map `dueDate` to the existing due date/due time field using a consistent local default time, because v1 intentionally accepts only a date.
25. The parser should store multiple choice options in the existing question options JSON field using the documented `[{ "id": "a", "text": "..." }]` shape.

## MAR-120 implementation concerns

- The current assignment model stores `description`, while the import contract says `instructions`. MAR-120 should map `instructions` to `description` or add a later migration if the product needs both fields.
- The current assignment model stores `dueAt` as a date-time, while this contract accepts `dueDate` only. MAR-120 needs a deterministic conversion rule.
- The current question model has no first-class imported question ID column. MAR-120 can use the JSON `id` only during validation/order mapping unless a later issue adds an import identifier.
- The database currently allows `ARCHIVED`, but this import contract deliberately excludes it to avoid accidentally importing hidden assignments.

## Optional key vocabulary / glossary

Assignments may include `keyVocabulary` (or the alias `glossary`) as an optional array. Each item must include `englishTerm`, `chineseTerm`, `englishDefinition`, and `chineseDefinition`. Optional `category` is a string or null, and optional `questionIds` links terms to imported question `id` values. Use only one of `keyVocabulary` or `glossary` in the same assignment.

### Valid bilingual vocabulary fixture

<!-- fixture: docs/fixtures/assignment-import/valid/bilingual-vocabulary.json -->
```json
{
  "formatVersion": "assignment-import-v1",
  "assignment": {
    "title": "Year 7 Forces Vocabulary Check",
    "instructions": "Use the key vocabulary to help answer each question.",
    "dueDate": null,
    "status": "DRAFT",
    "keyVocabulary": [
      {
        "englishTerm": "force",
        "chineseTerm": "力",
        "englishDefinition": "A push or pull that can change how an object moves.",
        "chineseDefinition": "可以改变物体运动方式的推或拉。",
        "category": "Science",
        "questionIds": ["q1"]
      },
      {
        "englishTerm": "friction",
        "chineseTerm": "摩擦力",
        "englishDefinition": "A force that slows movement when surfaces rub together.",
        "chineseDefinition": "当表面相互摩擦时使运动减慢的力。",
        "category": "Science",
        "questionIds": ["q2"]
      }
    ],
    "questions": [
      {
        "id": "q1",
        "order": 1,
        "type": "OPEN_TEXT",
        "prompt": "What is one example of a force?",
        "points": 1
      },
      {
        "id": "q2",
        "order": 2,
        "type": "OPEN_TEXT",
        "prompt": "Explain how friction affects a bicycle slowing down.",
        "points": 2
      }
    ]
  }
}
```

### Invalid glossary fixture

<!-- fixture: docs/fixtures/assignment-import/invalid/bad-glossary.json -->
```json
{
  "formatVersion": "assignment-import-v1",
  "assignment": {
    "title": "Bad glossary",
    "instructions": "This glossary should fail validation.",
    "dueDate": null,
    "status": "DRAFT",
    "keyVocabulary": [
      {
        "englishTerm": "force",
        "chineseTerm": "",
        "englishDefinition": "A push or pull.",
        "chineseDefinition": "推或拉。",
        "category": 7,
        "questionIds": ["missing-question"]
      }
    ],
    "questions": [
      {
        "id": "q1",
        "order": 1,
        "type": "OPEN_TEXT",
        "prompt": "Name one force."
      }
    ]
  }
}
```
