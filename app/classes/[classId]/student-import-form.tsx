"use client";

import { useActionState, useState } from "react";
import { importStudentsToClassFromCsv, previewStudentCsvImport, type StudentCsvImportState } from "./actions";

const initialState: StudentCsvImportState = { error: null, success: null, rows: [], summary: null };

export function StudentCsvImportForm({ classId }: { classId: number }) {
  const [state, previewAction, isPreviewing] = useActionState(previewStudentCsvImport.bind(null, classId), initialState);
  const [importState, importAction, isImporting] = useActionState(importStudentsToClassFromCsv.bind(null, classId), initialState);
  const [csvText, setCsvText] = useState("");
  const hasImportableRows = state.rows.some((row) => row.status === "CREATE" || row.status === "ENROLL_EXISTING" || row.status === "ALREADY_ENROLLED");
  const hasBlockingRows = state.rows.some((row) => row.status === "INVALID" || row.status === "CONFLICT");

  return (
    <section className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">CSV import</p>
      <h3 className="mt-2 text-lg font-bold text-slate-950">Import students to this class</h3>
      <div className="mt-2 grid gap-2 text-sm leading-6 text-emerald-950">
        <p>Upload or paste CSV with these required columns (spacing and letter case may vary):</p>
        <ul className="list-disc pl-5">
          <li><span className="font-semibold">First Name</span></li>
          <li><span className="font-semibold">Last Name</span></li>
          <li><span className="font-semibold">Email Address</span></li>
        </ul>
        <p className="font-mono text-xs">First Name,Last Name,Email Address<br />Aisha,Khan,aisha@example.test</p>
      </div>

      <form action={previewAction} className="mt-4 grid gap-3">
        <label className="text-sm font-semibold text-slate-950">
          CSV text
          <input type="file" accept=".csv,text/csv" className="mt-2 block w-full text-sm font-normal" onChange={async (event) => { const file = event.target.files?.[0]; if (file) setCsvText(await file.text()); }} />
          <textarea name="csvText" rows={8} value={csvText} onChange={(event) => setCsvText(event.target.value)} className="mt-2 w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 font-mono text-sm text-slate-950 shadow-sm" placeholder="First Name,Last Name,Email Address\nAisha,Khan,aisha@example.test" />
        </label>
        <button type="submit" disabled={isPreviewing} className="justify-self-start rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:bg-slate-300">
          {isPreviewing ? "Previewing…" : "Preview CSV"}
        </button>
      </form>

      {state.error ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{state.error}</p> : null}
      {state.success ? <p className="mt-4 rounded-xl border border-emerald-300 bg-white px-4 py-3 text-sm font-semibold text-emerald-800">{state.success}</p> : null}
      {importState.error ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{importState.error}</p> : null}
      {importState.success ? <p className="mt-4 rounded-xl border border-emerald-300 bg-white px-4 py-3 text-sm font-semibold text-emerald-800">{importState.success}</p> : null}

      {state.rows.length > 0 ? (
        <div className="mt-5 overflow-x-auto rounded-xl border border-emerald-200 bg-white">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-emerald-100 uppercase tracking-[0.12em] text-emerald-900"><tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">Student</th><th className="px-3 py-2">Email/login</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Messages</th></tr></thead>
            <tbody>
              {state.rows.map((row) => (
                <tr key={row.rowNumber} className="border-t border-emerald-100 align-top">
                  <td className="px-3 py-2 font-semibold text-slate-700">{row.rowNumber}</td>
                  <td className="px-3 py-2 text-slate-950">{row.displayName || "—"}</td>
                  <td className="px-3 py-2 text-slate-700">{row.email || "—"}</td>
                  <td className="px-3 py-2 font-semibold text-slate-950">{row.status}</td>
                  <td className="px-3 py-2 text-slate-700">{row.messages.length > 0 ? row.messages.join("; ") : "Ready"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {state.summary ? <p className="mt-4 text-sm font-semibold text-emerald-950">Created {state.summary.createdUsers}; enrolled existing {state.summary.existingStudentsEnrolled}; already enrolled/skipped {state.summary.alreadyEnrolled}; invalid rows {state.summary.invalidRows}; conflicts/errors {state.summary.conflicts}.</p> : null}
      {importState.summary ? <p className="mt-4 text-sm font-semibold text-emerald-950">Created {importState.summary.createdUsers}; enrolled existing {importState.summary.existingStudentsEnrolled}; already enrolled/skipped {importState.summary.alreadyEnrolled}.</p> : null}
      {importState.credentials?.length ? (
        <button type="button" className="mt-4 rounded-full bg-amber-500 px-4 py-2 text-sm font-bold text-slate-950" onClick={() => {
          const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
          const report = ["Name,School Email,Temporary Password", ...importState.credentials!.map((credential) => [credential.name, credential.email, credential.temporaryPassword].map(quote).join(","))].join("\n");
          const url = URL.createObjectURL(new Blob([report], { type: "text/csv;charset=utf-8" }));
          const link = document.createElement("a"); link.href = url; link.download = `class-${classId}-temporary-credentials.csv`; link.click(); URL.revokeObjectURL(url);
        }}>Download one-time credentials</button>
      ) : null}

      {state.rows.length > 0 ? (
        <form action={importAction} className="mt-4">
          <input type="hidden" name="csvText" value={csvText} />
          <button type="submit" disabled={isImporting || !hasImportableRows || hasBlockingRows} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:bg-slate-300">
            {isImporting ? "Importing…" : "Save import"}
          </button>
        </form>
      ) : null}
      {hasBlockingRows ? <p className="mt-3 text-sm font-semibold text-red-700">Fix all invalid rows and conflicts before saving. Imports are all-or-nothing.</p> : null}
    </section>
  );
}
