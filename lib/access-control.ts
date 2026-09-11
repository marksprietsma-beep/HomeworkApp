import { ClassStatus, HomeworkAssignmentStatus, UserRole, type UserRole as UserRoleValue } from "@prisma/client";

export const INACTIVE_CLASS_MUTATION_ERROR = "This class is inactive. Reactivate it before making teaching changes.";

export type AccessViewer = {
  id: number;
  role: UserRoleValue;
};

/** Database boundary used whenever a student reads or writes an assignment. */
export function studentAssignmentAccessWhere(assignmentId: number, viewer: AccessViewer | null) {
  return {
    id: assignmentId,
    status: HomeworkAssignmentStatus.PUBLISHED,
    class: {
      status: ClassStatus.ACTIVE,
      enrollments: {
        some: {
          studentId: viewer?.role === UserRole.STUDENT ? viewer.id : -1,
        },
      },
    },
  };
}

/** Database boundary for mutations to a student's released feedback actions. */
export function studentFeedbackActionAccessWhere(
  actionId: number,
  assignmentId: number,
  viewer: AccessViewer | null,
) {
  return {
    id: actionId,
    participantFeedback: {
      assignmentId,
      studentId: viewer?.role === UserRole.STUDENT ? viewer.id : -1,
      releaseState: "RELEASED" as const,
      assignment: { class: { status: ClassStatus.ACTIVE } },
    },
  };
}
