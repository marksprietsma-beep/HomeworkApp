# ChatGPT feedback JSON v1

This document defines the stable JSON shape that ChatGPT should generate after a teacher exports assignment response data and asks ChatGPT to review it. The format is intentionally small, paste-friendly, and easy for the future MAR-145 feedback import parser to validate.

The app does **not** generate this feedback inside the product in v1. The teacher exports response data, pastes it into ChatGPT, asks for feedback, copies ChatGPT's JSON output, and later imports that JSON back into the app when MAR-145 adds the parser/import flow.

## Intended workflow

1. The teacher exports assignment responses from the teacher-only response export screen.
2. The exported response JSON uses `exportFormat: "homework-assignment-responses-v2"` and `exportVersion: 2`.
3. The teacher pastes that export into ChatGPT and asks it to produce Homework App feedback JSON v1.
4. ChatGPT returns only valid JSON using the contract in this document.
5. A later issue imports and validates that JSON before storing or showing feedback.

## Prompt snippet for ChatGPT

Mark can paste this into ChatGPT after the exported response JSON:

> Use the exported Homework App response JSON below as the only source data. Return valid importable Homework App feedback JSON only. Do not wrap the answer in Markdown or add commentary. Return JSON only, with no explanatory text before or after it.
> 
> Required root object shape:
> - feedbackFormat
> - feedbackVersion
> - sourceExport
> - assignment
> - class
> - participantFeedback
> 
> Feedback import contract:
> - Use feedbackFormat "homework-feedback" and feedbackVersion 1.
> - Copy sourceExport.exportFormat, sourceExport.exportVersion, and sourceExport.generatedAt from the export.
> - The assignment object must be at the root and include the exported assignment.id exactly. Include assignment.title where available.
> - The class object must be at the root and include the exported assignment.class.id exactly. Include assignment.class.name where available.
> - The participantFeedback array must be at the root. Use participantFeedback, not participants.
> - Do not return root-level participants.
> - Do not rename participantFeedback to participants.
> - Do not nest class inside assignment. Do not return assignment.class. Use root-level class instead.
> - Preserve assignment id, class id, participant/source participant id, submission id, and question ids exactly from the exported response data. IDs must not be renamed, invented for existing records, or converted to strings.
> - For each participant who should receive feedback, include participant.id copied from exported participants[].id, participant.name where available, submission.id copied from that participant's submission.id or submission null, overallFeedback, strengths, targets, questionFeedback where useful, and followUpActions where appropriate.
> - Question-level feedback must use exported question IDs exactly and may include strengths, targets, and follow-up actions.
> - If a participant has no submission, use submission null and avoid question-level feedback unless there is a clear reason.
> 
> Follow-up action requirements:
> - Every follow-up action requires a stable non-empty string id.
> - This applies to participant-level followUpActions and question-level followUpActions.
> - Do not omit follow-up action ids, and do not rely on the importer to invent ids.
> - Example stable ids: pf1-action1, pf1-q86-action1, pf1-q91-action1.
> - Each follow-up action must include id, type, prompt, and required.
> - Follow-up action type must be ACKNOWLEDGEMENT, SHORT_REFLECTION, or ANSWER_FOLLOW_UP_QUESTION.
> - Use required true unless the action is genuinely optional.
> 
> Return valid importable feedback JSON only. After this prompt, paste the exported response JSON.

## Stable root shape

```json
{
  "feedbackFormat": "homework-feedback",
  "feedbackVersion": 1,
  "sourceExport": {
    "exportFormat": "homework-assignment-responses-v2",
    "exportVersion": 2,
    "generatedAt": "2026-06-22T10:15:00.000Z"
  },
  "assignment": {
    "id": 42,
    "title": "Year 7 Fractions Check"
  },
  "class": {
    "id": 7,
    "name": "Development Maths Class"
  },
  "generatedBy": "ChatGPT",
  "generatedAt": "2026-06-22T10:30:00.000Z",
  "participantFeedback": [
    {
      "participant": {
        "id": 3,
        "name": "Ada Student"
      },
      "submission": {
        "id": 18,
        "status": "SUBMITTED"
      },
      "overallFeedback": "string",
      "strengths": ["string"],
      "targets": ["string"],
      "teacherNotes": "string",
      "questionFeedback": [
        {
          "questionId": 101,
          "questionOrder": 1,
          "feedback": "string",
          "strengths": ["string"],
          "targets": ["string"],
          "followUpActions": [
            {
              "id": "pf-3-q101-reflect",
              "type": "SHORT_REFLECTION",
              "prompt": "string",
              "required": true
            }
          ]
        }
      ],
      "followUpActions": [
        {
          "id": "pf-3-ack",
          "type": "ACKNOWLEDGEMENT",
          "prompt": "Please acknowledge that you have read this feedback.",
          "required": true
        }
      ]
    }
  ]
}
```

