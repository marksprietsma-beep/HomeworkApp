export const REQUIRED_STUDENT_CSV_HEADERS = ["First Name", "Last Name", "Email Address"] as const;

export type ParsedStudentCsvRow = {
  rowNumber: number;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  messages: string[];
};

function parseCsvRecords(text: string) {
  const records: string[][] = [];
  let record: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"' && quoted && text[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      record.push(cell.trim());
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      record.push(cell.trim());
      if (record.some(Boolean)) records.push(record);
      record = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  if (quoted) throw new Error("CSV contains an unclosed quoted value.");
  record.push(cell.trim());
  if (record.some(Boolean)) records.push(record);
  return records;
}

function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function parseStudentCsv(csvText: string): ParsedStudentCsvRow[] {
  const records = parseCsvRecords(csvText.replace(/^\uFEFF/, ""));
  if (records.length < 2) throw new Error("Provide a CSV header row and at least one student row.");

  const headers = records[0].map((header) => header.trim().toLowerCase());
  const required = REQUIRED_STUDENT_CSV_HEADERS.map((header) => header.toLowerCase());
  const missing = required.filter((header) => !headers.includes(header));
  if (missing.length) {
    throw new Error(`CSV is missing required header${missing.length === 1 ? "" : "s"}: ${missing.map((header) => REQUIRED_STUDENT_CSV_HEADERS[required.indexOf(header)]).join(", ")}.`);
  }
  const indexes = required.map((header) => headers.indexOf(header));
  const rows = records.slice(1).map((cells, index) => {
    const firstName = (cells[indexes[0]] ?? "").trim();
    const lastName = (cells[indexes[1]] ?? "").trim();
    const email = (cells[indexes[2]] ?? "").trim().toLowerCase();
    const messages: string[] = [];
    if (!firstName) messages.push("First Name is blank.");
    if (!lastName) messages.push("Last Name is blank.");
    if (!email) messages.push("Email Address is blank.");
    else if (!validEmail(email)) messages.push("Email Address is not a valid email address.");
    return { rowNumber: index + 2, firstName, lastName, displayName: `${firstName} ${lastName}`.trim(), email, messages };
  });

  const occurrences = new Map<string, number[]>();
  for (const row of rows) {
    if (row.email) occurrences.set(row.email, [...(occurrences.get(row.email) ?? []), row.rowNumber]);
  }
  for (const row of rows) {
    const duplicateRows = occurrences.get(row.email) ?? [];
    if (duplicateRows.length > 1) row.messages.push(`Duplicate Email Address in CSV (rows ${duplicateRows.join(", ")}).`);
  }
  return rows;
}
