import Link from "next/link";
import { getSelectedLocalDevelopmentUser } from "../../../lib/local-dev-user";
import { CreateClassForm } from "./create-class-form";

export const dynamic = "force-dynamic";

export default async function NewClassPage() {
  const { selectedUser } = await getSelectedLocalDevelopmentUser();
  const canCreateClass = selectedUser?.role === "TEACHER";

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-12">
      <Link
        href="/"
        className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
      >
        ← Back to dashboard
      </Link>

      <section className="mt-8 rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
          Teacher class setup
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950">
          Create a class
        </h1>
        <p className="mt-3 text-base leading-7 text-slate-600">
          Use the temporary local teacher user to create a class, choose a subject,
          and then add assignments from the class detail page.
        </p>

        <div className="mt-6 rounded-2xl bg-slate-950 px-5 py-4 text-white shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
            Current local user
          </p>
          <p className="mt-2 text-lg font-semibold">
            {selectedUser?.displayName ?? "No local user selected"}
          </p>
          <p className="text-sm text-amber-200">{selectedUser?.role ?? "UNKNOWN"}</p>
        </div>

        {canCreateClass ? (
          <CreateClassForm />
        ) : (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
            Class creation is available to teacher users only. Return to the
            dashboard and switch the temporary local view to the seeded teacher.
          </div>
        )}
      </section>
    </main>
  );
}
