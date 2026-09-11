import Link from "next/link";
import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { requireRole } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import { StudentAvatar } from "../components/student-avatar";
import { ProfileImageForms } from "./profile-image-forms";
import { AppearanceForm } from "./appearance-form";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const viewer = await requireRole(UserRole.STUDENT, UserRole.ADMIN).catch(() => null);
  if (!viewer) redirect("/");
  const account = await prisma.user.findUniqueOrThrow({ where: { id: viewer.id }, select: { displayName: true, profileImagePath: true, themePreference: true, textSizePreference: true } });
  const isStudent = viewer.role === UserRole.STUDENT;
  return <main className="min-h-screen bg-slate-50 px-4 py-10"><div className="mx-auto max-w-2xl"><Link href="/" className="text-sm font-semibold text-slate-600">← Dashboard</Link><div className="mt-6 grid gap-6">{isStudent ? <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">Student settings</p><div className="mt-5 flex items-center gap-5"><StudentAvatar displayName={account.displayName} imagePath={account.profileImagePath} size="lg" /><div><h1 className="text-3xl font-bold text-slate-950">Profile picture</h1><p className="mt-2 text-slate-600">Shown with your identity inside Clarion.</p></div></div><div className="mt-8"><ProfileImageForms hasImage={Boolean(account.profileImagePath)} /></div></section> : <header><p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">Admin settings</p><h1 className="mt-3 text-3xl font-bold text-slate-950">Account settings</h1><p className="mt-2 text-slate-600">Personalise Clarion for {account.displayName}.</p></header>}<section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">Accessibility</p><h2 className="mt-3 text-3xl font-bold text-slate-950">Appearance</h2><p className="mt-2 text-slate-600">Choose how Clarion looks and reads on every device where you sign in.</p><AppearanceForm themePreference={account.themePreference} textSizePreference={account.textSizePreference} /></section></div></div></main>;
}
