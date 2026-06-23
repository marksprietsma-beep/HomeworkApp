"use client";

import { AccountStatus, UserRole } from "@prisma/client";
import { useActionState } from "react";
import { createManagedUser, deleteOrDeactivateManagedUser, forcePurgeManagedUser, reactivateManagedUser, updateManagedUser, type AdminUserFormState } from "./actions";

type ManagedUser = {
  id: number;
  email: string;
  displayName: string;
  role: UserRole;
  accountStatus: AccountStatus;
  yearGroup: string | null;
  isEditable: boolean;
  linkedDataSummary: string;
};

const initialState: AdminUserFormState = { error: null, success: null };

function FormMessage({ state }: { state: AdminUserFormState }) {
  if (state.error) return <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{state.error}</p>;
  if (state.success) return <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{state.success}</p>;
  return null;
}

export function CreateManagedUserForm() {
  const [state, formAction, isPending] = useActionState(createManagedUser, initialState);

  return (
    <form action={formAction} className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Create account</p>
        <h2 className="mt-2 text-2xl font-bold text-slate-950">Manual teacher/student setup</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Temporary passwords are hashed before saving. Share credentials out-of-band; no email is sent.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700">Display name<input name="displayName" required className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm" placeholder="e.g. Sam Rivera" /></label>
        <label className="text-sm font-semibold text-slate-700">Email / login identifier<input name="email" type="email" required className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm" placeholder="sam@example.test" /></label>
        <label className="text-sm font-semibold text-slate-700">Role<select name="role" required defaultValue={UserRole.STUDENT} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm"><option value={UserRole.STUDENT}>Student</option><option value={UserRole.TEACHER}>Teacher</option></select></label>
        <label className="text-sm font-semibold text-slate-700">Year group (students)<select name="yearGroup" defaultValue="" className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm"><option value="">Not set / teacher</option><option value="Y7">Y7</option><option value="Y8">Y8</option><option value="Y9">Y9</option><option value="Y10">Y10</option><option value="Y11">Y11</option><option value="Y12">Y12</option><option value="Y13">Y13</option></select></label>
        <label className="text-sm font-semibold text-slate-700">Account status<select name="accountStatus" required defaultValue={AccountStatus.ACTIVE} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm"><option value={AccountStatus.ACTIVE}>Active</option><option value={AccountStatus.DISABLED}>Disabled</option></select></label>
        <label className="text-sm font-semibold text-slate-700 md:col-span-2">Temporary password<input name="temporaryPassword" type="password" required minLength={8} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm" placeholder="At least 8 characters" /></label>
      </div>
      <FormMessage state={state} />
      <button type="submit" disabled={isPending} className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400 md:justify-self-start">{isPending ? "Creating…" : "Create account"}</button>
    </form>
  );
}

