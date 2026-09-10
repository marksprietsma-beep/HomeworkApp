import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUserState } from "../../../../lib/auth";
import { getClassLeaderboard } from "../../../../lib/leaderboard";
import { StudentAvatar } from "../../../components/student-avatar";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage({ params }: { params: Promise<{ classId: string }> }) {
  const classId = Number((await params).classId);
  if (!Number.isInteger(classId)) notFound();
  const { selectedUser } = await getCurrentUserState();
  const result = await getClassLeaderboard(classId, selectedUser);
  if (!result.found) notFound();
  if (!result.allowed || !result.leaderboard) return <main className="mx-auto min-h-screen max-w-3xl px-6 py-12"><Link href="/" className="font-semibold text-slate-700">← Back</Link><section className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-8"><h1 className="text-3xl font-bold">Leaderboard unavailable</h1><p className="mt-3 text-slate-700">This leaderboard is disabled or you are not currently enrolled in this class.</p></section></main>;
  const board = result.leaderboard;
  return <main className="mx-auto min-h-screen max-w-4xl px-6 py-12"><Link href={selectedUser?.role === "STUDENT" ? "/" : `/classes/${classId}`} className="font-semibold text-slate-700">← Back</Link><section className="mt-8 rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">{board.name}</p><h1 className="mt-2 text-4xl font-bold text-slate-950">Class leaderboard</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Homework Points reward both completing work and the quality of released teacher-reviewed work. Each submitted homework earns 10 points, with up to 10 additional points from released feedback.</p>{!board.enabled && selectedUser?.role !== "STUDENT" ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">Teacher preview — currently hidden from students.</p> : null}<ol className="mt-8 grid gap-3">{board.rows.map((row) => { const current = row.studentId === selectedUser?.id; return <li key={row.studentId} className={`grid grid-cols-[3rem_auto_1fr] items-center gap-3 rounded-2xl border p-4 sm:grid-cols-[3rem_auto_1fr_auto] ${current ? "border-cyan-400 bg-cyan-50 ring-2 ring-cyan-100" : "border-slate-200 bg-slate-50"}`}><span className="text-xl font-black text-slate-500">#{row.rank}</span><StudentAvatar displayName={row.displayName} imagePath={row.profileImagePath} size="sm" /><div><p className="font-bold text-slate-950">{row.displayName}{current ? " (You)" : ""}</p><p className="text-sm text-slate-600">{row.completedAssignments} completed</p></div><p className="col-start-3 text-lg font-black text-cyan-900 sm:col-start-auto">{row.homeworkPoints} pts</p></li>; })}</ol></section></main>;
}
