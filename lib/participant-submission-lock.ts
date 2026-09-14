import { Prisma } from "@prisma/client";

/** Build the two-INT4 PostgreSQL advisory lock used for one assignment/student. */
export function participantSubmissionAdvisoryLockQuery(assignmentId: number, studentId: number) {
  return Prisma.sql`SELECT pg_advisory_xact_lock(${assignmentId}::int, ${studentId}::int)`;
}
