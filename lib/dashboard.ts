import {
  AccountStatus,
  ClassStatus,
  FeedbackFollowUpActionStatus,
  HomeworkAssignmentStatus,
  SubmissionStatus,
  type UserRole,
} from "@prisma/client";
import { isAdmin, isStudent, isTeacher } from "./permissions";
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

type AssignedWorkStudentStatus =
  | "not-started"
  | "submitted"
  | "feedback-available"
  | "feedback-actions-pending"
  | "completed";

export type AssignedWorkItem = {
  id: number;
  title: string;
  classId: number;
  className: string;
  subject: string;
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
  feedback: {
    id: number;
    importedAt: Date;
    totalActions: number;
    pendingActions: number;
    completedActions: number;
  } | null;
  studentStatus: AssignedWorkStudentStatus;
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
    where: isAdmin(user)
      ? undefined
      : isTeacher(user)
        ? { teacherId: user.id }
        : {
            status: ClassStatus.ACTIVE,
            enrollments: {
              some: {
                studentId: user.id,
                student: { accountStatus: AccountStatus.ACTIVE },
              },
            },
          },
    orderBy: { name: "asc" },
    include: {
      teacher: {
        select: {
          displayName: true,
        },
      },
      homeworkAssignments: {
        where: isStudent(user)
          ? { status: HomeworkAssignmentStatus.PUBLISHED }
          : undefined,
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
          participantFeedback: {
            where: { studentId: user.id },
            orderBy: [
              { feedbackImport: { importedAt: "desc" } },
              { updatedAt: "desc" },
            ],
            take: 1,
            select: {
              id: true,
              feedbackImport: { select: { importedAt: true } },
              followUpActions: { select: { status: true } },
              questionFeedback: {
                select: {
                  followUpActions: { select: { status: true } },
                },
              },
            },
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

  const assignedWork = isStudent(user)
    ? classes.flatMap((classItem) =>
        classItem.homeworkAssignments.map((assignment) => {
          const totalPoints = assignment.questions.reduce<number | null>(
            (total, question) =>
              question.points === null ? total : (total ?? 0) + question.points,
            null,
          );
          const submission = assignment.submissions[0] ?? null;

          const feedbackEntry = assignment.participantFeedback[0] ?? null;
          const feedbackActions = feedbackEntry
            ? [
                ...feedbackEntry.followUpActions,
                ...feedbackEntry.questionFeedback.flatMap(
                  (question) => question.followUpActions,
                ),
              ]
            : [];
          const pendingActions = feedbackActions.filter(
            (action) => action.status === FeedbackFollowUpActionStatus.PENDING,
          ).length;
          const completedActions = feedbackActions.filter(
            (action) =>
              action.status === FeedbackFollowUpActionStatus.COMPLETED,
          ).length;
          const studentStatus: AssignedWorkStudentStatus = feedbackEntry
            ? pendingActions > 0
              ? "feedback-actions-pending"
              : feedbackActions.length > 0
                ? "completed"
                : "feedback-available"
            : submission?.status === SubmissionStatus.SUBMITTED
              ? "submitted"
              : "not-started";

          return {
            id: assignment.id,
            title: assignment.title,
            classId: classItem.id,
            className: classItem.name,
            subject: classItem.subject,
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
            feedback: feedbackEntry
              ? {
                  id: feedbackEntry.id,
                  importedAt: feedbackEntry.feedbackImport.importedAt,
                  totalActions: feedbackActions.length,
                  pendingActions,
                  completedActions,
                }
              : null,
            studentStatus,
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
