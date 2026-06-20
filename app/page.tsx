export default function Home() {
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
    </main>
  );
}
