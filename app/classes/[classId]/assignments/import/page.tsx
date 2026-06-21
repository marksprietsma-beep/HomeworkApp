import Link from "next/link";
import { notFound } from "next/navigation";
import { getClassDetailData } from "../../../../../lib/class-detail";
import { ImportAssignmentForm } from "./import-assignment-form";

export const dynamic = "force-dynamic";

type ImportAssignmentPageProps = {
  params: Promise<{
    classId: string;
  }>;
};

export default async function ImportAssignmentPage({ params }: ImportAssignmentPageProps) {
  const { classId } = await params;
  const parsedClassId = Number(classId);

  if (!Number.isInteger(parsedClassId)) {
    notFound();
  }

  const classDetail = await getClassDetailData(parsedClassId);

  if (!classDetail) {
    notFound();
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <Link
        href={`/classes/${classDetail.id}`}
        className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
      >
        ← Back to class details
      </Link>

      <section className="mt-8 rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
          JSON workflow
        </p>
        <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-950">
              Import homework for {classDetail.name}
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
              Paste ChatGPT-generated assignment JSON, validate it, preview every
              question, then create local assignment and question records after
              confirmation.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-950 px-5 py-4 text-white shadow-sm lg:min-w-72">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
              Import target
            </p>
            <p className="mt-2 text-lg font-semibold">{classDetail.name}</p>
            <p className="mt-1 text-sm text-amber-200">
              {classDetail.totals.assignments} existing assignments
            </p>
          </div>
        </div>
      </section>

      <ImportAssignmentForm classId={classDetail.id} />
    </main>
  );
}
