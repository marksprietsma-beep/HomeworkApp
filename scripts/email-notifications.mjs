#!/usr/bin/env node
import { PrismaClient } from "@prisma/client";
import { processEmailOutbox, sendTestEmail } from "../lib/email-outbox-runtime.mjs";
import core from "../lib/email-core.cjs";
const { sanitiseMailError } = core;

const command = process.argv[2];
if (!command || !["send-test", "process"].includes(command)) {
  console.error("Usage: npm run email:test -- recipient@example.org OR npm run email:process");
  process.exit(2);
}
const db = new PrismaClient();
try {
  if (command === "send-test") console.log(await sendTestEmail(process.argv[3]));
  else {
    const result = await processEmailOutbox({ db });
    console.log(result.message);
    if (result.failed) process.exitCode = 1;
  }
} catch (error) {
  console.error(sanitiseMailError(error));
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
