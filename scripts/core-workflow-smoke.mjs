import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
let prisma;

function formatCommand(command, args) {
  return [command, ...args].join(' ');
}

function resolveNpmCommand(args) {
  if (process.env.npm_execpath) {
    return {
      command: process.execPath,
      args: [process.env.npm_execpath, ...args],
      displayCommand: formatCommand('npm', args),
      shell: false,
    };
  }

  return { command: 'npm', args, displayCommand: formatCommand('npm', args), shell: process.platform === 'win32' };
}

function run(command, args, { displayCommand = formatCommand(command, args), shell = false } = {}) {
  console.log(`\n$ ${displayCommand}`);
  const result = spawnSync(command, args, { stdio: 'inherit', env: process.env, shell });
  if (result.status !== 0 || result.error) {
    const diagnostics = [
      `Command failed: ${displayCommand}`,
      `  command: ${command}`,
      `  args: ${JSON.stringify(args)}`,
      `  status: ${result.status}`,
      `  signal: ${result.signal}`,
      `  spawn error: ${result.error ? `${result.error.name}: ${result.error.message}` : 'none'}`,
    ];
    throw new Error(diagnostics.join('\n'));
  }
}

function runNpmScript(scriptName) {
  const { command, args, displayCommand, shell } = resolveNpmCommand(['run', scriptName]);
  run(command, args, { displayCommand, shell });
}

function requireFound(value, label) {
  if (!value) throw new Error(`Smoke check failed: missing ${label}`);
  return value;
}

function requireBuildArtifact(path) {
  if (!existsSync(path)) throw new Error(`Smoke check failed: missing build artifact ${path}`);
  console.log(`✓ compiled route artifact exists: ${path}`);
}

