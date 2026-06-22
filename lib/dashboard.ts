import { HomeworkAssignmentStatus, type UserRole } from "@prisma/client";
import { prisma } from "./prisma";

export type DashboardClass = {
  id: number;
  name: string;
  subject: string;
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
    classId: number;
    questionCount: number;
    submissionCount: number;
    dueAt: Date | null;
    createdAt: Date;
  }[];
};

export type AssignedWorkItem = {
  id: number;
  title: string;
  classId: number;
  className: string;
  status: string;
  dueAt: Date | null;
  createdAt: Date;
  questionCount: number;
  totalPoints: number | null;
  submission: {
    id: number;
    status: string;
    submittedAt: Date | null;
  } | null;
};

export type LocalDashboardData = {
  classes: DashboardClass[];
  assignedWork: AssignedWorkItem[];
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
        where: user.role === "STUDENT" ? { status: HomeworkAssignmentStatus.PUBLISHED } : undefined,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          status: true,
          dueAt: true,
          createdAt: true,
          questions: {
            select: {
              points: true,
            },
          },
          submissions: {
            where: { studentId: user.id },
            select: {
              id: true,
              status: true,
              submittedAt: true,
            },
            take: 1,
          },
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

  const assignedWork =
    user.role === "STUDENT"
      ? classes.flatMap((classItem) =>
          classItem.homeworkAssignments.map((assignment) => {
            const totalPoints = assignment.questions.reduce<number | null>(
              (total, question) =>
                question.points === null
                  ? total
                  : (total ?? 0) + question.points,
              null,
            );
            const submission = assignment.submissions[0] ?? null;

            return {
              id: assignment.id,
              title: assignment.title,
              classId: classItem.id,
              className: classItem.name,
              status: assignment.status,
              dueAt: assignment.dueAt,
              createdAt: assignment.createdAt,
              questionCount: assignment._count.questions,
              totalPoints,
              submission: submission
                ? {
                    id: submission.id,
                    status: submission.status,
                    submittedAt: submission.submittedAt,
                  }
                : null,
            };
          }),
        )
      : [];

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
      subject: classItem.subject,
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
        classId: classItem.id,
        dueAt: assignment.dueAt,
        createdAt: assignment.createdAt,
        questionCount: assignment._count.questions,
        submissionCount: assignment._count.submissions,
      })),
    };
  });

  return {
    classes: dashboardClasses,
    assignedWork,
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