## Root fields

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `feedbackFormat` | Yes | string | Must be exactly `homework-feedback`. |
| `feedbackVersion` | Yes | integer | Must be exactly `1` for this contract. |
| `sourceExport` | Yes | object | Identifies the response export reviewed by ChatGPT. |
| `assignment` | Yes | object | Assignment identifiers copied from the export. |
| `class` | Yes | object | Class identifiers copied from `assignment.class` in the export. |
| `generatedBy` | No | string | Optional label such as `ChatGPT`. This is metadata only and must not be treated as authentication. |
| `generatedAt` | No | string | Optional ISO 8601 timestamp for when ChatGPT produced the feedback. |
| `participantFeedback` | Yes | array | One entry for each participant who should receive imported feedback. May omit participants who should receive no feedback. |

## Source export fields

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `exportFormat` | Yes | string | Must be copied from the reviewed export and should be `homework-assignment-responses-v2`. |
| `exportVersion` | Yes | integer | Must be copied from the reviewed export and should be `2`. |
| `generatedAt` | No | string | Optional timestamp copied from the export so the teacher/importer can see which export was reviewed. |

## Assignment and class fields

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `assignment.id` | Yes | integer | Must match the exported `assignment.id`. |
| `assignment.title` | No | string | Optional human-readable title copied from the export for teacher review. |
| `class.id` | Yes | integer | Must match the exported `assignment.class.id`. |
| `class.name` | No | string | Optional human-readable class name copied from the export for teacher review. |

IDs are the contract's source of truth. Names and titles are included only to make the JSON easier for a teacher to inspect.

## Participant feedback fields

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `participant` | Yes | object | Identifies the student/participant from the export. |
| `submission` | No | object or null | Identifies the reviewed submission when one exists. Use `null` or omit only when giving feedback to a participant with no submission. |
| `overallFeedback` | Yes | string | Student-facing overall feedback. Must not be empty after trimming. |
| `overallFeedbackI18n` | No | object | Optional bilingual text object with supported keys `en` and `zh`. English-only imports can omit it. |
| `strengths` | Yes | array of strings | Student-facing strengths. Must contain at least one non-empty string. |
| `targets` | Yes | array of strings | Student-facing next steps/targets. Must contain at least one non-empty string. |
| `teacherNotes` | No | string | Optional teacher-facing notes. These should not be shown to students unless a later UI explicitly chooses to. |
| `questionFeedback` | No | array | Optional question-level feedback linked to exported question IDs. Use an empty array or omit when only overall feedback is needed. |
| `followUpActions` | No | array | Optional participant-level actions the student must complete after reading overall feedback. |

### Participant identifier fields

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `participant.id` | Yes | integer | Must match an exported `participants[].id`. |
| `participant.name` | No | string | Optional copied display name for teacher review. |
| `participant.email` | No | string or null | Optional copied email for teacher review. |

### Submission identifier fields

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `submission.id` | Yes, when `submission` is present | integer | Must match the exported participant's `submission.id`. |
| `submission.status` | No | string | Optional copied status such as `DRAFT` or `SUBMITTED`. |

A participant who did not start the assignment has `submission: null` in the response export. Feedback for that participant may use `submission: null`, but question-level feedback should normally be omitted because there are no submitted answers to review.

## Question-level feedback fields

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `questionId` | Yes | integer | Must match an exported `questions[].id` and, where possible, a key in the participant submission's `responsesByQuestionId`. |
| `questionOrder` | No | integer | Optional copied display order for teacher review. |
| `feedback` | Yes | string | Student-facing feedback for this question. Must not be empty after trimming. |
| `strengths` | No | array of strings | Optional strengths specific to this answer. |
| `targets` | No | array of strings | Optional targets specific to this answer. |
| `teacherNotes` | No | string | Optional teacher-facing note for this question. |
| `followUpActions` | No | array | Optional actions linked to this question. |

Question-level feedback should only be included when it is useful. ChatGPT does not need to produce one entry for every question.

## Follow-up actions

