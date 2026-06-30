import { HomeworkQuestionResponseMode, HomeworkQuestionType, PrismaClient, SubmissionStatus, UserRole } from '@prisma/client';
import { loadLocalEnvFile, parseArgs, parseInteger, requireDevOnlyCommand } from './dev-utils.mjs';

loadLocalEnvFile();
requireDevOnlyCommand();

const args = parseArgs(process.argv.slice(2));
const prisma = new PrismaClient();

function usageAndExit(message) {
  if (message) console.error(`\n${message}`);
  console.error(`\nUsage:\n  npm run seed:submissions -- --className "Y10 Test Class" --assignmentTitle "14.2 Packet Switching and Circuit Switching"\n  npm run seed:submissions -- --classId 1 --assignmentId 2\n\nOptional lookup helpers:\n  npm run list:classes\n  npm run list:assignments -- --className "Y10 Test Class"`);
  process.exit(1);
}

function printClassOptions(matches) {
  console.error('Matching classes:');
  for (const item of matches) console.error(`- id=${item.id} | name="${item.name}" | subject="${item.subject}" | students=${item._count.enrollments}`);
}

function printAssignmentOptions(matches) {
  console.error('Matching assignments:');
  for (const item of matches) console.error(`- id=${item.id} | title="${item.title}" | class="${item.class.name}" (id=${item.class.id}) | questions=${item._count.questions}`);
}

async function resolveSingleClass() {
  if (args.classSlug) usageAndExit('Class slugs are not present in this schema yet. Use --className or --classId.');
  if (args.classId) {
    const id = parseInteger(args.classId, '--classId');
    const found = await prisma.class.findUnique({ where: { id }, include: { _count: { select: { enrollments: true } } } });
    if (!found) usageAndExit(`No class found with id=${id}.`);
    return found;
  }
  if (!args.className) usageAndExit('Provide --className or --classId.');
  const matches = await prisma.class.findMany({ where: { name: { contains: String(args.className), mode: 'insensitive' } }, include: { _count: { select: { enrollments: true } } }, orderBy: { name: 'asc' } });
  if (matches.length === 0) usageAndExit(`No class found matching name "${args.className}". Run npm run list:classes to see available classes.`);
  const exact = matches.filter((item) => item.name.toLowerCase() === String(args.className).toLowerCase());
  const candidates = exact.length > 0 ? exact : matches;
  if (candidates.length > 1) {
    console.error(`Class name "${args.className}" is ambiguous. Use --classId with one of these options:`);
    printClassOptions(candidates);
    process.exit(1);
  }
  return candidates[0];
}

async function resolveSingleAssignment(classId) {
  if (args.assignmentId) {
    const id = parseInteger(args.assignmentId, '--assignmentId');
    const found = await prisma.homeworkAssignment.findFirst({ where: { id, classId }, include: { class: true, questions: { orderBy: { order: 'asc' } }, _count: { select: { questions: true } } } });
    if (!found) usageAndExit(`No assignment found with id=${id} in class id=${classId}.`);
    return found;
  }
  if (!args.assignmentTitle) usageAndExit('Provide --assignmentTitle or --assignmentId.');
  const matches = await prisma.homeworkAssignment.findMany({
    where: { classId, title: { contains: String(args.assignmentTitle), mode: 'insensitive' } },
    include: { class: true, questions: { orderBy: { order: 'asc' } }, _count: { select: { questions: true } } },
    orderBy: [{ title: 'asc' }, { id: 'asc' }],
  });
  if (matches.length === 0) usageAndExit(`No assignment found in class id=${classId} matching title "${args.assignmentTitle}". Run npm run list:assignments -- --classId ${classId}.`);
  const exact = matches.filter((item) => item.title.toLowerCase() === String(args.assignmentTitle).toLowerCase());
  const candidates = exact.length > 0 ? exact : matches;
  if (candidates.length > 1) {
    console.error(`Assignment title "${args.assignmentTitle}" is ambiguous. Use --assignmentId with one of these options:`);
    printAssignmentOptions(candidates);
    process.exit(1);
  }
  return candidates[0];
}

function optionText(question, band) {
  const options = Array.isArray(question.options) ? question.options : [];
  if (options.length === 0) return null;
  const option = band === 'strong' ? options[0] : band === 'partial' ? options[Math.min(1, options.length - 1)] : options[options.length - 1];
  if (typeof option === 'string') return option;
  if (option && typeof option === 'object') return String(option.label ?? option.text ?? option.value ?? JSON.stringify(option));
  return String(option);
}

