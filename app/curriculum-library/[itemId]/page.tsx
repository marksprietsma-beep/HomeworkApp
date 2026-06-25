import { CurriculumLibraryVisibility, HomeworkAssignmentStatus } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { archiveLibraryItem, assignLibraryItemToClass, duplicateLibraryItem, updateLibraryItemMetadata } from "../actions";
import { canManageLibraryItem, getAssignableClassesForUser, getCurriculumLibraryItemDetail, isAssignmentTemplate } from "../../../lib/curriculum-library";
import { getShareableTeamsForUser } from "../../../lib/department-teams";
import { getSelectedLocalDevelopmentUser } from "../../../lib/local-dev-user";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ itemId: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> };

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default async function CurriculumLibraryItemPage({ params, searchParams }: Props) {
  const [{ itemId }, resolvedSearchParams, { selectedUser }] = await Promise.all([params, searchParams, getSelectedLocalDevelopmentUser()]);
  const id = Number(itemId);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const [item, classes, teams] = await Promise.all([
    getCurriculumLibraryItemDetail(id, selectedUser),
    getAssignableClassesForUser(selectedUser),
    getShareableTeamsForUser(selectedUser),
  ]);
  if (!item) notFound();

  const template = isAssignmentTemplate(item.assignmentJson) ? item.assignmentJson : null;
  const canUseLibrary = selectedUser?.role === "ADMIN" || selectedUser?.role === "TEACHER";
  const canManageItem = canManageLibraryItem(selectedUser, item);
  const updateAction = updateLibraryItemMetadata.bind(null, item.id);
  const archiveAction = archiveLibraryItem.bind(null, item.id);
  const duplicateAction = duplicateLibraryItem.bind(null, item.id);
  const assignAction = assignLibraryItemToClass.bind(null, item.id);
  const assignedClassIds = new Set(item.assignedCopies.map((copy) => copy.classId));

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <Link href="/curriculum-library" className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950">← Back to library</Link>
      {resolvedSearchParams?.updated === "1" ? <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><p className="font-semibold">Library item updated</p><p className="mt-1">A snapshot of the previous version was saved before the metadata changed.</p></div> : null}
      {resolvedSearchParams?.duplicated === "1" ? <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><p className="font-semibold">Private duplicate created</p><p className="mt-1">This copy is independent from the original shared item.</p></div> : null}

      <section className="mt-8 rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Curriculum library item · v{item.version}</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950">{item.title}</h1>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
              {item.subject ? <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-900">{item.subject}</span> : null}
              {item.yearGroup ? <span className="rounded-full bg-slate-100 px-3 py-1">{item.yearGroup}</span> : null}
              {item.unitTopic ? <span className="rounded-full bg-slate-100 px-3 py-1">{item.unitTopic}</span> : null}
              {item.visibility === CurriculumLibraryVisibility.TEAM ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-900">Shared with {item.team?.name ?? "team"}</span> : <span className="rounded-full bg-slate-100 px-3 py-1">Private</span>}
              {item.archivedAt ? <span className="rounded-full bg-red-100 px-3 py-1 text-red-800">Archived</span> : null}
              {item.tags.map((tag) => <span key={tag} className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">#{tag}</span>)}
            </div>
            <dl className="mt-6 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
              <div><dt className="font-bold text-slate-950">Owner / creator</dt><dd>{item.createdBy?.displayName ?? "Unknown"}{item.createdBy?.email ? ` · ${item.createdBy.email}` : ""}</dd></div>
              <div><dt className="font-bold text-slate-950">Created</dt><dd>{formatDate(item.createdAt)}</dd></div>
              <div><dt className="font-bold text-slate-950">Updated</dt><dd>{formatDate(item.updatedAt)}</dd></div>
              <div><dt className="font-bold text-slate-950">Assigned copies</dt><dd>{item.assignedCopies.length}</dd></div>
            </dl>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            {canUseLibrary ? <form action={duplicateAction}><button className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">Duplicate private copy</button></form> : null}
            {canManageItem && !item.archivedAt ? <form action={archiveAction}><button className="rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 shadow-sm">Archive item</button></form> : null}
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="grid gap-6">
          <section className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-950">Content preview</h2>
            <p className="mt-2 text-sm text-slate-600">Bilingual title, description, vocabulary and question fields are preserved in the saved assignment JSON. Raw JSON editing is intentionally not exposed in v1.</p>
            {template ? <div className="mt-4 grid gap-3"><p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700"><span className="font-bold text-slate-950">Description:</span> {template.description || "No description saved."}</p>{template.questions.slice(0, 5).map((question, index) => <div key={`${question.order}-${index}`} className="rounded-2xl border border-slate-200 p-4 text-sm"><p className="font-bold text-slate-950">Question {index + 1} · {question.questionType}</p><p className="mt-1 text-slate-700">{question.prompt}</p>{question.points ? <p className="mt-1 text-xs font-semibold text-slate-500">{question.points} points</p> : null}</div>)}{template.questions.length > 5 ? <p className="text-sm text-slate-500">+ {template.questions.length - 5} more question(s)</p> : null}</div> : <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">This item has an older or invalid assignment template shape. Metadata is still available.</p>}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-950">Version history</h2>
            <p className="mt-2 text-sm text-slate-600">Recent snapshots list the previous saved versions. Diff viewing is out of scope for v1.</p>
            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><p className="font-bold">Current version {item.version}</p><p>Updated {formatDate(item.updatedAt)}</p></div>
              {item.versions.map((version) => <div key={version.id} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700"><p className="font-bold text-slate-950">Snapshot of version {version.version}</p><p>Saved {formatDate(version.editedAt)}{version.editedBy ? ` by ${version.editedBy.displayName}` : ""}</p></div>)}
              {item.versions.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">No previous snapshots yet. The first metadata edit will save version 1 before creating version 2.</p> : null}
            </div>
          </section>
        </div>

        <aside className="grid gap-6 self-start">
          {canManageItem ? <details open className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm"><summary className="cursor-pointer text-xl font-bold text-slate-950">Edit metadata</summary><form action={updateAction} className="mt-4 grid gap-3"><label className="text-sm font-semibold text-slate-700">Title<input name="title" defaultValue={item.title} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label><label className="text-sm font-semibold text-slate-700">Subject<input name="subject" defaultValue={item.subject ?? ""} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label><label className="text-sm font-semibold text-slate-700">Year group / key stage<input name="yearGroup" defaultValue={item.yearGroup ?? ""} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label><label className="text-sm font-semibold text-slate-700">Unit / topic<input name="unitTopic" defaultValue={item.unitTopic ?? ""} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label><label className="text-sm font-semibold text-slate-700">Tags<input name="tags" defaultValue={item.tags.join(", ")} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label><label className="text-sm font-semibold text-slate-700">Visibility<select name="visibility" defaultValue={item.visibility} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"><option value={CurriculumLibraryVisibility.PRIVATE}>Private</option><option value={CurriculumLibraryVisibility.TEAM}>Team shared</option></select></label><label className="text-sm font-semibold text-slate-700">Shared team<select name="teamId" defaultValue={item.teamId ?? ""} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"><option value="">Choose team</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label><button className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Save metadata snapshot</button></form></details> : <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 text-sm text-slate-600 shadow-sm"><p className="font-bold text-slate-950">View-only source</p><p className="mt-2">You can assign or duplicate this shared item, but only the creator/owner or an admin can edit the reusable source.</p></div>}

          {canUseLibrary && !item.archivedAt ? <form action={assignAction} className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm"><h2 className="text-xl font-bold text-slate-950">Assign independent copies</h2><fieldset className="mt-3 rounded-xl border border-amber-200 bg-white/70 p-3"><legend className="px-1 text-sm font-semibold text-slate-700">Target classes</legend><div className="mt-2 grid max-h-48 gap-2 overflow-auto pr-1">{classes.map((classItem) => <label key={classItem.id} className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"><input name="classIds" type="checkbox" value={classItem.id} className="mt-1" /><span><span className="font-semibold text-slate-950">{classItem.name}</span><br /><span className="text-xs">{classItem.subject} · {classItem.teacher.displayName}{assignedClassIds.has(classItem.id) ? " · already assigned" : ""}</span></span></label>)}</div></fieldset><label className="mt-3 block text-sm font-semibold text-slate-700">Title<input name="title" defaultValue={item.title} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm" /></label><label className="mt-3 block text-sm font-semibold text-slate-700">Due date<input name="dueAt" type="datetime-local" className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm" /></label><label className="mt-3 block text-sm font-semibold text-slate-700">Status<select name="status" defaultValue={HomeworkAssignmentStatus.DRAFT} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm"><option value={HomeworkAssignmentStatus.DRAFT}>Draft</option><option value={HomeworkAssignmentStatus.PUBLISHED}>Published</option></select></label><p className="mt-4 rounded-xl border border-amber-200 bg-white/70 p-3 text-xs text-slate-700">Creates separate assignment records from library version {item.version}; later library edits will not mutate these class copies.</p><button type="submit" className="mt-4 w-full rounded-full bg-amber-500 px-4 py-2 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-amber-400">Assign to selected classes</button></form> : null}
        </aside>
      </section>
    </main>
  );
}
