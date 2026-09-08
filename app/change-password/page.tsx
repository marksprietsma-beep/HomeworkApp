import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/auth";
import { ClarionLogo } from "../components/clarion-logo";
import { logoutAction } from "../login/actions";
import { ChangePasswordForm } from "./change-password-form";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  if (process.env.NODE_ENV !== "production") redirect("/");
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.mustChangePassword) redirect("/");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <ClarionLogo className="mb-8 self-start" />
      <h1 className="text-3xl font-bold text-slate-950">Choose a permanent password</h1>
      <p className="mt-3 leading-7 text-slate-600">Your temporary password has signed you in, but you must replace it before using Clarion. Use at least 8 characters and choose a different password.</p>
      <ChangePasswordForm />
      <form action={logoutAction} className="mt-5 text-center">
        <button className="text-sm font-semibold text-slate-600 hover:text-slate-950">Sign out instead</button>
      </form>
    </main>
  );
}
