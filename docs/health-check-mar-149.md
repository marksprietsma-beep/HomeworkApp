# MAR-149 health check and optimisation pass

Date: 2026-06-22

## 1. Commands run

| Command | Result | Notes |
| --- | --- | --- |
| `npm install` | Pass | `node_modules` was already present; install reported dependencies up to date. npm emitted a non-blocking `Unknown env config "http-proxy"` warning. |
| `npm run prisma:generate` | Pass | Prisma Client generated successfully. Prisma warned that `package.json#prisma` config is deprecated for Prisma 7. |
| `npm run prisma:deploy` | Warning / not fully verified | Failed in this container because `DATABASE_URL` is not set. Could not verify migration application against a live PostgreSQL instance here. |
| `npm run db:seed` | Warning / not fully verified | Failed for the same missing `DATABASE_URL` reason before connecting. Seed source is idempotent by stable `example.test` emails and class/assignment names. |
| `npm run db:check` | Warning / not fully verified | Failed for the same missing `DATABASE_URL` reason before connecting. |
| `npm run check:assignment-json-fixtures` | Pass | Valid and invalid assignment import fixtures still match the parser and documentation. |
| `npm run lint` | Pass | ESLint completed without errors. |
| `npm run build` | Pass | Next.js production build completed and listed all expected App Router routes, including response overview/detail/export routes. |
| `docker compose up -d postgres && docker compose ps` | Warning / environment limitation | Docker is not installed in this container (`docker: command not found`), so a local PostgreSQL service could not be started here. |

## 2. Pass/fail results

- **Dependency health:** Pass. Dependencies install cleanly.
- **Prisma generation:** Pass. The schema is valid enough for Prisma Client generation.
- **Migration deploy path:** Not fully verified in this container because no `DATABASE_URL` and no Docker runtime are available. The migration SQL was manually compared with `prisma/schema.prisma` and appears structurally consistent.
- **Seed behaviour:** Not fully verified at runtime because there is no database connection. Static review shows the seed remains rerunnable via upserts and stable local development data.
- **Database check:** Not fully verified because there is no database connection.
- **Assignment JSON fixtures:** Pass.
- **Lint:** Pass.
- **Build:** Pass.
- **Key route compilation:** Pass. The build includes the teacher dashboard, class detail, assignment detail, JSON assignment import, participant work, teacher response overview, individual response detail, response export, and media route.

## 3. Bugs or broken flows found

No build- or lint-blocking bugs were found.

Potential runtime risks to verify on a machine with PostgreSQL running:

1. **Database-dependent flows were not exercised end-to-end here.** The container has no `DATABASE_URL` and no Docker binary, so route rendering against seeded data, migrations, seed, and `db:check` need one local verification pass on Mark's machine.
2. **Teacher-only response export depends on the local role switcher state.** This is coherent with the current local-first app, but the export/overview pages intentionally show unavailable states for student users.
3. **No automated route smoke tests exist yet.** Current confidence comes from static review plus `next build`, not browser-level workflow automation.

## 4. Schema/migration concerns

- The feedback migration creates `FeedbackImport`, `ParticipantFeedback`, `QuestionFeedback`, and `FeedbackFollowUpAction`, plus the follow-up action type/status enums. These match the current Prisma models.
- Foreign keys use cascade from assignment/import/participant feedback and set-null for optional local student, submission, and question links. That fits the documented requirement to retain source identifiers even if local rows are later removed.
- `FeedbackFollowUpAction` has a unique key on `(participantFeedbackId, sourceActionId)`. The feedback contract says action IDs must be unique across the whole JSON. MAR-145 should still enforce whole-document uniqueness before inserting; the database constraint only protects uniqueness within one participant feedback row.
- `ParticipantFeedback.strengths` and `ParticipantFeedback.targets` are required `String[]` fields without database defaults. That matches the contract requiring non-empty arrays, but it means MAR-145 must always provide validated arrays when creating rows.
- Prisma emits a deprecation warning for the seed config in `package.json#prisma`. This is not urgent for MAR-145, but should be cleaned up before a Prisma 7 upgrade.

