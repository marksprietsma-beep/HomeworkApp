import { redirect } from "next/navigation";
import { ClarionLogo } from "../components/clarion-logo";
import { getCurrentUser } from "../../lib/auth";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (process.env.NODE_ENV !== "production") redirect("/");
  if (await getCurrentUser()) redirect("/");
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <ClarionLogo className="mb-8 self-start" />
      <h1 className="text-3xl font-bold text-slate-950">Sign in to Clarion</h1>
      <p className="mt-2 text-slate-600">Use your school email address to sign in.</p>
      <LoginForm />
    </main>
  );
}
