import { HomeworkAssignmentStatus, UserRole, type UserRole as UserRoleValue } from "@prisma/client";

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
    },
  };
}

