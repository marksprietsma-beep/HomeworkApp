"use client";

import { useActionState } from "react";
import { initialProfileImageActionState, removeOwnProfileImage, updateOwnProfileImage } from "./actions";

function Result({ state }: { state: typeof initialProfileImageActionState }) {
  return state.error || state.success ? <p role={state.error ? "alert" : "status"} className={`text-sm font-semibold ${state.error ? "text-red-700" : "text-emerald-700"}`}>{state.error ?? state.success}</p> : null;
}

export function ProfileImageForms({ hasImage }: { hasImage: boolean }) {
  const [uploadState, uploadAction, uploadPending] = useActionState(updateOwnProfileImage, initialProfileImageActionState);
  const [removeState, removeAction, removePending] = useActionState(removeOwnProfileImage, initialProfileImageActionState);
  return <div className="grid gap-5">
    <form action={uploadAction} className="grid gap-3"><label className="text-sm font-semibold text-slate-800">Choose an image<input name="profileImage" type="file" required accept="image/png,image/jpeg,image/webp" className="mt-2 block w-full rounded-xl border border-slate-300 bg-white p-3 text-sm" /></label><p className="text-xs text-slate-500">PNG, JPEG, or WEBP. Maximum 5 MB. Images are cropped to fit the avatar.</p><button disabled={uploadPending} className="w-fit rounded-full bg-slate-950 px-5 py-2.5 text-sm font-bold text-white disabled:bg-slate-400">{uploadPending ? "Uploading…" : hasImage ? "Replace picture" : "Upload picture"}</button><Result state={uploadState} /></form>
    {hasImage ? <form action={removeAction} className="border-t border-slate-200 pt-5"><button disabled={removePending} className="rounded-full border border-red-300 px-5 py-2.5 text-sm font-bold text-red-800 disabled:text-slate-400">{removePending ? "Removing…" : "Remove picture"}</button><Result state={removeState} /></form> : null}
  </div>;
}