export function EditableUserRow({ user }: { user: ManagedUser }) {
  const [state, formAction, isPending] = useActionState(updateManagedUser, initialState);
  const [deleteState, deleteAction, isDeleting] = useActionState(deleteOrDeactivateManagedUser, initialState);
  const [reactivateState, reactivateAction, isReactivating] = useActionState(reactivateManagedUser, initialState);
  const [purgeState, purgeAction, isPurging] = useActionState(forcePurgeManagedUser, initialState);

  if (!user.isEditable) {
    return <tr className="border-t border-slate-200 bg-slate-50/70"><td className="px-4 py-3 font-semibold text-slate-950">{user.displayName}</td><td className="px-4 py-3 text-slate-600">{user.email}</td><td className="px-4 py-3">{user.role}{user.yearGroup ? <span className="block text-xs text-slate-500">{user.yearGroup}</span> : null}</td><td className="px-4 py-3">{user.accountStatus}</td><td className="px-4 py-3 text-sm text-slate-500">Read-only seeded/admin account<span className="mt-1 block text-xs">{user.linkedDataSummary}</span></td></tr>;
  }

  const isDisabled = user.accountStatus === AccountStatus.DISABLED;

  return (
    <tr className={`border-t border-slate-200 align-top ${isDisabled ? "bg-slate-50/60" : ""}`}>
      <td colSpan={5} className="px-4 py-4">
        <form action={formAction} className="grid gap-3 lg:grid-cols-[1.1fr_1.3fr_0.7fr_0.7fr_0.8fr_auto_auto] lg:items-end">
          <input type="hidden" name="userId" value={user.id} />
          <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Name<input name="displayName" required defaultValue={user.displayName} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-950" /></label>
          <div className="text-sm"><span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Email/login</span><p className="mt-2 break-all font-medium text-slate-700">{user.email}</p></div>
          <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Role<select name="role" defaultValue={user.role} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-950"><option value={UserRole.STUDENT}>Student</option><option value={UserRole.TEACHER}>Teacher</option></select></label>
          <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Year group<select name="yearGroup" defaultValue={user.yearGroup ?? ""} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-950"><option value="">—</option><option value="Y7">Y7</option><option value="Y8">Y8</option><option value="Y9">Y9</option><option value="Y10">Y10</option><option value="Y11">Y11</option><option value="Y12">Y12</option><option value="Y13">Y13</option></select></label>
          <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Status<select name="accountStatus" defaultValue={user.accountStatus} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-950"><option value={AccountStatus.ACTIVE}>Active</option><option value={AccountStatus.DISABLED}>Disabled</option></select></label>
          <button type="submit" disabled={isPending} className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-sm disabled:bg-slate-300">{isPending ? "Saving…" : "Save"}</button>
          <div className="lg:col-span-7"><FormMessage state={state} /></div>
        </form>
        <p className="mt-3 text-xs text-slate-500"><span className="font-semibold text-slate-700">Linked data:</span> {user.linkedDataSummary}</p>
        <div className="mt-3 grid gap-3 rounded-2xl border border-slate-200 bg-white p-3">
          {isDisabled ? <form action={reactivateAction} onSubmit={(event) => { if (!window.confirm(`Reactivate ${user.displayName}? They will be eligible for normal selectors again.`)) event.preventDefault(); }} className="flex flex-col gap-2 sm:flex-row sm:items-center"><input type="hidden" name="userId" value={user.id} /><button type="submit" disabled={isReactivating} className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:bg-slate-300">{isReactivating ? "Reactivating…" : "Reactivate"}</button><div className="sm:flex-1"><FormMessage state={reactivateState} /></div></form> : null}
          <form action={deleteAction} onSubmit={(event) => { if (!window.confirm(`Remove ${user.displayName}? Users with linked history will be deactivated instead of hard-deleted.`)) event.preventDefault(); }} className="flex flex-col gap-2 sm:flex-row sm:items-center"><input type="hidden" name="userId" value={user.id} /><button type="submit" disabled={isDeleting} className="rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-50 disabled:border-slate-200 disabled:text-slate-400">{isDeleting ? "Removing…" : "Delete / deactivate"}</button><div className="sm:flex-1"><FormMessage state={deleteState} /></div></form>
          <form action={purgeAction} onSubmit={(event) => { if (!window.confirm(`FORCE PURGE ${user.displayName}? This permanently deletes the user and linked records listed above.`)) event.preventDefault(); }} className="grid gap-2 border-t border-red-100 pt-3 sm:grid-cols-[1fr_auto] sm:items-end"><input type="hidden" name="userId" value={user.id} /><label className="text-xs font-bold uppercase tracking-[0.14em] text-red-700">Force purge confirmation<span className="mt-1 block font-medium normal-case tracking-normal text-slate-600">Type DELETE or {user.email}</span><input name="confirmation" className="mt-1 w-full rounded-lg border border-red-200 px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-950" placeholder="DELETE" /></label><button type="submit" disabled={isPurging} className="rounded-full bg-red-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-600 disabled:bg-slate-300">{isPurging ? "Purging…" : "Force purge"}</button><div className="sm:col-span-2"><FormMessage state={purgeState} /></div></form>
        </div>
      </td>
    </tr>
  );
}