Follow-up actions tell the future student feedback UI what the student must do after reading feedback. They can appear at participant level or question level.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `id` | Yes | string | Stable non-empty unique ID within the feedback JSON. Every participant-level and question-level follow-up action must include one, such as `pf1-action1`, `pf1-q86-action1`, or `pf1-q91-action1`. |
| `type` | Yes | string | Must be `ACKNOWLEDGEMENT`, `SHORT_REFLECTION`, or `ANSWER_FOLLOW_UP_QUESTION`. |
| `prompt` | Yes | string | Student-facing instruction or question. Must not be empty after trimming. |
| `required` | No | boolean | Defaults to `true` if omitted. |

Supported v1 action types:

- `ACKNOWLEDGEMENT`: the student confirms they have read the feedback.
- `SHORT_REFLECTION`: the student writes a brief reflection about the feedback or their next step.
- `ANSWER_FOLLOW_UP_QUESTION`: the student answers a specific follow-up question set by ChatGPT/teacher.

The v1 contract deliberately does not define marking, scores, deadlines, file uploads, or automated completion rules for follow-up actions.

## Complete valid example

```json
{
  "feedbackFormat": "homework-feedback",
  "feedbackVersion": 1,
  "sourceExport": {
    "exportFormat": "homework-assignment-responses-v2",
    "exportVersion": 2,
    "generatedAt": "2026-06-22T10:15:00.000Z"
  },
  "assignment": {
    "id": 42,
    "title": "Year 7 Fractions Check"
  },
  "class": {
    "id": 7,
    "name": "Development Maths Class"
  },
  "generatedBy": "ChatGPT",
  "generatedAt": "2026-06-22T10:30:00.000Z",
  "participantFeedback": [
    {
      "participant": {
        "id": 3,
        "name": "Ada Student",
        "email": "ada.student@example.test"
      },
      "submission": {
        "id": 18,
        "status": "SUBMITTED"
      },
      "overallFeedback": "You showed a secure understanding of equivalent fractions and explained your comparison method clearly. Your next step is to make your written working more precise so another reader can follow every step.",
      "strengths": [
        "You identified an equivalent fraction accurately.",
        "You used mathematical vocabulary such as numerator and denominator in your explanation."
      ],
      "targets": [
        "Show each conversion step when comparing fractions.",
        "Check that your final sentence directly answers the question."
      ],
      "teacherNotes": "Ada is ready for a short extension task on common denominators.",
      "questionFeedback": [
        {
          "questionId": 101,
          "questionOrder": 1,
          "feedback": "Your equivalent fraction is correct.",
          "strengths": [
            "Accurate answer."
          ],
          "targets": [
            "Include a short note explaining how you scaled the fraction."
          ],
          "followUpActions": [
            {
              "id": "pf-3-q101-followup",
              "type": "ANSWER_FOLLOW_UP_QUESTION",
              "prompt": "What did you multiply the numerator and denominator by to make your equivalent fraction?",
              "required": true
            }
          ]
        },
        {
          "questionId": 102,
          "questionOrder": 2,
          "feedback": "Your comparison strategy is sensible. Add one more sentence that states the common denominator before comparing the numerators.",
          "strengths": [
            "Clear comparison strategy."
          ],
          "targets": [
            "State the common denominator explicitly."
          ]
        }
      ],
      "followUpActions": [
        {
          "id": "pf-3-ack",
          "type": "ACKNOWLEDGEMENT",
          "prompt": "Please acknowledge that you have read this feedback.",
          "required": true
        },
        {
          "id": "pf-3-reflect",
          "type": "SHORT_REFLECTION",
          "prompt": "Write one sentence explaining which target you will focus on first.",
          "required": true
        }
      ]
    },
    {
      "participant": {
        "id": 4,
        "name": "Ben Student",
        "email": "ben.student@example.test"
      },
      "submission": null,
      "overallFeedback": "I could not review written answers because no submission was available in the export.",
      "strengths": [
        "You are enrolled and can still use the assignment questions for practice."
      ],
      "targets": [
        "Open the assignment and save a response before requesting detailed feedback."
      ],
      "followUpActions": [
        {
          "id": "pf-4-ack",
          "type": "ACKNOWLEDGEMENT",
          "prompt": "Please acknowledge that you need to submit work before detailed feedback can be provided."
        }
      ]
    }
  ]
}
```

## Invalid example

This JSON is parseable, but it violates the v1 contract.

