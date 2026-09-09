# Assignment import JSON v2 and structured responses

`assignment-import-v2` is an additive strict import contract. Use v1 for ordinary `TEXT`, `PSEUDOCODE`, and `MULTIPLE_CHOICE` assignments; v1 remains unchanged. Use v2 when an `OPEN_TEXT` question has `responseMode: "STRUCTURED"` and a `responseSchema`.

## Structured schema v1

Every schema has `schemaVersion: 1`, optional plain-text `instructions`, and one supported `kind`. Imported HTML, CSS, JavaScript and arbitrary fields are rejected.

### Table/grid

A `table` has 2–12 `columns` and 1–200 `rows`. Column fields are stable `id`, `label`, and optional semantic `align` (`left`, `center`, `right`) and `width` (`label`, `narrow`, `normal`, `wide`). Rows have stable `id`, `label`, optional `style` (`normal`, `section_header`, `subtotal`, `total`, `spacer`), and `cells` keyed by column ID. A cell is either editable (`editable: true`, `inputType: "text" | "number" | "currency"`), static (`value`), or blank (`blank: true`). Editable field IDs are deterministically `<rowId>.<columnId>`.

See `docs/fixtures/assignment-import/valid/manufacturing-account-v2.json` for a three-column Accounting example.

### T-account

A `t_account` has a plain-text `title` and 1–200 `entries`. Each entry has stable `id`, semantic `side` (`debit` or `credit`), `label`, and optional `detail` and `amount` cells. Editable IDs are `<entryId>.detail` and `<entryId>.amount`. Screen position never determines the side.

See `docs/fixtures/assignment-import/valid/t-account-v2.json`.

## Structured answer data v1

Answers store only values, not a copy of the immutable question schema:

```json
{"schemaVersion":1,"values":{"prime_cost.total":"196000"}}
```

The server derives the allowed field IDs from the stored schema, rejects unknown IDs and non-string values, limits each value to 2,000 characters, and limits schemas to 300 editable fields. Existing `answerText` remains unchanged for non-structured modes.
