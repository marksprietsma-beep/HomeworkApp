import type { StructuredAnswerData, StructuredResponseSchema } from "../../lib/structured-response";

type Props = { questionId: number; schema: unknown; answerData?: unknown; readOnly?: boolean };
const inputType = (kind?: string) => kind === "number" || kind === "currency" ? "text" : "text";

function Field({ questionId, id, label, cell, value, readOnly }: { questionId: number; id: string; label: string; cell: { editable?: boolean; inputType?: string; value?: string; blank?: boolean }; value?: string; readOnly?: boolean }) {
  if (cell.blank) return <span aria-hidden="true" />;
  if (!cell.editable) return <span>{cell.value ?? ""}</span>;
  if (readOnly) return <span className="font-medium">{value || "—"}</span>;
  return <input name={`structured-${questionId}-${id}`} aria-label={label} defaultValue={value ?? ""} type={inputType(cell.inputType)} inputMode={cell.inputType === "currency" || cell.inputType === "number" ? "decimal" : undefined} className="w-full min-w-24 rounded-md border border-slate-300 bg-white px-2 py-2 text-right focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200" />;
}

export function StructuredResponseRenderer({ questionId, schema, answerData, readOnly = false }: Props) {
  if (!schema || typeof schema !== "object") return <p className="text-sm text-red-700">This structured response is unavailable.</p>;
  const definition = schema as StructuredResponseSchema;
  const values = (answerData as StructuredAnswerData | null)?.values ?? {};
  if (definition.schemaVersion !== 1) return <p className="text-sm text-red-700">Unsupported structured response version.</p>;
  if (definition.kind === "table") return <div className="overflow-x-auto rounded-xl border border-slate-300"><table className="w-full min-w-[36rem] border-collapse"><caption className="sr-only">Structured response table</caption><thead><tr>{definition.columns.map((column) => <th key={column.id} scope="col" className={`border-b border-slate-300 bg-slate-100 px-3 py-2 ${column.align === "right" ? "text-right" : "text-left"}`}>{column.label}</th>)}</tr></thead><tbody>{definition.rows.map((row) => <tr key={row.id} className={row.style === "total" ? "border-y-4 border-double border-slate-700 font-bold" : row.style === "subtotal" ? "border-t-2 border-slate-600 font-semibold" : row.style === "section_header" ? "bg-slate-100 font-semibold" : row.style === "spacer" ? "h-6" : "border-t border-slate-200"}>{definition.columns.map((column, index) => <td key={column.id} className={`px-3 py-2 ${column.align === "right" ? "text-right" : "text-left"}`}>{index === 0 ? row.label : <Field questionId={questionId} id={`${row.id}.${column.id}`} label={`${row.label} — ${column.label || column.id}`} cell={row.cells?.[column.id] ?? { blank: true }} value={values[`${row.id}.${column.id}`]} readOnly={readOnly} />}</td>)}</tr>)}</tbody></table></div>;
  if (definition.kind === "t_account") return <div className="overflow-x-auto"><p className="mb-2 text-center text-lg font-semibold">{definition.title}</p><div className="grid min-w-[36rem] grid-cols-2 border-y-2 border-slate-700"><div className="border-r-2 border-slate-700 p-2 font-semibold">Debit</div><div className="p-2 font-semibold">Credit</div>{["debit", "credit"].map((side) => <div key={side} className={side === "debit" ? "border-r-2 border-slate-700 p-2" : "p-2"}>{definition.entries.filter((entry) => entry.side === side).map((entry) => <div key={entry.id} className="grid grid-cols-[1fr_9rem] gap-2 py-1"><Field questionId={questionId} id={`${entry.id}.detail`} label={`${entry.label} ${side} detail`} cell={entry.detail ?? { value: entry.label }} value={values[`${entry.id}.detail`]} readOnly={readOnly} /><Field questionId={questionId} id={`${entry.id}.amount`} label={`${entry.label} ${side} amount`} cell={entry.amount ?? { blank: true }} value={values[`${entry.id}.amount`]} readOnly={readOnly} /></div>)}</div>)}</div></div>;
  return <p className="text-sm text-red-700">Unsupported structured response kind.</p>;
}
