import Link from "next/link";
import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { requireRole } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import { StudentAvatar } from "../components/student-avatar";
import { ProfileImageForms } from "./profile-image-forms";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const viewer = await requireRole(UserRole.STUDENT).catch(() => null);
  if (!viewer) redirect("/");
  const student = await prisma.user.findUniqueOrThrow({ where: { id: viewer.id }, select: { displayName: true, profileImagePath: true } });
  return <main className="min-h-screen bg-slate-50 px-4 py-10"><div className="mx-auto max-w-2xl"><Link href="/" className="text-sm font-semibold text-slate-600">← Dashboard</Link><section className="mt-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">Student settings</p><div className="mt-5 flex items-center gap-5"><StudentAvatar displayName={student.displayName} imagePath={student.profileImagePath} size="lg" /><div><h1 className="text-3xl font-bold text-slate-950">Profile picture</h1><p className="mt-2 text-slate-600">Shown with your identity inside Clarion.</p></div></div><div className="mt-8"><ProfileImageForms hasImage={Boolean(student.profileImagePath)} /></div></section></div></main>;
}
