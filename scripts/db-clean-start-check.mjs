import { existsSync, readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[key] = value;
  }
}

loadLocalEnvFile();

if (!process.env.DATABASE_URL) {
  console.error('Clean-start check cannot run: DATABASE_URL is not set.');
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  const [users, classes, assignments, submissions, feedbackImports] = await Promise.all([
    prisma.user.count(),
    prisma.class.count(),
    prisma.homeworkAssignment.count(),
    prisma.submission.count(),
    prisma.feedbackImport.count(),
  ]);
  console.log(`Clean-start counts: users=${users}, classes=${classes}, assignments=${assignments}, submissions=${submissions}, feedbackImports=${feedbackImports}`);
  if (classes || assignments || submissions || feedbackImports) {
    throw new Error('Clean-start check failed: demo workflow data exists. Start from migrated schema without running npm run db:seed.');
  }
  console.log('Clean-start check passed. Open the app and complete /setup if no ADMIN exists.');
} finally {
  await prisma.$disconnect();
}
