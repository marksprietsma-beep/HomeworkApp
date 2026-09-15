export function consolidateOutstandingAssignments(assignments) {
  const students = new Map();
  for (const assignment of assignments) {
    const complete = new Set(assignment.submissions.filter((item) => item.status === "SUBMITTED").map((item) => item.studentId));
    for (const { student } of assignment.class.enrollments) {
      if (student.role !== "STUDENT" || student.accountStatus !== "ACTIVE" || complete.has(student.id)) continue;
      const candidate = students.get(student.id) ?? { student, tasks: [] };
      candidate.tasks.push({ id: assignment.id, title: assignment.title, className: assignment.class.name, dueAt: assignment.dueAt });
      students.set(student.id, candidate);
    }
  }
  return [...students.values()];
}

export function reminderIdempotencyKey(runKey, studentId) {
  return `homework-reminder:${runKey}:${studentId}`;
}
