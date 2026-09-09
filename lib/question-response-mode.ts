export type ResponseMode = "TEXT" | "PSEUDOCODE" | "STRUCTURED";

export function assertManualCreateResponseMode(mode: string): asserts mode is Exclude<ResponseMode, "STRUCTURED"> {
  if (mode === "STRUCTURED") throw new Error("Structured questions can only be created through validated JSON import.");
}

export function assertSafeResponseModeEdit(existing: ResponseMode, requested: ResponseMode, hasResponses: boolean) {
  if (existing === "STRUCTURED" && requested !== "STRUCTURED") throw new Error("Structured response mode cannot be changed in the ordinary editor.");
  if (existing !== "STRUCTURED" && requested === "STRUCTURED") throw new Error("Structured questions can only be created through validated JSON import.");
  if (hasResponses && existing !== requested) throw new Error("Response mode changes are disabled once students have responses.");
}

export function submissionStateAfterSave(existing: { status: string; submittedAt: Date | null } | null, wantsDraft: boolean, now: Date) {
  if (wantsDraft && existing?.status === "SUBMITTED") return { status: "SUBMITTED" as const, submittedAt: existing.submittedAt };
  return wantsDraft ? { status: "DRAFT" as const, submittedAt: null } : { status: "SUBMITTED" as const, submittedAt: now };
}
