import { redirect } from "next/navigation";
import { canUseLocalDevelopmentSwitcher, getCurrentUser } from "../../lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  if (canUseLocalDevelopmentSwitcher()) redirect("/");
  if (await getCurrentUser()) redirect("/");
  return <main className="mx-auto flex min-h-screen max-w-md items-center px-6"><section className="w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"><h1 className="text-3xl font-bold text-slate-950">Sign in to Clarion</h1><p className="mt-2 text-slate-600">Use your school email and password.</p><LoginForm /></section></main>;
}
