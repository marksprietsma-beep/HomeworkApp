import { safeStructuredAnswerValues, safeStructuredSchema } from "../../lib/structured-response";

type Props = { questionId: number; schema: unknown; answerData?: unknown; readOnly?: boolean };
type Cell = { editable?: boolean; inputType?: "text" | "number" | "currency"; value?: string; blank?: boolean };

const alignmentClass = (align?: string) => align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";
const widthClass = (width?: string) => width === "label" ? "min-w-64" : width === "narrow" ? "w-32" : width === "wide" ? "min-w-72" : "min-w-40";

function Field({ questionId, id, label, cell, value, readOnly, align }: { questionId: number; id: string; label: string; cell: Cell; value?: string; readOnly?: boolean; align?: string }) {
  if (cell.blank) return <span aria-hidden="true" />;
  if (!cell.editable) return <span>{cell.value ?? ""}</span>;
  if (readOnly) return <span className="font-medium">{value || "—"}</span>;
  const numeric = cell.inputType === "currency" || cell.inputType === "number";
  return <input name={`structured-${questionId}-${id}`} aria-label={label} defaultValue={value ?? ""} type="text" inputMode={numeric ? "decimal" : undefined} className={`w-full min-w-24 rounded-md border border-slate-300 bg-white px-2 py-2 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 ${numeric ? "text-right" : alignmentClass(align)}`} />;
}

export function StructuredResponseRenderer({ questionId, schema, answerData, readOnly = false }: Props) {
  const definition = safeStructuredSchema(schema);
  if (!definition) return <p className="text-sm text-red-700">This structured response is unavailable.</p>;
  const values = safeStructuredAnswerValues(answerData);
  const instructions = definition.instructions ? <p className="mb-3 text-sm text-slate-600">{definition.instructions}</p> : null;

  if (definition.kind === "table") return <div>{instructions}<div className="overflow-x-auto rounded-xl border border-slate-300"><table className="w-full min-w-[36rem] border-collapse"><caption className="sr-only">Structured response table</caption><thead><tr>{definition.columns.map((column) => <th key={column.id} scope="col" className={`border-b border-slate-300 bg-slate-100 px-3 py-2 ${alignmentClass(column.align)} ${widthClass(column.width)}`}>{column.label}</th>)}</tr></thead><tbody>{definition.rows.map((row) => <tr key={row.id} className={row.style === "total" ? "border-y-4 border-double border-slate-700 font-bold" : row.style === "subtotal" ? "border-t-2 border-slate-600 font-semibold" : row.style === "section_header" ? "bg-slate-100 font-semibold" : row.style === "spacer" ? "h-6" : "border-t border-slate-200"}>{definition.columns.map((column, index) => {
    const explicitCell = row.cells?.[column.id];
    const content = explicitCell ? <Field questionId={questionId} id={`${row.id}.${column.id}`} label={`${row.label} — ${column.label || column.id}`} cell={explicitCell} value={values[`${row.id}.${column.id}`]} readOnly={readOnly} align={column.align} /> : index === 0 ? row.label : null;
    return index === 0 && !explicitCell ? <th key={column.id} scope="row" className={`px-3 py-2 font-inherit ${alignmentClass(column.align)} ${widthClass(column.width)}`}>{content}</th> : <td key={column.id} className={`px-3 py-2 ${alignmentClass(column.align)} ${widthClass(column.width)}`}>{content}</td>;
  })}</tr>)}</tbody></table></div></div>;

  return <div>{instructions}<div className="overflow-x-auto"><p className="mb-2 text-center text-lg font-semibold">{definition.title}</p><div className="grid min-w-[36rem] grid-cols-2 border-y-2 border-slate-700"><div className="border-r-2 border-slate-700 p-2 font-semibold">Debit</div><div className="p-2 font-semibold">Credit</div>{(["debit", "credit"] as const).map((side) => <div key={side} className={side === "debit" ? "border-r-2 border-slate-700 p-2" : "p-2"}>{definition.entries.filter((entry) => entry.side === side).map((entry) => <div key={entry.id} className="grid grid-cols-[1fr_9rem] gap-2 py-1"><Field questionId={questionId} id={`${entry.id}.detail`} label={`${entry.label} ${side} detail`} cell={entry.detail ?? { value: entry.label }} value={values[`${entry.id}.detail`]} readOnly={readOnly} align="left" /><Field questionId={questionId} id={`${entry.id}.amount`} label={`${entry.label} ${side} amount`} cell={entry.amount ?? { blank: true }} value={values[`${entry.id}.amount`]} readOnly={readOnly} align="right" /></div>)}</div>)}</div></div></div>;
}
