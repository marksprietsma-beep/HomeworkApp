export const STRUCTURED_SCHEMA_VERSION = 1;
export const MAX_STRUCTURED_VALUE_LENGTH = 2_000;
export const MAX_STRUCTURED_FIELDS = 300;

export type StructuredField = { id: string; label: string; inputType: "text" | "number" | "currency" };
export type StructuredAnswerData = { schemaVersion: 1; values: Record<string, string> };

type Cell = { editable?: boolean; inputType?: "text" | "number" | "currency"; value?: string; blank?: boolean };
type Column = { id: string; label: string; align?: "left" | "center" | "right"; width?: "label" | "narrow" | "normal" | "wide" };
type Row = { id: string; label: string; style?: "normal" | "section_header" | "subtotal" | "total" | "spacer"; cells?: Record<string, Cell> };
type LedgerEntry = { id: string; side: "debit" | "credit"; label: string; detail?: Cell; amount?: Cell };
export type StructuredResponseSchema =
  | { schemaVersion: 1; kind: "table"; instructions?: string; columns: Column[]; rows: Row[] }
  | { schemaVersion: 1; kind: "t_account"; instructions?: string; title: string; entries: LedgerEntry[] };

export function structuredFields(schema: unknown): StructuredField[] {
  if (!schema || typeof schema !== "object") return [];
  const candidate = schema as Partial<StructuredResponseSchema>;
  if (candidate.schemaVersion !== 1) return [];
  if (candidate.kind === "table" && Array.isArray(candidate.columns) && Array.isArray(candidate.rows)) {
    const labels = new Map(candidate.columns.map((column) => [column.id, column.label]));
    return candidate.rows.flatMap((row) => Object.entries(row.cells ?? {}).flatMap(([columnId, cell]) =>
      cell.editable ? [{ id: `${row.id}.${columnId}`, label: `${row.label} — ${labels.get(columnId) ?? columnId}`, inputType: cell.inputType ?? "text" }] : []));
  }
  if (candidate.kind === "t_account" && Array.isArray(candidate.entries)) {
    return candidate.entries.flatMap((entry) => ([
      ...(entry.detail?.editable ? [{ id: `${entry.id}.detail`, label: `${entry.label} ${entry.side} detail`, inputType: entry.detail.inputType ?? "text" as const }] : []),
      ...(entry.amount?.editable ? [{ id: `${entry.id}.amount`, label: `${entry.label} ${entry.side} amount`, inputType: entry.amount.inputType ?? "currency" as const }] : []),
    ]));
  }
  return [];
}

export function validateStructuredAnswer(schema: unknown, value: unknown): StructuredAnswerData {
  const fields = structuredFields(schema);
  if (fields.length === 0 || fields.length > MAX_STRUCTURED_FIELDS) throw new Error("This structured question has no valid editable fields.");
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Structured answer data must be an object.");
  const data = value as { schemaVersion?: unknown; values?: unknown };
  if (data.schemaVersion !== 1 || !data.values || typeof data.values !== "object" || Array.isArray(data.values)) throw new Error("Structured answer data must use schemaVersion 1 and a values object.");
  const allowed = new Set(fields.map((field) => field.id));
  const values: Record<string, string> = {};
  for (const [key, raw] of Object.entries(data.values)) {
    if (!allowed.has(key)) throw new Error(`Structured answer contains unknown field "${key}".`);
    if (typeof raw !== "string") throw new Error(`Structured answer field "${key}" must be a string.`);
    if (raw.length > MAX_STRUCTURED_VALUE_LENGTH) throw new Error(`Structured answer field "${key}" is too long.`);
    values[key] = raw;
  }
  return { schemaVersion: 1, values };
}
