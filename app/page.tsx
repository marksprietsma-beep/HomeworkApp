import { switchLocalDevelopmentUser } from "./actions/local-dev-user";
import {
  canUseLocalDevelopmentSwitcher,
  getSelectedLocalDevelopmentUser,
} from "../lib/local-dev-user";

export const dynamic = "force-dynamic";

type LocalDevelopmentSwitcherProps = Awaited<
  ReturnType<typeof getSelectedLocalDevelopmentUser>
>;

function LocalDevelopmentSwitcher({
  selectedUser,
  developmentUsers,
}: LocalDevelopmentSwitcherProps) {
  if (!canUseLocalDevelopmentSwitcher()) {
    return null;
  }

  return (
    <section className="mt-10 w-full max-w-2xl rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 p-6 text-left shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">
        Local development only — not authentication
      </p>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">
            Temporary role/user switcher
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            This uses a local cookie to help test seeded teacher and student
            views before real authentication exists. Do not treat this as
            login, authorization, or production security.
          </p>
        </div>
        <div className="rounded-xl bg-white px-4 py-3 text-sm shadow-sm ring-1 ring-amber-200">
          <p className="font-medium text-slate-500">Currently viewing as</p>
          <p className="mt-1 font-semibold text-slate-950">
            {selectedUser?.displayName ?? "No seeded user found"}
          </p>
          <p className="text-amber-700">{selectedUser?.role ?? "UNKNOWN"}</p>
        </div>
      </div>

      <form
        action={switchLocalDevelopmentUser}
        className="mt-6 flex flex-col gap-3 sm:flex-row"
      >
        <label className="flex-1 text-sm font-medium text-slate-700">
          Seeded test user
          <select
            name="userId"
            defaultValue={selectedUser?.id}
            disabled={developmentUsers.length === 0}
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:bg-slate-100"
          >
            {developmentUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName} — {user.role}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={developmentUsers.length === 0}
          className="rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400 sm:self-end"
        >
          Switch local view
        </button>
      </form>
      {developmentUsers.length === 0 ? (
        <p className="mt-4 text-sm text-red-700">
          No seeded development users were found. Run migrations and `npm run
          db:seed` locally.
        </p>
      ) : null}
    </section>
  );
}

export default async function Home() {
  let localDevelopmentUserState: LocalDevelopmentSwitcherProps = {
    selectedUser: null,
    developmentUsers: [],
  };
  let localDevelopmentUserError: string | null = null;

  if (canUseLocalDevelopmentSwitcher()) {
    try {
      localDevelopmentUserState = await getSelectedLocalDevelopmentUser();
    } catch {
      localDevelopmentUserError =
        "Local development users could not be loaded. Confirm PostgreSQL is running, migrations are applied, and seed data exists.";
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-6 py-16 text-center">
      <p className="mb-4 rounded-full border border-slate-200 px-4 py-1 text-sm font-medium text-slate-600">
        Local-first foundation
      </p>
      <h1 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-6xl">
        Homework App
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
        A lightweight starting point for running Homework App locally during
        development and later on a generic Linux or Docker-capable school
        server.
      </p>
      {localDevelopmentUserError ? (
        <section className="mt-10 w-full max-w-2xl rounded-2xl border border-red-200 bg-red-50 p-6 text-left text-sm text-red-800">
          <p className="font-semibold">Local development switcher unavailable</p>
          <p className="mt-2">{localDevelopmentUserError}</p>
        </section>
      ) : (
        <LocalDevelopmentSwitcher {...localDevelopmentUserState} />
      )}
    </main>
  );
}
