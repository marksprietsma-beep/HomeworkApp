import { PrismaClient } from '@prisma/client';
import { loadLocalEnvFile, requireDevOnlyCommand } from './dev-utils.mjs';

loadLocalEnvFile();
requireDevOnlyCommand();
const prisma = new PrismaClient();
try {
  const classes = await prisma.class.findMany({
    orderBy: [{ name: 'asc' }],
    include: { teacher: { select: { displayName: true, email: true } }, _count: { select: { enrollments: true, homeworkAssignments: true } } },
  });
  if (classes.length === 0) console.log('No classes found. Create a class or import students first.');
  else {
    console.log('Classes:');
    for (const item of classes) console.log(`- id=${item.id} | name="${item.name}" | subject="${item.subject}" | teacher="${item.teacher.displayName}" <${item.teacher.email}> | students=${item._count.enrollments} | assignments=${item._count.homeworkAssignments} | status=${item.status}`);
  }
} finally {
  await prisma.$disconnect();
}
