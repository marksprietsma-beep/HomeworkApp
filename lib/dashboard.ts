import type { UserRole } from "@prisma/client";
import { prisma } from "./prisma";

export type DashboardClass = {
  id: number;
  name: string;
  description: string;
  teacherName: string;
  assignmentCount: number;
  enrolledUserCount: number;
  questionCount: number;
  submissionCount: number;
  assignments: {
    id: number;
    title: string;
    status: string;
    questionCount: number;
    submissionCount: number;
  }[];
};

export type LocalDashboardData = {
  classes: DashboardClass[];
  totals: {
    classes: number;
    enrolledUsers: number;
    assignments: number;
    questions: number;
    submissions: number;
  };
};

export async function getLocalDashboardData(user: {
  id: number;
  role: UserRole;
}): Promise<LocalDashboardData> {
  const classes = await prisma.class.findMany({
    where:
      user.role === "TEACHER"
        ? { teacherId: user.id }
        : { enrollments: { some: { studentId: user.id } } },
    orderBy: { name: "asc" },
    include: {
      teacher: {
        select: {
          displayName: true,
        },
      },
      homeworkAssignments: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          status: true,
          _count: {
            select: {
              questions: true,
              submissions: true,
            },
          },
        },
      },
      _count: {
        select: {
          enrollments: true,
          homeworkAssignments: true,
        },
      },
    },
  });

  const dashboardClasses = classes.map((classItem) => {
    const questionCount = classItem.homeworkAssignments.reduce(
      (total, assignment) => total + assignment._count.questions,
      0,
    );
    const submissionCount = classItem.homeworkAssignments.reduce(
      (total, assignment) => total + assignment._count.submissions,
      0,
    );

    return {
      id: classItem.id,
      name: classItem.name,
      description: classItem.description,
      teacherName: classItem.teacher.displayName,
      assignmentCount: classItem._count.homeworkAssignments,
      enrolledUserCount: classItem._count.enrollments,
      questionCount,
      submissionCount,
      assignments: classItem.homeworkAssignments.map((assignment) => ({
        id: assignment.id,
        title: assignment.title,
        status: assignment.status,
        questionCount: assignment._count.questions,
        submissionCount: assignment._count.submissions,
      })),
    };
  });

  return {
    classes: dashboardClasses,
    totals: {
      classes: dashboardClasses.length,
      enrolledUsers: dashboardClasses.reduce(
        (total, classItem) => total + classItem.enrolledUserCount,
        0,
      ),
      assignments: dashboardClasses.reduce(
        (total, classItem) => total + classItem.assignmentCount,
        0,
      ),
      questions: dashboardClasses.reduce(
        (total, classItem) => total + classItem.questionCount,
        0,
      ),
      submissions: dashboardClasses.reduce(
        (total, classItem) => total + classItem.submissionCount,
        0,
      ),
    },
  };
}
