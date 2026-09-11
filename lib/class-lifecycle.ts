import { ClassStatus } from "@prisma/client";

export function classPurgeConfirmationMatches(confirmation: string, className: string) {
  const value = confirmation.trim();
  return value === "DELETE" || value === className;
}

export function classCanBePurged(status: ClassStatus) {
  return status === ClassStatus.INACTIVE;
}

export function nextClassStatus(status: ClassStatus) {
  return status === ClassStatus.ACTIVE ? ClassStatus.INACTIVE : ClassStatus.ACTIVE;
}

export function classMetadataUpdateData(input: { name: string; subject: string; description: string; teacherId: number }) {
  return { name: input.name, subject: input.subject, description: input.description, teacherId: input.teacherId };
}

export function canMutateClassFeedback(status: ClassStatus, ownsClass: boolean) {
  return status === ClassStatus.ACTIVE && ownsClass;
}
