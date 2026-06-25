import { CurriculumLibraryVisibility, HomeworkAssignmentStatus } from "@prisma/client";
import Link from "next/link";
import { assignLibraryItemToClass, archiveLibraryItem, duplicateLibraryItem, updateLibraryItemMetadata } from "./actions";
import { canManageLibraryItem, getAssignableClassesForUser, getCurriculumLibraryData, isAssignmentTemplate, parseCurriculumLibraryFilters } from "../../lib/curriculum-library";
import { getSelectedLocalDevelopmentUser } from "../../lib/local-dev-user";
import { getShareableTeamsForUser } from "../../lib/department-teams";

export const dynamic = "force-dynamic";

type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default async function CurriculumLibraryPage({ searchParams }: Props) {
  const resolvedSearchParams = await searchParams;
  const filters = parseCurriculumLibraryFilters(resolvedSearchParams);
  const { selectedUser } = await getSelectedLocalDevelopmentUser();
  const [data, classes, teams] = await Promise.all([
    getCurriculumLibraryData(filters, selectedUser),
    getAssignableClassesForUser(selectedUser),
    getShareableTeamsForUser(selectedUser),
  ]);
  const canUseLibrary = selectedUser?.role === "ADMIN" || selectedUser?.role === "TEACHER";

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <Link href="/" className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950">← Back to dashboard</Link>
      <section className="mt-8 rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Curriculum homework library</p>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-950">Reusable homework bank</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">Save existing assignments as clean reusable templates, then assign independent class copies later. Submissions, feedback, due dates and release states stay attached to the copied class assignment.</p>
          </div>
          <p className="rounded-2xl bg-slate-950 px-5 py-4 text-sm font-semibold text-white shadow-sm">{data.items.length} item{data.items.length === 1 ? "" : "s"}</p>
        </div>
        {resolvedSearchParams?.saved === "1" ? <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><p className="font-semibold">Saved to library</p><p className="mt-1">The source assignment was copied into a reusable library item without changing the original assignment.</p></div> : null}
        {resolvedSearchParams?.updated === "1" ? <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><p className="font-semibold">Library item updated</p><p className="mt-1">Visibility and metadata changes were saved.</p></div> : null}
        {resolvedSearchParams?.archived === "1" ? <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><p className="font-semibold">Library item archived</p><p className="mt-1">Existing class assignment copies were left unchanged.</p></div> : null}
        {resolvedSearchParams?.assigned ? <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><p className="font-semibold">Assigned to {resolvedSearchParams.assigned} classes</p><p className="mt-1">Separate assignment copies were created for each selected class. Submissions, feedback, release state, due date and reporting remain class-specific.</p></div> : null}
        {!canUseLibrary ? <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Switch to a teacher or admin user to browse and assign curriculum library items.</div> : null}
        <form className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-6">
          <label className="text-sm font-semibold text-slate-700">Search<input name="search" defaultValue={filters.search} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm" /></label>
          <label className="text-sm font-semibold text-slate-700">Subject<select name="subject" defaultValue={filters.subject} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm"><option value="">All subjects</option>{data.subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}</select></label>
          <label className="text-sm font-semibold text-slate-700">Year group<select name="yearGroup" defaultValue={filters.yearGroup} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm"><option value="">All years</option>{data.yearGroups.map((yearGroup) => <option key={yearGroup} value={yearGroup}>{yearGroup}</option>)}</select></label>
          <label className="text-sm font-semibold text-slate-700">Tag<select name="tag" defaultValue={filters.tag} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm"><option value="">All tags</option>{data.tags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}</select></label>
          <label className="text-sm font-semibold text-slate-700">Scope<select name="scope" defaultValue={filters.scope} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm"><option value="all">All available</option><option value="mine">My items</option><option value="team">Team items</option></select></label><div className="flex gap-2 self-end"><button type="submit" className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm">Apply</button><Link href="/curriculum-library" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">Reset</Link></div>
        </form>
      </section>

      <section className="mt-8 grid gap-5">
        {data.items.length === 0 ? <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-sm text-slate-600">No reusable homework has been saved yet. Open an assignment detail page and use “Save to curriculum library”.</div> : null}
        {data.items.map((item) => {
          const template = isAssignmentTemplate(item.assignmentJson) ? item.assignmentJson : null;
          const action = assignLibraryItemToClass.bind(null, item.id);
          const updateAction = updateLibraryItemMetadata.bind(null, item.id);
          const archiveAction = archiveLibraryItem.bind(null, item.id);
          const duplicateAction = duplicateLibraryItem.bind(null, item.id);
          const canManageItem = canManageLibraryItem(selectedUser, item);
          const assignedClassIds = new Set(item.assignedCopies.map((copy) => copy.classId));
          const alreadyAssignedClasses = classes.filter((classItem) => assignedClassIds.has(classItem.id));
          return <article key={item.id} className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <Link href={`/curriculum-library/${item.id}`} className="text-2xl font-bold text-slate-950 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-950">{item.title}</Link>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
                  {item.subject ? <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-900">{item.subject}</span> : null}
                  {item.yearGroup ? <span className="rounded-full bg-slate-100 px-3 py-1">{item.yearGroup}</span> : null}
                  {item.unitTopic ? <span className="rounded-full bg-slate-100 px-3 py-1">{item.unitTopic}</span> : null}
                  {item.visibility === CurriculumLibraryVisibility.TEAM ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-900">Shared with {item.team?.name ?? "team"}</span> : <span className="rounded-full bg-slate-100 px-3 py-1">Private</span>}
                  {item.tags.map((tag) => <span key={tag} className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">#{tag}</span>)}
                </div>
                <p className="mt-3 text-sm text-slate-600">v{item.version} · {template?.questions.length ?? 0} questions · Updated {formatDate(item.updatedAt)} · Created {formatDate(item.createdAt)}{item.createdBy ? ` by ${item.createdBy.displayName}` : ""}</p>
              </div>
              <div className="grid gap-3">
              {canUseLibrary && !canManageItem ? <form action={duplicateAction}><button className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">Duplicate private copy</button></form> : null}
              {canManageItem ? <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4"><summary className="cursor-pointer text-sm font-bold text-slate-900">Edit library metadata</summary><form action={updateAction} className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700">Title<input name="title" defaultValue={item.title} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label><label className="text-sm font-semibold text-slate-700">Subject<input name="subject" defaultValue={item.subject ?? ""} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label><label className="text-sm font-semibold text-slate-700">Year group<input name="yearGroup" defaultValue={item.yearGroup ?? ""} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label><label className="text-sm font-semibold text-slate-700">Unit / topic<input name="unitTopic" defaultValue={item.unitTopic ?? ""} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Tags<input name="tags" defaultValue={item.tags.join(", ")} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label><label className="text-sm font-semibold text-slate-700">Visibility<select name="visibility" defaultValue={item.visibility} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"><option value={CurriculumLibraryVisibility.PRIVATE}>Private</option><option value={CurriculumLibraryVisibility.TEAM}>Team shared</option></select></label><label className="text-sm font-semibold text-slate-700">Shared team<select name="teamId" defaultValue={item.teamId ?? ""} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"><option value="">Choose team</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label><button className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Save metadata</button></form><div className="mt-3 flex flex-wrap gap-2"><form action={duplicateAction}><button className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Duplicate private copy</button></form><form action={archiveAction}><button className="rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700">Archive library item</button></form></div><p className="mt-3 text-xs text-slate-500">Content editing is intentionally deferred for v1; metadata edits snapshot the previous bilingual assignment JSON.</p></details> : null}
              </div>
              {canUseLibrary ? <form action={action} className="rounded-2xl border border-amber-200 bg-amber-50 p-4 lg:min-w-80">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">Assign copies</p>
                <fieldset className="mt-3 rounded-xl border border-amber-200 bg-white/70 p-3">
                  <legend className="px-1 text-sm font-semibold text-slate-700">Target classes</legend>
                  <div className="mt-2 grid max-h-48 gap-2 overflow-auto pr-1">
                    {classes.map((classItem) => <label key={classItem.id} className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"><input name="classIds" type="checkbox" value={classItem.id} className="mt-1" /><span><span className="font-semibold text-slate-950">{classItem.name}</span><br /><span className="text-xs">{classItem.subject} · {classItem.teacher.displayName}{assignedClassIds.has(classItem.id) ? " · already assigned" : ""}</span></span></label>)}
                  </div>
                </fieldset>
                {alreadyAssignedClasses.length > 0 ? <p className="mt-3 rounded-xl border border-amber-300 bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-900">Duplicate warning: this library item already has assignment copies for {alreadyAssignedClasses.map((classItem) => classItem.name).join(", ")}. Uncheck those classes unless you intentionally need another copy.</p> : null}
                <label className="mt-3 block text-sm font-semibold text-slate-700">Title<input name="title" defaultValue={item.title} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm" /></label>
                <label className="mt-3 block text-sm font-semibold text-slate-700">Due date<input name="dueAt" type="datetime-local" className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm" /></label>
                <label className="mt-3 block text-sm font-semibold text-slate-700">Status<select name="status" defaultValue={HomeworkAssignmentStatus.DRAFT} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm"><option value={HomeworkAssignmentStatus.DRAFT}>Draft</option><option value={HomeworkAssignmentStatus.PUBLISHED}>Published</option></select></label>
                <div className="mt-4 rounded-xl border border-amber-200 bg-white/70 p-3 text-xs text-slate-700"><p className="font-bold text-slate-900">Before publishing</p><p className="mt-1">Creates one independent assignment copy per selected class using library version {item.version}, bilingual content, due date and status above.</p></div><button type="submit" className="mt-4 w-full rounded-full bg-amber-500 px-4 py-2 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-amber-400">Assign to selected classes</button>
              </form> : null}
            </div>
          </article>;
        })}
      </section>
    </main>
  );
}
