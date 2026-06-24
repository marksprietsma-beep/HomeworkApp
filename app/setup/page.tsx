import Link from "next/link";
import { redirect } from "next/navigation";
import { hasInitialAdminUser } from "../../lib/first-run-setup";
import { FirstRunSetupForm } from "./first-run-setup-form";
import { ClarionLogo, CLARION_TAGLINE } from "../components/clarion-logo";

export const dynamic = "force-dynamic";

export default async function FirstRunSetupPage() {
  if (await hasInitialAdminUser()) {
    redirect("/");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
      <ClarionLogo className="mb-6 inline-flex items-center gap-3 self-start" />
      <p className="mb-4 rounded-full border border-emerald-200 px-4 py-1 text-sm font-medium text-emerald-700 self-start">First-run setup</p>
      <h1 className="text-4xl font-bold tracking-tight text-slate-950">Create the initial admin</h1>
      <p className="mt-4 text-base leading-7 text-slate-600">{CLARION_TAGLINE} This clean-start database has no ADMIN user yet. Create exactly one initial admin account before adding teachers, students, classes, assignments, submissions, or feedback.</p>
      <p className="mt-3 text-sm leading-6 text-slate-500">After an ADMIN exists, this setup page closes automatically. Passwords are stored with the existing local scrypt hashing helper.</p>
      <FirstRunSetupForm />
      <Link href="/" className="mt-6 text-sm font-semibold text-amber-700 hover:text-amber-800">← Back to dashboard</Link>
    </main>
  );
}
