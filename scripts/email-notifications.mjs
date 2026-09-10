#!/usr/bin/env node
const command = process.argv[2];
if (!command || !["send-test", "process"].includes(command)) {
  console.error("Usage: npm run email:test -- recipient@example.org OR npm run email:process");
  process.exit(2);
}
process.env.NODE_ENV ||= "production";
const { PrismaClient } = await import("@prisma/client");
const nodemailer = (await import("nodemailer")).default;
const prisma = new PrismaClient();
function config() {
  const names = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "MAIL_FROM_ADDRESS"];
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length) throw new Error(`SMTP configuration incomplete. Missing: ${missing.join(", ")}.`);
  return { host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT), secure: process.env.SMTP_SECURE === "true", requireTLS: process.env.SMTP_REQUIRE_TLS !== "false", auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } };
}
function safe(error) { return (error instanceof Error ? error.message : "Unknown SMTP failure").replace(/(pass(word)?|token|secret|auth)\s*[=:]\s*\S+/gi, "$1=[redacted]").slice(0, 500); }
function html(text, link, label) { const escape = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;"); return `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f8fafc;color:#0f172a"><div style="max-width:640px;margin:24px auto;background:#fff;padding:32px;border-radius:16px"><strong style="color:#b45309">CLARION</strong><div style="line-height:1.6;white-space:pre-wrap;margin:24px 0">${escape(text)}</div><a href="${escape(link)}" style="background:#f59e0b;color:#0f172a;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:bold">${escape(label)}</a></div></body></html>`; }
try {
  const transport = nodemailer.createTransport(config());
  if (command === "send-test") {
    const to = process.argv[3];
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new Error("Supply one valid explicit test recipient.");
    await transport.sendMail({ from: { name: process.env.MAIL_FROM_NAME || "Harrow Haikou Clarion", address: process.env.MAIL_FROM_ADDRESS }, to, subject: "Clarion email configuration test", text: "Clarion SMTP submission succeeded. Automatic student notification settings were not changed." });
    console.log(`SMTP accepted the Clarion test message for ${to}.`);
  } else {
    if (process.env.EMAIL_NOTIFICATIONS_ENABLED !== "true") throw new Error("Automatic delivery is disabled. Set EMAIL_NOTIFICATIONS_ENABLED=true only after controlled rollout.");
    const jobs = await prisma.emailNotification.findMany({ where: { status: { in: ["PENDING", "FAILED"] }, attemptCount: { lt: 5 }, OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }] }, take: 50, orderBy: { createdAt: "asc" } });
    const settings = await prisma.emailNotificationSettings.findUnique({ where: { id: 1 } });
    let sent = 0, failed = 0;
    for (const job of jobs) {
      const data = job.templateData;
      const homework = job.type === "HOMEWORK_PUBLISHED";
      const defaults = homework ? ["New homework: {{assignmentTitle}}", "Hi {{studentName}},\n\nNew homework has been assigned to you in {{className}}.\n\n{{assignmentTitle}}\n{{dueDate}}\n\nOpen Clarion: {{clarionLink}}"] : ["Feedback ready: {{assignmentTitle}}", "Hi {{studentName}},\n\nYour teacher has released feedback for {{assignmentTitle}} in {{className}}.\n\nOpen Clarion: {{clarionLink}}"];
      const render = (template) => template.replace(/{{\s*([^{}]+?)\s*}}/g, (_, key) => data[key] ?? "").replace(/^\s*\n/gm, "\n").trim();
      try { const text = render(homework ? settings?.homeworkBodyTemplate || defaults[1] : settings?.feedbackBodyTemplate || defaults[1]); await transport.sendMail({ from: { name: process.env.MAIL_FROM_NAME || "Harrow Haikou Clarion", address: process.env.MAIL_FROM_ADDRESS }, to: job.recipientEmail, subject: render(homework ? settings?.homeworkSubjectTemplate || defaults[0] : settings?.feedbackSubjectTemplate || defaults[0]), text, html: html(text, data.clarionLink, homework ? "View Homework" : "View Feedback") }); await prisma.emailNotification.update({ where: { id: job.id }, data: { status: "SENT", attemptCount: { increment: 1 }, attemptedAt: new Date(), sentAt: new Date(), lastError: null, nextAttemptAt: null } }); sent++; }
      catch (error) { const attempts = job.attemptCount + 1; await prisma.emailNotification.update({ where: { id: job.id }, data: { status: "FAILED", attemptCount: attempts, attemptedAt: new Date(), lastError: safe(error), nextAttemptAt: attempts < 5 ? new Date(Date.now() + Math.min(60, 2 ** attempts) * 60000) : null } }); failed++; }
    }
    console.log(`Email outbox processed=${jobs.length} sent=${sent} failed=${failed}.`);
    if (failed) process.exitCode = 1;
  }
} catch (error) { console.error(safe(error)); process.exitCode = 1; } finally { await prisma.$disconnect(); }
