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

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function safeStructuredSchema(schema: unknown): StructuredResponseSchema | null {
  if (!isObject(schema) || schema.schemaVersion !== 1 || (schema.kind !== "table" && schema.kind !== "t_account")) return null;
  if (schema.instructions !== undefined && typeof schema.instructions !== "string") return null;
  if (schema.kind === "table") {
    if (!Array.isArray(schema.columns) || !Array.isArray(schema.rows)) return null;
    if (!schema.columns.every((column) => isObject(column) && typeof column.id === "string" && typeof column.label === "string")) return null;
    if (!schema.rows.every((row) => isObject(row) && typeof row.id === "string" && typeof row.label === "string" && (row.cells === undefined || isObject(row.cells)) && Object.values(row.cells ?? {}).every(isObject))) return null;
  } else if (typeof schema.title !== "string" || !Array.isArray(schema.entries) || !schema.entries.every((entry) => isObject(entry) && typeof entry.id === "string" && typeof entry.label === "string" && (entry.side === "debit" || entry.side === "credit") && (entry.detail === undefined || isObject(entry.detail)) && (entry.amount === undefined || isObject(entry.amount)))) return null;
  return schema as unknown as StructuredResponseSchema;
}

export function structuredFields(schema: unknown): StructuredField[] {
  const candidate = safeStructuredSchema(schema);
  if (!candidate) return [];
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
  if (fields.length === 0) throw new Error("This structured question has no valid editable fields.");
  if (fields.length > MAX_STRUCTURED_FIELDS) throw new Error(`This structured question has too many editable fields; the maximum is ${MAX_STRUCTURED_FIELDS}.`);
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

export function structuredExportRepresentation(schema: unknown, answerData: unknown) {
  return { fields: structuredFields(schema), answerData: validateStructuredAnswer(schema, answerData) };
}

export function tableCellContent(schema: unknown, rowId: string, columnId: string) {
  const definition = safeStructuredSchema(schema);
  if (!definition || definition.kind !== "table") return { available: false as const };
  const row = definition.rows.find((item) => item.id === rowId);
  const columnIndex = definition.columns.findIndex((item) => item.id === columnId);
  if (!row || columnIndex < 0) return { available: false as const };
  const cell = row.cells?.[columnId];
  return { available: true as const, cell: cell ?? null, fallbackLabel: !cell && columnIndex === 0 ? row.label : null };
}