## 5. Export/feedback-contract alignment

- The response export root uses `exportFormat: "homework-assignment-responses-v2"` and `exportVersion: 2`, which matches the feedback contract's `sourceExport` requirements.
- The export includes assignment ID/title/status/due date and nested class ID/name; the feedback contract expects copied assignment and class IDs plus optional human labels.
- The export includes ordered questions with ID/order/prompt/type/points/image metadata; the feedback contract maps question feedback by `questionId` and optional `questionOrder`.
- The export includes participants with ID/name/email and either a submission object or `submission: null`; the feedback contract mirrors this with required participant ID and optional/null submission.
- The export stores answers in `responsesByQuestionId`, keyed by question ID string. The feedback contract instructs MAR-145 to validate `questionFeedback[].questionId` against exported questions and, where possible, the participant submission's answer keys.
- Documentation now correctly states that normalized feedback tables already exist and MAR-145 should import into them.

## 6. UX friction

- The response export page uses large read-only textareas and instructs teachers to select/copy manually. This is acceptable for the local-first v1 workflow, but a future small enhancement could add a copy button once product work resumes.
- Teacher-only pages show clear unavailable states for student users, but there is no global breadcrumb explaining the role-switcher dependency beyond the homepage. This is acceptable for a local-only prototype.
- The participant work saved confirmation says “Response submitted” even though the model supports draft/submitted status and the current save action sets submitted state. If draft saving is added later, this copy will need revisiting.
- Several pages repeat date formatting and multiple-choice option extraction helpers. This is not harmful now, but the duplication is visible.

## 7. Documentation gaps

- The README accurately reflects the local-first workflow, no SharePoint/Supabase/Vercel/auth assumptions, Docker PostgreSQL, Prisma deploy, seed, local role switcher, assignment import, response export, and feedback JSON contract.
- The feedback contract had one stale line saying there were no feedback tables yet. This was corrected in this pass.
- There is no dedicated response export JSON v2 document besides the implementation and feedback-contract references. If the export shape becomes a longer-lived integration contract, add `docs/response-export-json-v2.md` or a fixture-based check.
- There is no health-check/runbook document for route smoke testing with seeded data. This report can serve as the initial snapshot.

## 8. Small fixes made, if any

- Updated `docs/feedback-json-v1.md` to remove the stale “no feedback tables yet” assumption and align MAR-145 guidance with the current normalized feedback data model.
- Added this MAR-149 health-check report under `docs/health-check-mar-149.md`.

## 9. Recommended follow-up issues

1. **Add a response export JSON v2 fixture and contract check.** Create a stable sample export and a script that verifies feedback docs/examples reference the current export format/version and required IDs.
2. **Add a lightweight route smoke test once test tooling is chosen.** Cover homepage, class detail, assignment detail, import page, participant work, response overview/detail/export with seeded data.
3. **Move Prisma seed config out of `package.json#prisma` before Prisma 7.** This removes the current deprecation warning.
4. **Add copy-to-clipboard controls for JSON/Markdown export.** This is UX polish, not required before MAR-145.
5. **Consider shared UI/data helpers for repeated date formatting and multiple-choice option extraction.** This is code-quality cleanup, not a blocker.

## 10. Recommendation

**Safe to continue to MAR-145 after one local database verification pass.**

The codebase passes dependency install, Prisma generation, assignment fixture validation, lint, and production build. The feedback migration and schema are aligned by static review, and export v2 aligns with the feedback JSON v1 contract. The only pause condition is environmental: this container could not run PostgreSQL-backed migration/seed/db checks because `DATABASE_URL` is absent and Docker is unavailable. On a normal local setup, run:

```bash
cp .env.example .env # if needed
docker compose up -d postgres
npm run prisma:deploy
npm run db:seed
npm run db:check
npm run build
```

If those database-backed checks pass locally, proceed with MAR-145.