function fakeAnswer(question, band, studentName) {
  const stem = `DEV TEST (${band}) for ${studentName}:`;
  if (question.questionType === HomeworkQuestionType.MULTIPLE_CHOICE) return optionText(question, band) ?? `${stem} selected a safe generic option.`;
  if (question.responseMode === HomeworkQuestionResponseMode.PSEUDOCODE) {
    if (band === 'strong') return `${stem}\nINPUT value\nIF value > 0 THEN\n  OUTPUT "positive"\nELSE\n  OUTPUT "not positive"\nENDIF`;
    if (band === 'partial') return `${stem}\nIF value > 0 THEN\nOUTPUT positive\nELSE\nOUTPUT other`;
    return `${stem}\nI would use an if statement but I am not sure how to write it.`;
  }
  const lowerPrompt = question.prompt.toLowerCase();
  if (lowerPrompt.includes('calculate') || lowerPrompt.includes('numeric') || lowerPrompt.includes('number') || lowerPrompt.includes('work out')) {
    if (band === 'strong') return `${stem} 42, with working shown clearly and units checked.`;
    if (band === 'partial') return `${stem} I think it is about 40 because I used part of the method.`;
    return `${stem} not sure, maybe 4.`;
  }
  if (question.questionType === HomeworkQuestionType.LONG_TEXT) {
    if (band === 'strong') return `${stem} This is a clearly fake but mostly correct extended response. It explains the key idea, uses relevant vocabulary from the question, and gives a concrete example so JSON feedback has enough detail to assess.`;
    if (band === 'partial') return `${stem} This answer has the main idea but misses some detail and does not fully explain the example.`;
    return `${stem} I do not really know. It is something to do with the topic.`;
  }
  if (band === 'strong') return `${stem} A mostly correct concise answer using the key term and a relevant example.`;
  if (band === 'partial') return `${stem} A partly correct answer with one useful idea but missing detail.`;
  return `${stem} vague answer.`;
}

function qualityBand(index, total) {
  if (index < Math.ceil(total / 3)) return 'strong';
  if (index < Math.ceil((total * 2) / 3)) return 'partial';
  return 'weak';
}

try {
  const classItem = await resolveSingleClass();
  const assignment = await resolveSingleAssignment(classItem.id);
  if (assignment.questions.length === 0) usageAndExit(`Assignment id=${assignment.id} has no questions, so there is nothing to seed.`);
  const enrollments = await prisma.classEnrollment.findMany({
    where: { classId: classItem.id, student: { role: UserRole.STUDENT } },
    include: { student: { select: { id: true, displayName: true, email: true } } },
    orderBy: [{ student: { displayName: 'asc' } }, { studentId: 'asc' }],
  });
  if (enrollments.length === 0) usageAndExit(`Class "${classItem.name}" has no enrolled students.`);

  let createdSubmissions = 0;
  let updatedSubmissions = 0;
  let createdAnswers = 0;
  let updatedAnswers = 0;
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    for (let index = 0; index < enrollments.length; index += 1) {
      const { student } = enrollments[index];
      const existing = await tx.submission.findUnique({ where: { assignmentId_studentId: { assignmentId: assignment.id, studentId: student.id } }, select: { id: true } });
      const submission = await tx.submission.upsert({
        where: { assignmentId_studentId: { assignmentId: assignment.id, studentId: student.id } },
        update: { status: SubmissionStatus.SUBMITTED, submittedAt: now },
        create: { assignmentId: assignment.id, studentId: student.id, status: SubmissionStatus.SUBMITTED, submittedAt: now },
        select: { id: true },
      });
      if (existing) updatedSubmissions += 1;
      else createdSubmissions += 1;
      const band = qualityBand(index, enrollments.length);
      for (const question of assignment.questions) {
        const answerText = fakeAnswer(question, band, student.displayName);
        const existingAnswer = await tx.submissionAnswer.findUnique({ where: { submissionId_questionId: { submissionId: submission.id, questionId: question.id } }, select: { id: true } });
        await tx.submissionAnswer.upsert({
          where: { submissionId_questionId: { submissionId: submission.id, questionId: question.id } },
          update: { answerText },
          create: { submissionId: submission.id, questionId: question.id, answerText },
        });
        if (existingAnswer) updatedAnswers += 1;
        else createdAnswers += 1;
      }
    }
  });

  console.log('Dev submission seeding complete.');
  console.log(`Class: "${classItem.name}" (id=${classItem.id})`);
  console.log(`Assignment: "${assignment.title}" (id=${assignment.id})`);
  console.log(`Students processed: ${enrollments.length}`);
  console.log(`Questions answered per student: ${assignment.questions.length}`);
  console.log(`Submissions: ${createdSubmissions} created, ${updatedSubmissions} updated/reused`);
  console.log(`Answers: ${createdAnswers} created, ${updatedAnswers} updated/reused`);
  console.log('Quality bands: first third strong, second third partial, final third weak.');
} finally {
  await prisma.$disconnect();
}
