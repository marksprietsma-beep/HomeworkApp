import { HomeworkAssignmentStatus, HomeworkQuestionType, PrismaClient, SubmissionStatus, UserRole, AccountStatus } from '@prisma/client';

const prisma = new PrismaClient();

const localDevelopmentPasswordHash = 'dev-only-placeholder-password-hash-not-for-production';

const admin = {
  email: 'admin.dev@example.test',
  displayName: 'Dev Admin',
  role: UserRole.ADMIN,
  passwordHash: localDevelopmentPasswordHash,
  accountStatus: AccountStatus.ACTIVE,
  isDevelopmentUser: true,
};

const teacher = {
  email: 'teacher.dev@example.test',
  displayName: 'Dev Teacher',
  role: UserRole.TEACHER,
  passwordHash: localDevelopmentPasswordHash,
  accountStatus: AccountStatus.ACTIVE,
  isDevelopmentUser: true,
};

const students = [
  {
    email: 'student.ada.dev@example.test',
    displayName: 'Ada Student',
    role: UserRole.STUDENT,
    passwordHash: localDevelopmentPasswordHash,
    accountStatus: AccountStatus.ACTIVE,
    isDevelopmentUser: true,
  },
  {
    email: 'student.ben.dev@example.test',
    displayName: 'Ben Student',
    role: UserRole.STUDENT,
    passwordHash: localDevelopmentPasswordHash,
    accountStatus: AccountStatus.ACTIVE,
    isDevelopmentUser: true,
  },
  {
    email: 'student.cleo.dev@example.test',
    displayName: 'Cleo Student',
    role: UserRole.STUDENT,
    passwordHash: localDevelopmentPasswordHash,
    accountStatus: AccountStatus.ACTIVE,
    isDevelopmentUser: true,
  },
];

const classSeed = {
  name: 'Development Maths Class',
  subject: 'Maths',
  description: 'Fake local class for testing teacher and student workflows.',
};

const homeworkSeed = {
  title: 'Fractions practice',
  description: 'Short fake homework assignment for checking the local data model.',
  status: HomeworkAssignmentStatus.PUBLISHED,
  questions: [
    {
      order: 1,
      prompt: 'What is 1/2 + 1/4?',
      questionType: HomeworkQuestionType.OPEN_TEXT,
      points: 1,
    },
    {
      order: 2,
      prompt: 'Explain how you found your answer.',
      questionType: HomeworkQuestionType.OPEN_TEXT,
      points: 2,
    },
  ],
};

async function main() {
  const seededAdmin = await prisma.user.upsert({
    where: { email: admin.email },
    update: admin,
    create: admin,
  });

  const seededTeacher = await prisma.user.upsert({
    where: { email: teacher.email },
    update: teacher,
    create: teacher,
  });

  const seededStudents = [];

  for (const student of students) {
    const seededStudent = await prisma.user.upsert({
      where: { email: student.email },
      update: student,
      create: student,
    });

    seededStudents.push(seededStudent);
  }

  const seededClass = await prisma.class.upsert({
    where: { name: classSeed.name },
    update: {
      description: classSeed.description,
      teacherId: seededTeacher.id,
    },
    create: {
      ...classSeed,
      teacherId: seededTeacher.id,
    },
  });

  for (const student of seededStudents) {
    await prisma.classEnrollment.upsert({
      where: {
        classId_studentId: {
          classId: seededClass.id,
          studentId: student.id,
        },
      },
      update: {},
      create: {
        classId: seededClass.id,
        studentId: student.id,
      },
    });
  }

  let seededAssignment = await prisma.homeworkAssignment.findFirst({
    where: {
      classId: seededClass.id,
      title: homeworkSeed.title,
    },
  });

  if (seededAssignment) {
    seededAssignment = await prisma.homeworkAssignment.update({
      where: { id: seededAssignment.id },
      data: {
        description: homeworkSeed.description,
        status: homeworkSeed.status,
        createdById: seededTeacher.id,
      },
    });
  } else {
    seededAssignment = await prisma.homeworkAssignment.create({
      data: {
        title: homeworkSeed.title,
        description: homeworkSeed.description,
        status: homeworkSeed.status,
        classId: seededClass.id,
        createdById: seededTeacher.id,
      },
    });
  }

  const seededQuestions = [];

  for (const question of homeworkSeed.questions) {
    const seededQuestion = await prisma.homeworkQuestion.upsert({
      where: {
        assignmentId_order: {
          assignmentId: seededAssignment.id,
          order: question.order,
        },
      },
      update: question,
      create: {
        ...question,
        assignmentId: seededAssignment.id,
      },
    });

    seededQuestions.push(seededQuestion);
  }

  const sampleStudent = seededStudents[0];
  const seededSubmission = await prisma.submission.upsert({
    where: {
      assignmentId_studentId: {
        assignmentId: seededAssignment.id,
        studentId: sampleStudent.id,
      },
    },
    update: {
      status: SubmissionStatus.SUBMITTED,
      submittedAt: new Date('2026-01-15T10:00:00.000Z'),
    },
    create: {
      assignmentId: seededAssignment.id,
      studentId: sampleStudent.id,
      status: SubmissionStatus.SUBMITTED,
      submittedAt: new Date('2026-01-15T10:00:00.000Z'),
    },
  });

  for (const question of seededQuestions) {
    await prisma.submissionAnswer.upsert({
      where: {
        submissionId_questionId: {
          submissionId: seededSubmission.id,
          questionId: question.id,
        },
      },
      update: {
        answerText: question.order === 1 ? '3/4' : 'I made the denominators the same, then added the quarters.',
      },
      create: {
        submissionId: seededSubmission.id,
        questionId: question.id,
        answerText: question.order === 1 ? '3/4' : 'I made the denominators the same, then added the quarters.',
      },
    });
  }

  console.log('Seeded local development data:');
  console.log(`- Admin: ${seededAdmin.displayName} <${seededAdmin.email}> (development only)`);
  console.log(`- Teacher: ${seededTeacher.displayName} <${seededTeacher.email}>`);
  console.log(`- Students: ${seededStudents.map((student) => student.displayName).join(', ')}`);
  console.log(`- Class: ${seededClass.name} with ${seededStudents.length} students`);
  console.log(`- Homework: ${seededAssignment.title} with ${seededQuestions.length} questions`);
  console.log(`- Sample submission: ${sampleStudent.displayName} submitted ${seededQuestions.length} answers`);
}

await main().finally(async () => {
  await prisma.$disconnect();
});
