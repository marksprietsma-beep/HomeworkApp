"use client";

import { AccountStatus, UserRole } from "@prisma/client";
import { useActionState } from "react";
import { createManagedUser, updateManagedUser, type AdminUserFormState } from "./actions";

type ManagedUser = {
  id: number;
  email: string;
  displayName: string;
  role: UserRole;
  accountStatus: AccountStatus;
  isEditable: boolean;
};

const initialState: AdminUserFormState = { error: null, success: null };

function FormMessage({ state }: { state: AdminUserFormState }) {
  if (state.error) {
    return <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{state.error}</p>;
  }
  if (state.success) {
    return <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{state.success}</p>;
  }
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
        <label className="text-sm font-semibold text-slate-700">Display name
          <input name="displayName" required className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm" placeholder="e.g. Sam Rivera" />
        </label>
        <label className="text-sm font-semibold text-slate-700">Email / login identifier
          <input name="email" type="email" required className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm" placeholder="sam@example.test" />
        </label>
        <label className="text-sm font-semibold text-slate-700">Role
          <select name="role" required defaultValue={UserRole.STUDENT} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm">
            <option value={UserRole.STUDENT}>Student</option>
            <option value={UserRole.TEACHER}>Teacher</option>
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">Account status
          <select name="accountStatus" required defaultValue={AccountStatus.ACTIVE} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm">
            <option value={AccountStatus.ACTIVE}>Active</option>
            <option value={AccountStatus.DISABLED}>Disabled</option>
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700 md:col-span-2">Temporary password
          <input name="temporaryPassword" type="password" required minLength={8} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm" placeholder="At least 8 characters" />
        </label>
      </div>
      <FormMessage state={state} />
      <button type="submit" disabled={isPending} className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400 md:justify-self-start">{isPending ? "Creating…" : "Create account"}</button>
    </form>
  );
}

export function EditableUserRow({ user }: { user: ManagedUser }) {
  const [state, formAction, isPending] = useActionState(updateManagedUser, initialState);

  if (!user.isEditable) {
    return (
      <tr className="border-t border-slate-200 bg-slate-50/70">
        <td className="px-4 py-3 font-semibold text-slate-950">{user.displayName}</td><td className="px-4 py-3 text-slate-600">{user.email}</td><td className="px-4 py-3">{user.role}</td><td className="px-4 py-3">{user.accountStatus}</td><td className="px-4 py-3 text-sm text-slate-500">Read-only seeded/admin account</td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-slate-200 align-top">
      <td colSpan={5} className="px-4 py-4">
        <form action={formAction} className="grid gap-3 lg:grid-cols-[1.2fr_1.4fr_0.8fr_0.8fr_auto] lg:items-end">
          <input type="hidden" name="userId" value={user.id} />
          <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Name<input name="displayName" required defaultValue={user.displayName} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-950" /></label>
          <div className="text-sm"><span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Email/login</span><p className="mt-2 break-all font-medium text-slate-700">{user.email}</p></div>
          <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Role<select name="role" defaultValue={user.role} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-950"><option value={UserRole.STUDENT}>Student</option><option value={UserRole.TEACHER}>Teacher</option></select></label>
          <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Status<select name="accountStatus" defaultValue={user.accountStatus} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-950"><option value={AccountStatus.ACTIVE}>Active</option><option value={AccountStatus.DISABLED}>Disabled</option></select></label>
          <button type="submit" disabled={isPending} className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-sm disabled:bg-slate-300">{isPending ? "Saving…" : "Save"}</button>
          <div className="lg:col-span-5"><FormMessage state={state} /></div>
        </form>
      </td>
    </tr>
  );
}