async function smokeDatabaseWorkflow() {
  const { PrismaClient } = await import('@prisma/client');
  prisma = new PrismaClient();
  console.log('\n$ database-backed core workflow smoke assertions');

  const [responseTextColumn] = await prisma.$queryRaw`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'FeedbackFollowUpAction'
      AND column_name = 'responseText'
  `;
  requireFound(responseTextColumn, 'FeedbackFollowUpAction.responseText migration column');

  const teacher = requireFound(
    await prisma.user.findUnique({ where: { email: 'teacher.dev@example.test' } }),
    'seeded teacher',
  );
  const student = requireFound(
    await prisma.user.findUnique({ where: { email: 'student.ada.dev@example.test' } }),
    'seeded Ada student',
  );
  const seededClass = requireFound(
    await prisma.class.findUnique({ where: { name: 'Development Maths Class' } }),
    'seeded class',
  );
  if (seededClass.teacherId !== teacher.id) throw new Error('Smoke check failed: seeded class is not owned by seeded teacher');

  const assignment = requireFound(
    await prisma.homeworkAssignment.findFirst({
      where: { classId: seededClass.id, title: 'Fractions practice' },
      include: {
        questions: { orderBy: { order: 'asc' } },
        submissions: { where: { studentId: student.id }, include: { answers: true } },
      },
    }),
    'seeded assignment',
  );
  if (assignment.questions.length < 2) throw new Error('Smoke check failed: seeded assignment should have at least two questions');
  const submission = requireFound(assignment.submissions[0], 'seeded submitted response');
  if (submission.answers.length < 2) throw new Error('Smoke check failed: seeded submission should have answers');

  await prisma.feedbackImport.deleteMany({
    where: { assignmentId: assignment.id, generatedBy: 'Core workflow smoke test' },
  });

  const feedbackImport = await prisma.feedbackImport.create({
    data: {
      assignmentId: assignment.id,
      feedbackFormat: 'homework-feedback',
      feedbackVersion: 1,
      sourceExportFormat: 'homework-assignment-responses-v2',
      sourceExportVersion: 2,
      generatedBy: 'Core workflow smoke test',
      participantFeedback: {
        create: {
          assignmentId: assignment.id,
          studentId: student.id,
          submissionId: submission.id,
          sourceParticipantId: student.id,
          sourceParticipantName: student.displayName,
          sourceParticipantEmail: student.email,
          sourceSubmissionId: submission.id,
          sourceSubmissionStatus: submission.status,
          overallFeedback: 'Smoke test feedback for the seeded workflow.',
          strengths: ['Seeded response can receive feedback.'],
          targets: ['Seeded participant can action feedback.'],
          followUpActions: {
            create: [
              {
                sourceActionId: 'smoke-acknowledge-feedback',
                type: 'ACKNOWLEDGEMENT',
                prompt: 'Acknowledge this smoke-test feedback.',
                required: true,
              },
              {
                sourceActionId: 'smoke-reflect-on-feedback',
                type: 'SHORT_REFLECTION',
                prompt: 'Write one sentence reflecting on this smoke-test feedback.',
                required: true,
              },
            ],
          },
          questionFeedback: {
            create: {
              questionId: assignment.questions[0].id,
              sourceQuestionId: assignment.questions[0].id,
              questionOrder: assignment.questions[0].order,
              feedback: 'Smoke test question feedback.',
              strengths: ['Question feedback is linked.'],
              targets: ['Question action is visible.'],
              followUpActions: {
                create: {
                  sourceActionId: 'smoke-answer-follow-up',
                  type: 'ANSWER_FOLLOW_UP_QUESTION',
                  prompt: 'Answer this smoke-test follow-up question.',
                  required: true,
                },
              },
            },
          },
        },
      },
    },
    include: { participantFeedback: { include: { followUpActions: true, questionFeedback: { include: { followUpActions: true } } } } },
  });

  const participantFeedback = requireFound(feedbackImport.participantFeedback[0], 'created smoke participant feedback');
  const reflectionAction = requireFound(
    participantFeedback.followUpActions.find((action) => action.sourceActionId === 'smoke-reflect-on-feedback'),
    'created smoke reflection action',
  );
  await prisma.feedbackFollowUpAction.update({
    where: { id: reflectionAction.id },
    data: { status: 'COMPLETED', responseText: 'I will show my working next time.', completedAt: new Date('2026-06-22T00:00:00.000Z') },
  });

  const participantView = requireFound(
    await prisma.homeworkAssignment.findFirst({
      where: { id: assignment.id, class: { enrollments: { some: { studentId: student.id } } } },
      include: {
        participantFeedback: {
          where: { studentId: student.id, feedbackImport: { generatedBy: 'Core workflow smoke test' } },
          include: { followUpActions: true, questionFeedback: { include: { followUpActions: true } } },
        },
      },
    }),
    'participant assigned work view query',
  );
  const visibleFeedback = requireFound(participantView.participantFeedback[0], 'participant feedback visibility');
  const allActions = visibleFeedback.followUpActions.concat(visibleFeedback.questionFeedback.flatMap((question) => question.followUpActions));
  if (allActions.length !== 3) throw new Error(`Smoke check failed: expected 3 follow-up actions, found ${allActions.length}`);
  if (!allActions.some((action) => action.status === 'COMPLETED' && action.responseText)) {
    throw new Error('Smoke check failed: completed feedback action response text was not saved');
  }

  const teacherOverview = await prisma.submission.count({ where: { assignmentId: assignment.id, status: 'SUBMITTED' } });
  if (teacherOverview < 1) throw new Error('Smoke check failed: teacher response overview has no submitted responses');

  console.log('✓ seeded teacher dashboard data exists');
  console.log('✓ seeded participant assigned-work/work data exists');
  console.log('✓ response overview/detail/export data exists');
  console.log('✓ feedback import data can be saved');
  console.log('✓ participant feedback/action data can be read and actioned');
}

async function main() {
  runNpmScript('prisma:generate');
  runNpmScript('prisma:deploy');
  runNpmScript('db:seed');
  runNpmScript('db:check');
  runNpmScript('check:assignment-json-fixtures');
  runNpmScript('check:feedback-json-fixtures');
  await smokeDatabaseWorkflow();
  runNpmScript('lint');
  runNpmScript('build');

  requireBuildArtifact('.next/server/app/page.js');
  requireBuildArtifact('.next/server/app/assignments/[assignmentId]/work/page.js');
  requireBuildArtifact('.next/server/app/classes/[classId]/assignments/[assignmentId]/responses/page.js');
  requireBuildArtifact('.next/server/app/classes/[classId]/assignments/[assignmentId]/responses/[submissionId]/page.js');
  requireBuildArtifact('.next/server/app/classes/[classId]/assignments/[assignmentId]/responses/export/page.js');
  requireBuildArtifact('.next/server/app/classes/[classId]/assignments/[assignmentId]/feedback/import/page.js');

  console.log('\nCore workflow smoke checks passed.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma?.$disconnect();
  });
