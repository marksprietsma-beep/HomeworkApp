import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

const teacher = {
  email: 'teacher.dev@example.test',
  displayName: 'Dev Teacher',
  role: UserRole.TEACHER,
  isDevelopmentUser: true,
};

const students = [
  {
    email: 'student.ada.dev@example.test',
    displayName: 'Ada Student',
    role: UserRole.STUDENT,
    isDevelopmentUser: true,
  },
  {
    email: 'student.ben.dev@example.test',
    displayName: 'Ben Student',
    role: UserRole.STUDENT,
    isDevelopmentUser: true,
  },
  {
    email: 'student.cleo.dev@example.test',
    displayName: 'Cleo Student',
    role: UserRole.STUDENT,
    isDevelopmentUser: true,
  },
];

const classSeed = {
  name: 'Development Maths Class',
  description: 'Fake local class for testing teacher and student workflows.',
};

async function main() {
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

  console.log('Seeded local development data:');
  console.log(`- Teacher: ${seededTeacher.displayName} <${seededTeacher.email}>`);
  console.log(`- Students: ${seededStudents.map((student) => student.displayName).join(', ')}`);
  console.log(`- Class: ${seededClass.name} with ${seededStudents.length} students`);
}

await main().finally(async () => {
  await prisma.$disconnect();
});
