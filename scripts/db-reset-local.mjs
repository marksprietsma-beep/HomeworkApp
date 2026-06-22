import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const CONFIRMATION_VARIABLE = 'CONFIRM_LOCAL_RESET';
const CONFIRMATION_VALUE = '1';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'postgres', 'host.docker.internal']);
const LOCAL_DATABASE_NAMES = new Set(['homework_app']);


function loadLocalEnvFile() {
  if (!existsSync('.env')) return;

  const envFile = readFileSync('.env', 'utf8');
  for (const line of envFile.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (!key || process.env[key] !== undefined) continue;

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function fail(message) {
  console.error(`\nRefusing to reset local data: ${message}`);
  process.exit(1);
}

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

function runNpmScript(scriptName) {
  const { command, args, displayCommand, shell } = resolveNpmCommand(['run', scriptName]);
  console.log(`\n$ ${displayCommand}`);
  const result = spawnSync(command, args, { stdio: 'inherit', env: process.env, shell });

  if (result.status !== 0 || result.error) {
    const details = result.error ? ` (${result.error.name}: ${result.error.message})` : '';
    throw new Error(`Command failed: ${displayCommand}${details}`);
  }
}

function requireSafeEnvironment() {
  if (process.env.NODE_ENV === 'production') {
    fail('NODE_ENV is production. This command is local-development only.');
  }

  if (process.env[CONFIRMATION_VARIABLE] !== CONFIRMATION_VALUE) {
    fail(`set ${CONFIRMATION_VARIABLE}=${CONFIRMATION_VALUE} to confirm this destructive local reset.`);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    fail('DATABASE_URL is not set.');
  }

  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch (error) {
    fail(`DATABASE_URL is not a valid URL: ${error.message}`);
  }

  if (!['postgresql:', 'postgres:'].includes(parsed.protocol)) {
    fail(`DATABASE_URL protocol must be postgresql or postgres, got ${parsed.protocol}.`);
  }

  if (!LOCAL_HOSTS.has(parsed.hostname)) {
    fail(`DATABASE_URL host must clearly be local (${[...LOCAL_HOSTS].join(', ')}), got ${parsed.hostname}.`);
  }

  const databaseName = parsed.pathname.replace(/^\//, '');
  if (!LOCAL_DATABASE_NAMES.has(databaseName)) {
    fail(`DATABASE_URL database must be the local development database (${[...LOCAL_DATABASE_NAMES].join(', ')}), got ${databaseName || '(empty)'}.`);
  }
}

async function resetLocalData() {
  const prisma = new PrismaClient();

  try {
    console.log('\nDeleting local development data from application tables:');
    console.log('- FeedbackFollowUpAction, QuestionFeedback, ParticipantFeedback, FeedbackImport');
    console.log('- SubmissionAnswer, Submission');
    console.log('- HomeworkQuestion, HomeworkAssignment');
    console.log('- ClassEnrollment, Class');
    console.log('- User');
    console.log('- LocalDatabaseCheck');
    console.log('Preserving Prisma migrations and database schema.');

    await prisma.$transaction([
      prisma.feedbackFollowUpAction.deleteMany(),
      prisma.questionFeedback.deleteMany(),
      prisma.participantFeedback.deleteMany(),
      prisma.feedbackImport.deleteMany(),
      prisma.submissionAnswer.deleteMany(),
      prisma.submission.deleteMany(),
      prisma.homeworkQuestion.deleteMany(),
      prisma.homeworkAssignment.deleteMany(),
      prisma.classEnrollment.deleteMany(),
      prisma.class.deleteMany(),
      prisma.user.deleteMany(),
      prisma.localDatabaseCheck.deleteMany(),
    ]);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  loadLocalEnvFile();
  requireSafeEnvironment();
  await resetLocalData();
  runNpmScript('db:seed');
  console.log('\nLocal development data reset and reseeded successfully.');
}

await main();
