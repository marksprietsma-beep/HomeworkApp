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