```json
{
  "feedbackFormat": "homework-feedback-v1",
  "feedbackVersion": "1",
  "sourceExport": {
    "exportFormat": "homework-assignment-responses-v2",
    "exportVersion": 2
  },
  "assignment": {
    "id": "42"
  },
  "class": {
    "id": 7
  },
  "participantFeedback": [
    {
      "participant": {
        "id": 999
      },
      "submission": {
        "id": 18
      },
      "overallFeedback": "",
      "strengths": [],
      "targets": ["Revise your answer."],
      "questionFeedback": [
        {
          "questionId": 9999,
          "feedback": "Good effort.",
          "followUpActions": [
            {
              "id": "duplicate-action",
              "type": "WRITE_AN_ESSAY",
              "prompt": "Write more."
            }
          ]
        }
      ],
      "followUpActions": [
        {
          "id": "duplicate-action",
          "type": "ACKNOWLEDGEMENT",
          "prompt": "Read this."
        }
      ]
    }
  ]
}
```

This example is invalid because:

- `feedbackFormat` must be exactly `homework-feedback`.
- `feedbackVersion` must be the integer `1`, not the string `"1"`.
- `assignment.id` must be an integer copied from the export, not a string.
- `participant.id` must match a participant in the reviewed export.
- `submission.id` must belong to that participant in the reviewed export.
- `overallFeedback` must be a non-empty string after trimming.
- `strengths` must contain at least one non-empty string.
- `questionId` must match a question in the reviewed export.
- Follow-up action IDs must be unique within the whole feedback JSON.
- Follow-up action `type` must be one of the three supported v1 values.

## Optional bilingual feedback fields

Feedback JSON v1 remains English-first and backwards compatible. Existing fields such as `overallFeedback`, `strengths`, `targets`, `questionFeedback[].feedback`, and follow-up action `prompt` are still required where the base contract requires them.

When bilingual feedback is requested, ChatGPT may add these optional fields without removing the English fields:

- `overallFeedbackI18n`: `{ "en": "...", "zh": "..." }`
- `strengthsI18n`: `{ "en": ["..."], "zh": ["..."] }`
- `targetsI18n`: `{ "en": ["..."], "zh": ["..."] }`
- `questionFeedback[].feedbackI18n`: `{ "en": "...", "zh": "..." }`
- `questionFeedback[].strengthsI18n` and `questionFeedback[].targetsI18n`: `{ "en": ["..."], "zh": ["..."] }`
- `followUpActions[].promptI18n`: `{ "en": "...", "zh": "..." }` for both participant-level and question-level actions.

Only `en` and `zh` are supported in i18n objects. Missing Chinese content is allowed; the app falls back to English and avoids empty Chinese lines. Chinese text should be natural Simplified Chinese for students rather than a literal word-for-word translation.

## Validation rules for MAR-145

MAR-145 should enforce these rules before storing feedback or showing it to students:

1. The pasted content must parse as JSON and the root value must be an object.
2. `feedbackFormat` must exist and equal `homework-feedback`.
3. `feedbackVersion` must exist and equal integer `1`.
4. `sourceExport` must exist and be an object.
5. `sourceExport.exportFormat` must equal `homework-assignment-responses-v2` for feedback based on MAR-134 exports.
6. `sourceExport.exportVersion` must equal integer `2` for feedback based on MAR-134 exports.
7. `assignment.id` must be an integer and must match the assignment currently importing feedback.
8. `class.id` must be an integer and must match the class currently importing feedback.
9. Optional copied labels such as `assignment.title`, `class.name`, `participant.name`, `participant.email`, `submission.status`, `generatedBy`, and `generatedAt` must have the documented types when present.
10. `participantFeedback` must be an array with at least one entry.
11. Each `participantFeedback[].participant.id` must be an integer matching a participant in the response export/import context.
12. A participant must appear at most once in `participantFeedback`.
13. When `submission` is present and not `null`, `submission.id` must be an integer matching that participant's exported submission.
14. Participants with no exported submission may use `submission: null`; they should not include question-level feedback unless MAR-145 explicitly supports no-submission question prompts.
15. `overallFeedback` must be a non-empty string after trimming.
16. `strengths` must be a non-empty array of non-empty strings.
17. `targets` must be a non-empty array of non-empty strings.
18. `teacherNotes`, when present, must be a string and should be stored/flagged separately from student-facing feedback.
19. `questionFeedback`, when present, must be an array.
20. Each `questionFeedback[].questionId` must be an integer matching an exported assignment question.
21. A question should appear at most once per participant's `questionFeedback` array.
22. `questionFeedback[].feedback` must be a non-empty string after trimming.
23. Optional question-level `strengths` and `targets` must be arrays of non-empty strings when present.
24. Follow-up action arrays may appear at participant level or question level and must contain only objects.
25. Follow-up action `id` values must be non-empty strings and unique across the whole feedback JSON.
26. Follow-up action `type` must be exactly `ACKNOWLEDGEMENT`, `SHORT_REFLECTION`, or `ANSWER_FOLLOW_UP_QUESTION`.
27. Follow-up action `prompt` must be a non-empty string after trimming.
28. Follow-up action `required`, when present, must be a boolean; if omitted, the importer should normalise it to `true`.
29. Reject unknown root fields and unknown nested fields unless MAR-145 deliberately documents a permissive policy.
30. The parser should trim string fields before saving where that does not change meaning.
31. The parser should produce clear path-based validation errors so the teacher can repair ChatGPT output.

