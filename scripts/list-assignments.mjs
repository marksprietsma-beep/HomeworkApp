import { PrismaClient } from '@prisma/client';
import { loadLocalEnvFile, parseArgs, parseInteger, requireDevOnlyCommand } from './dev-utils.mjs';

loadLocalEnvFile();
requireDevOnlyCommand();
const args = parseArgs(process.argv.slice(2));
const where = {};
if (args.classId) where.classId = parseInteger(args.classId, '--classId');
if (args.className) where.class = { name: String(args.className) };
const prisma = new PrismaClient();
try {
  const assignments = await prisma.homeworkAssignment.findMany({
    where,
    orderBy: [{ class: { name: 'asc' } }, { title: 'asc' }, { id: 'asc' }],
    include: { class: { select: { id: true, name: true } }, _count: { select: { questions: true, submissions: true } } },
  });
  if (assignments.length === 0) console.log('No assignments found for that filter. Try npm run list:classes first.');
  else {
    console.log('Assignments:');
    for (const item of assignments) console.log(`- id=${item.id} | title="${item.title}" | class="${item.class.name}" (id=${item.class.id}) | questions=${item._count.questions} | submissions=${item._count.submissions} | status=${item.status}`);
  }
} finally {
  await prisma.$disconnect();
}
