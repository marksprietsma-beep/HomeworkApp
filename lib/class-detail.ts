import { AccountStatus, UserRole } from "@prisma/client";
import { prisma } from "./prisma";

export type ClassDetailData = {
  id: number;
  name: string;
  subject: string;
  description: string;
  teacher: {
    id: number;
    displayName: string;
    email: string;
  };
  enrolledUsers: {
    id: number;
    displayName: string;
    email: string;
    role: string;
    accountStatus: string;
    yearGroup: string | null;
    enrolledAt: Date;
  }[];
  availableStudents: {
    id: number;
    displayName: string;
    email: string;
    accountStatus: string;
    yearGroup: string | null;
  }[];
  assignments: {
    id: number;
    title: string;
    description: string | null;
    status: string;
    dueAt: Date | null;
    createdAt: Date;
    questionCount: number;
    submissionCount: number;
  }[];
  totals: {
    enrolledUsers: number;
    assignments: number;
    questions: number;
    submissions: number;
  };
};

export async function getClassDetailData(
  classId: number,
): Promise<ClassDetailData | null> {
  const classItem = await prisma.class.findUnique({
    where: { id: classId },
    include: {
      teacher: {
        select: {
          id: true,
          displayName: true,
          email: true,
        },
      },
      enrollments: {
        orderBy: { student: { displayName: "asc" } },
        include: {
          student: {
            select: {
              id: true,
              displayName: true,
              email: true,
              role: true,
              accountStatus: true,
              yearGroup: true,
            },
          },
        },
      },
      homeworkAssignments: {
        orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          dueAt: true,
          createdAt: true,
          _count: {
            select: {
              questions: true,
              submissions: true,
            },
          },
        },
      },
    },
  });

  if (!classItem) {
    return null;
  }

  const enrolledStudentIds = classItem.enrollments.map((enrollment) => enrollment.studentId);
  const availableStudents = await prisma.user.findMany({
    where: {
      role: UserRole.STUDENT,
      accountStatus: AccountStatus.ACTIVE,
      id: { notIn: enrolledStudentIds.length > 0 ? enrolledStudentIds : [0] },
    },
    orderBy: [{ displayName: "asc" }, { email: "asc" }],
    select: {
      id: true,
      displayName: true,
      email: true,
      accountStatus: true,
      yearGroup: true,
    },
  });

  const assignments = classItem.homeworkAssignments.map((assignment) => ({
    id: assignment.id,
    title: assignment.title,
    description: assignment.description,
    status: assignment.status,
    dueAt: assignment.dueAt,
    createdAt: assignment.createdAt,
    questionCount: assignment._count.questions,
    submissionCount: assignment._count.submissions,
  }));

  return {
    id: classItem.id,
    name: classItem.name,
    subject: classItem.subject,
    description: classItem.description,
    teacher: classItem.teacher,
    enrolledUsers: classItem.enrollments.map((enrollment) => ({
      id: enrollment.student.id,
      displayName: enrollment.student.displayName,
      email: enrollment.student.email,
      role: enrollment.student.role,
      accountStatus: enrollment.student.accountStatus,
      yearGroup: enrollment.student.yearGroup,
      enrolledAt: enrollment.createdAt,
    })),
    availableStudents,
    assignments,
    totals: {
      enrolledUsers: classItem.enrollments.length,
      assignments: assignments.length,
      questions: assignments.reduce(
        (total, assignment) => total + assignment.questionCount,
        0,
      ),
      submissions: assignments.reduce(
        (total, assignment) => total + assignment.submissionCount,
        0,
      ),
    },
  };
}