## MAR-145 and data model concerns

- The current app exports assignment, participant, submission, and question IDs and now has normalised feedback tables from MAR-144. MAR-145 should import into those tables rather than storing feedback only as an opaque JSON blob.
- Teacher-facing notes should be kept separate from student-facing feedback in any future UI to avoid accidentally showing private notes to students.
- Follow-up action responses will likely need their own persistence model if students must acknowledge, reflect, or answer a follow-up question.
- The importer should compare feedback IDs against the current assignment/class context, not trust copied names or emails.
- The contract intentionally avoids scores, grades, marks, rubric totals, and automatic calculations. If those are added later, they should use a new feedback version.
- ChatGPT may invent IDs if the prompt is unclear. The MAR-145 parser should reject invented participant, submission, or question IDs rather than silently importing partial feedback.

## Storage model notes

MAR-144 stores imported feedback in a local-first Prisma model before any parser or UI is added. Each import creates a `FeedbackImport` row for the assignment and metadata from this contract, then one `ParticipantFeedback` row per participant feedback item.

Participant feedback links to the local assignment and, where IDs still match local data, to the student and submission. It also keeps copied source participant and submission identifiers as snapshots so imported feedback remains understandable if optional local links cannot be resolved later.

Question-level feedback is stored separately in `QuestionFeedback` and links to the local question where possible while retaining copied source question identifiers and order. Follow-up actions are stored in `FeedbackFollowUpAction` for both overall participant feedback and question feedback, with the v1 action type and a basic `PENDING` or `COMPLETED` status plus `completedAt` when finished.

This storage model is intentionally not a grading model: it stores text feedback, strengths, targets, optional teacher notes, and student follow-up requirements only.

## MAR-145 parser and fixture check

The reusable parser lives in `lib/feedback-import-parser.mjs` and exposes `parseFeedbackImportJson(rawJsonText, context)`. The input is raw pasted JSON text. The optional `context` should contain the current assignment ID, class ID, exported question IDs, exported participant IDs, and each participant's exported submission ID/response question keys so the parser can reject invented references.

The parser returns either:

- `{ ok: true, feedback, errors: [] }` with trimmed, normalised feedback ready for preview/save work in MAR-146. Omitted follow-up action `required` values are normalised to `true`, and actions receive an initial `status: "PENDING"`.
- `{ ok: false, feedback: null, errors }` where each error has a JSON-style `path`, stable `code`, and clear `message`.

Fixture coverage lives under `docs/fixtures/feedback-import`:

- `valid/fractions-feedback.json` is a valid feedback document checked against a representative response export context.
- `invalid/contract-violations.json` is valid JSON that violates the contract and reference checks.
- `invalid/not-json.json` confirms invalid pasted JSON returns a structured parse error.

Run the fixture check with:

```bash
npm run check:feedback-json-fixtures
```

## Teacher import UI (MAR-146)

Teachers can import feedback for one assignment at
`/classes/[classId]/assignments/[assignmentId]/feedback/import`. The page is
linked from the assignment detail, response overview, and response export pages.
It uses the temporary local development user switcher and is only available to
the seeded class teacher.

The page validates pasted JSON with the reusable feedback parser against the
current assignment export context: class, assignment, ordered questions,
enrolled participants, submissions, and per-question responses. A valid import
shows a teacher-only preview of source export metadata, assignment/class match,
participant overall feedback, strengths, targets, question feedback, and required
follow-up actions before saving.

Saving creates a new `FeedbackImport` and nested `ParticipantFeedback`,
`QuestionFeedback`, and `FeedbackFollowUpAction` rows. Participant, submission,
question, and action source IDs from the JSON are preserved in the feedback data
model. V1 intentionally does not publish feedback to students and does not
replace prior imports; if an assignment already has imports, the UI warns that a
new teacher-only import record will be added.
