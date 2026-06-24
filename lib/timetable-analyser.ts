import { inflateRawSync } from "node:zlib";

export type RawTimetableCell = { staffName: string; staffCode: string; day: string; period: string; rawValue: string; row: number; column: string };
export type ParsedLessonEntry = RawTimetableCell & { classGroup: string; subject: string; room?: string; yearGroup?: string; isTeachingLesson: boolean; isTutorEntry: boolean };
export type StaffSummary = { staffName: string; staffCode: string; teachingLessonCount: number; isTutor: boolean; tutorGroups: string[]; subjects: string[]; yearGroups: string[]; classGroups: string[] };
export type SubjectSummary = { subject: string; lessonCount: number; yearGroups: string[]; classGroups: string[]; teachers: string[] };
export type SubjectYearSummary = { subject: string; yearGroup: string; lessonCount: number; lessonCountLabel: string; classGroups: string[]; teachers: string[]; groupLessonCounts: { classGroup: string; lessonCount: number }[]; hasInconsistentGroupCounts: boolean };
export type YearGroupSummary = { yearGroup: string; subjects: string[] };
export type TimetableImportWarning = { staffName?: string; staffCode?: string; day?: string; period?: string; rawValue?: string; reason: string; row?: number; column?: string };
export type TimetableAnalysis = { rawCells: RawTimetableCell[]; parsedLessons: ParsedLessonEntry[]; staff: StaffSummary[]; subjects: SubjectSummary[]; yearGroups: YearGroupSummary[]; subjectYearGroups: SubjectYearSummary[]; warnings: TimetableImportWarning[]; totals: { staffDetected: number; subjectsDetected: number; yearGroupsDetected: number; teachingLessonsCounted: number; warningCount: number } };

const WORKSHEET_NAME = "Timetable Week(US)";
const TEACHING_PERIODS = new Set(["P1", "P2", "P3", "P4", "P5", "P6", "P7"]);
const TUTOR_PERIODS = new Set(["Tutor Time", "Afternoon TT"]);
const PERIODS = new Set(["Tutor Time", "P1", "P2", "P3", "P4", "P5", "P6", "P7", "USL", "Afternoon TT", "EA", "ASA"]);
const WEEKDAYS = new Set(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]);
const NON_CURRICULUM = /^(registration|reg|meeting|house|unavailable(?: time)?|free|duty|duties|activity|activities|ea|asa|usl|break|lunch|cover|private study|study)$/i;
const VALID_TUTOR_GROUP = /^(?:(?:[A-Z]{1,4}\/)?(?:Y)?(?:7|8|9|10|11|12|13)[A-Z0-9]{1,12})$/i;

type WorkbookSheet = { name: string; sheetId: string; relationshipId: string };
type SelectedWorksheet = { sheet: WorkbookSheet; fallbackAttempted: boolean; matchedBy: string };

function listWorkbookSheets(workbookXml: string): WorkbookSheet[] {
  return [...workbookXml.matchAll(/<sheet\b[^>]*>/g)].map(match => {
    const tag = match[0];
    const name = tag.match(/\bname="([^"]*)"/)?.[1];
    const sheetId = tag.match(/\bsheetId="([^"]*)"/)?.[1];
    const relationshipId = tag.match(/\br:id="([^"]*)"/)?.[1];
    return name && sheetId && relationshipId ? { name: unescapeXml(name), sheetId, relationshipId } : null;
  }).filter((sheet): sheet is WorkbookSheet => Boolean(sheet));
}

function formatWorksheetNames(sheets: WorkbookSheet[]) {
  return sheets.length ? sheets.map(sheet => `"${sheet.name}"`).join(", ") : "none found";
}

function selectTimetableSheet(sheets: WorkbookSheet[]): SelectedWorksheet {
  const exact = sheets.find(sheet => sheet.name === WORKSHEET_NAME);
  if (exact) return { sheet: exact, fallbackAttempted: false, matchedBy: "exact worksheet name" };

  const trimmed = sheets.find(sheet => sheet.name.trim() === WORKSHEET_NAME);
  if (trimmed) return { sheet: trimmed, fallbackAttempted: true, matchedBy: "trimmed worksheet name" };

  const expectedLower = WORKSHEET_NAME.toLowerCase();
  const caseInsensitive = sheets.find(sheet => sheet.name.trim().toLowerCase() === expectedLower);
  if (caseInsensitive) return { sheet: caseInsensitive, fallbackAttempted: true, matchedBy: "case-insensitive trimmed worksheet name" };

  const fuzzy = sheets.find(sheet => {
    const normalised = sheet.name.trim().toLowerCase();
    return normalised.includes("timetable") && normalised.includes("us");
  });
  if (fuzzy) return { sheet: fuzzy, fallbackAttempted: true, matchedBy: "fuzzy worksheet name containing timetable and us" };

  if (sheets.length === 1) return { sheet: sheets[0], fallbackAttempted: true, matchedBy: "single worksheet fallback" };

  throw new Error(`Worksheet "${WORKSHEET_NAME}" was not found. Available worksheets: ${formatWorksheetNames(sheets)}. Expected worksheet name: "${WORKSHEET_NAME}". Fallback attempted: yes (trimmed, case-insensitive, fuzzy, and single-sheet fallback). Reason: no worksheet matched the timetable analyser sheet detection rules.`);
}

function workbookTargetPath(target: string) {
  const cleanTarget = target.replace(/^\//, "");
  return cleanTarget.startsWith("xl/") ? cleanTarget : `xl/${cleanTarget.replace(/^\.\.\//, "")}`;
}

function text(buf: Buffer) { return buf.toString("utf8"); }
function unzipXlsx(input: Buffer): Map<string, string> {
  const entries = new Map<string, string>();
  const eocd = input.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error("The uploaded file is not a readable .xlsx workbook.");
  const total = input.readUInt16LE(eocd + 10);
  let offset = input.readUInt32LE(eocd + 16);
  for (let i = 0; i < total; i++) {
    if (input.readUInt32LE(offset) !== 0x02014b50) throw new Error("The workbook zip directory is malformed.");
    const method = input.readUInt16LE(offset + 10), compSize = input.readUInt32LE(offset + 20), nameLen = input.readUInt16LE(offset + 28), extraLen = input.readUInt16LE(offset + 30), commentLen = input.readUInt16LE(offset + 32), localOffset = input.readUInt32LE(offset + 42);
    const name = input.subarray(offset + 46, offset + 46 + nameLen).toString();
    const localNameLen = input.readUInt16LE(localOffset + 26), localExtraLen = input.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const compressed = input.subarray(dataStart, dataStart + compSize);
    entries.set(name, text(method === 0 ? compressed : inflateRawSync(compressed)));
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}
const unescapeXml = (value: string) => value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
function sharedStrings(files: Map<string,string>) { const xml = files.get("xl/sharedStrings.xml") ?? ""; return [...xml.matchAll(/<si[\s\S]*?<\/si>/g)].map(m => unescapeXml([...m[0].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join(""))); }
function colIndex(ref: string) { const letters = ref.replace(/\d+/g, ""); let n = 0; for (const ch of letters) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; }
function colName(index: number) { let n = index + 1, s = ""; while (n) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; }
export function parseSheet(xml: string, strings: string[]) {
  const rows: string[][] = [];
  for (const rm of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>|<row\b([^>]*)\/>/g)) {
    const rowAttrs = rm[1] ?? rm[3] ?? "";
    const explicitRow = rowAttrs.match(/\br="(\d+)"/)?.[1];
    const rowNum = explicitRow ? Number(explicitRow) - 1 : rows.length;
    rows[rowNum] = rows[rowNum] ?? [];
    const body = rm[2] ?? "";
    for (const cm of body.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1] ?? "";
      const ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1];
      if (!ref) continue;
      const idx = colIndex(ref);
      const cellBody = cm[2] ?? "";
      const type = attrs.match(/\bt="([^"]+)"/)?.[1];
      const rawValue = cellBody.match(/<v[^>]*>([\s\S]*?)<\/v>/)?.[1];
      let val = "";
      if (type === "s" && rawValue !== undefined) val = strings[Number(rawValue)] ?? "";
      else if (type === "inlineStr") val = [...cellBody.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join("");
      else if (rawValue !== undefined) val = rawValue;
      rows[rowNum][idx] = unescapeXml(val).trim();
    }
  }
  return rows;
}
function splitEntries(raw: string) { return raw.split(/\n\s*-{3,}\s*\n|\n\s*[-–—]{5,}\s*\n/g).map(x => x.trim()).filter(Boolean); }
function yearFromClass(group: string) { const m = group.match(/(?:^|\/)(?:Y)?(\d{1,2})(?=\D|$)/i); return m ? `Y${m[1]}` : undefined; }
function add(set: Set<string>, v?: string) { if (v) set.add(v); }
function sorted(set: Set<string>) { return [...set].sort((a,b)=>a.localeCompare(b, undefined, {numeric:true})); }
function normaliseTutorGroup(value: string) {
  const group = value.replace(/\s+/g, "").trim();
  if (!group || /^\d+$/.test(group) || NON_CURRICULUM.test(value) || !VALID_TUTOR_GROUP.test(group)) return undefined;
  const upper = group.toUpperCase();
  return upper.includes("/") ? upper : upper.replace(/^Y?(\d+)/, "Y$1");
}
function tutorGroupFromTutorTime(lines: string[]) {
  const registrationIndex = lines.findIndex(line => /registration/i.test(line));
  if (registrationIndex <= 0) return undefined;
  return normaliseTutorGroup(lines[registrationIndex - 1]);
}
function parseLesson(cell: RawTimetableCell): { entries: ParsedLessonEntry[]; warnings: TimetableImportWarning[] } {
  const entries: ParsedLessonEntry[] = [], warnings: TimetableImportWarning[] = [];
  for (const part of splitEntries(cell.rawValue.replace(/\r/g, "\n"))) {
    const lines = part.split(/\n+/).map(x => x.trim()).filter(Boolean);
    const isTutor = TUTOR_PERIODS.has(cell.period);
    if (isTutor) {
      const group = tutorGroupFromTutorTime(lines);
      if (group) entries.push({...cell, classGroup: group, subject: "Tutor Time", yearGroup: yearFromClass(group), isTeachingLesson: false, isTutorEntry: true});
      continue;
    }
    if (!TEACHING_PERIODS.has(cell.period)) continue;
    if (lines.length >= 3 && !NON_CURRICULUM.test(lines[1]) && !NON_CURRICULUM.test(lines.join(" "))) {
      const [classGroup, subject, room] = lines;
      entries.push({...cell, classGroup, subject, room, yearGroup: yearFromClass(classGroup), isTeachingLesson: true, isTutorEntry: false});
    } else if (lines.length > 0 && !NON_CURRICULUM.test(lines.join(" "))) warnings.push({...cell, reason: "Cell does not match the expected class / subject / room lesson pattern."});
  }
  return {entries, warnings};
}
export async function analyseTimetableWorkbook(buffer: Buffer, fileName = "upload.xlsx"): Promise<TimetableAnalysis> {
  if (!buffer.length) throw new Error("Choose a non-empty .xlsx timetable workbook before analysing.");
  if (!fileName.toLowerCase().endsWith(".xlsx")) throw new Error("Timetable analyser currently supports .xlsx uploads only.");
  const files = unzipXlsx(buffer); const workbook = files.get("xl/workbook.xml") ?? "";
  const workbookSheets = listWorkbookSheets(workbook);
  const selectedWorksheet = selectTimetableSheet(workbookSheets);
  const rels = files.get("xl/_rels/workbook.xml.rels") ?? ""; const rel = rels.match(new RegExp(`<Relationship[^>]*Id="${selectedWorksheet.sheet.relationshipId}"[^>]*Target="([^"]+)"`));
  const sheetPath = workbookTargetPath(rel?.[1] ?? `worksheets/sheet${selectedWorksheet.sheet.sheetId}.xml`); const sheet = files.get(sheetPath); if (!sheet) throw new Error(`Could not read the timetable worksheet data. Available worksheets: ${formatWorksheetNames(workbookSheets)}. Expected worksheet name: "${WORKSHEET_NAME}". Matched worksheet: "${selectedWorksheet.sheet.name}" by ${selectedWorksheet.matchedBy}. Fallback attempted: ${selectedWorksheet.fallbackAttempted ? "yes" : "no"}. Reason: workbook metadata loaded, but ${sheetPath} was missing from the uploaded .xlsx file.`);
  const rows = parseSheet(sheet, sharedStrings(files)); const firstStaffRow = rows.findIndex(r => r?.[0] && r?.[1] && !/staff|name/i.test(`${r[0]} ${r[1]}`));
  const headerRows = rows.slice(0, Math.max(0, firstStaffRow)); const meta: Record<number,{day:string;period:string}> = {}; let day = "";
  const maxCols = Math.max(...rows.map(r => r?.length ?? 0)); for (let c=2;c<maxCols;c++){ for (const hr of headerRows){ const v=hr?.[c]; if (v && WEEKDAYS.has(v)) day=v; if (v && PERIODS.has(v)) meta[c]={day, period:v}; } }
  const rawCells: RawTimetableCell[] = [], warnings: TimetableImportWarning[] = [], parsedLessons: ParsedLessonEntry[] = []; const staffMap = new Map<string, {name:string; code:string; tutor:Set<string>; subjects:Set<string>; years:Set<string>; classes:Set<string>; count:number}>();
  rows.forEach((r, ri) => { const name=r?.[0]?.trim(), code=r?.[1]?.trim(); if (!name || !code || /staff|name/i.test(`${name} ${code}`)) return; staffMap.set(code, staffMap.get(code) ?? {name, code, tutor:new Set(), subjects:new Set(), years:new Set(), classes:new Set(), count:0}); for (let c=2;c<(r.length??0);c++){ const raw=r[c]?.trim(); if (!raw) continue; const m=meta[c]; if (!m) { warnings.push({staffName:name, staffCode:code, rawValue:raw, row:ri+1, column:colName(c), reason:"Could not map this cell to a recognised day and period header."}); continue; } const cell={staffName:name, staffCode:code, day:m.day, period:m.period, rawValue:raw, row:ri+1, column:colName(c)}; rawCells.push(cell); const parsed=parseLesson(cell); warnings.push(...parsed.warnings); parsedLessons.push(...parsed.entries); } });
  const subjectMap = new Map<string,{subject:string; count:number; years:Set<string>; classes:Set<string>; teachers:Set<string>}>();
  const subjectYearMap = new Map<string,{subject:string; yearGroup:string; classes:Set<string>; teachers:Set<string>; groupCounts:Map<string, number>}>();
  for (const e of parsedLessons) { const s=staffMap.get(e.staffCode)!; if (e.isTutorEntry) { s.tutor.add(e.classGroup); add(s.years,e.yearGroup); continue; } if (!e.isTeachingLesson) continue; s.count++; add(s.subjects,e.subject); add(s.years,e.yearGroup); add(s.classes,e.classGroup); const subj=subjectMap.get(e.subject) ?? {subject:e.subject,count:0,years:new Set(),classes:new Set(),teachers:new Set()}; subj.count++; add(subj.years,e.yearGroup); add(subj.classes,e.classGroup); subj.teachers.add(`${e.staffName} (${e.staffCode})`); subjectMap.set(e.subject, subj); const yearGroup=e.yearGroup ?? "Unknown"; const key=`${e.subject}|||${yearGroup}`; const sy=subjectYearMap.get(key) ?? {subject:e.subject, yearGroup, classes:new Set(), teachers:new Set(), groupCounts:new Map()}; add(sy.classes,e.classGroup); sy.teachers.add(`${e.staffName} (${e.staffCode})`); sy.groupCounts.set(e.classGroup, (sy.groupCounts.get(e.classGroup) ?? 0) + 1); subjectYearMap.set(key, sy); }
  const staff=sorted(new Set(staffMap.keys())).map(code => { const s=staffMap.get(code)!; return {staffName:s.name, staffCode:s.code, teachingLessonCount:s.count, isTutor:s.tutor.size>0, tutorGroups:sorted(s.tutor), subjects:sorted(s.subjects), yearGroups:sorted(s.years), classGroups:sorted(s.classes)}; });
  const subjects=[...subjectMap.values()].sort((a,b)=>a.subject.localeCompare(b.subject)).map(s=>({subject:s.subject, lessonCount:s.count, yearGroups:sorted(s.years), classGroups:sorted(s.classes), teachers:sorted(s.teachers)}));
  const ygMap = new Map<string, Set<string>>(); for (const s of subjects) for (const y of s.yearGroups) { if (!ygMap.has(y)) ygMap.set(y,new Set()); ygMap.get(y)!.add(s.subject); }
  const yearGroups=[...ygMap.entries()].sort((a,b)=>a[0].localeCompare(b[0], undefined, {numeric:true})).map(([yearGroup, subs])=>({yearGroup, subjects:sorted(subs)}));
  const subjectYearGroups=[...subjectYearMap.values()].sort((a,b)=>a.subject.localeCompare(b.subject) || a.yearGroup.localeCompare(b.yearGroup, undefined, {numeric:true})).map(s=>{
    const groupLessonCounts = [...s.groupCounts.entries()].sort((a,b)=>a[0].localeCompare(b[0], undefined, {numeric:true})).map(([classGroup, lessonCount]) => ({classGroup, lessonCount}));
    const counts = groupLessonCounts.map(g => g.lessonCount);
    const uniqueCounts = [...new Set(counts)].sort((a,b)=>a-b);
    const frequencies = new Map<number, number>();
    for (const count of counts) frequencies.set(count, (frequencies.get(count) ?? 0) + 1);
    const representative = [...frequencies.entries()].sort((a,b)=>b[1]-a[1] || a[0]-b[0])[0]?.[0] ?? 0;
    const hasInconsistentGroupCounts = uniqueCounts.length > 1;
    if (hasInconsistentGroupCounts) warnings.push({reason:`${s.subject} ${s.yearGroup} has inconsistent group lesson counts: ${groupLessonCounts.map(g => `${g.classGroup} = ${g.lessonCount}`).join(", ")}.`});
    return {subject:s.subject, yearGroup:s.yearGroup, lessonCount:representative, lessonCountLabel:hasInconsistentGroupCounts ? `${uniqueCounts[0]}–${uniqueCounts[uniqueCounts.length - 1]}` : `${representative}`, classGroups:sorted(s.classes), teachers:sorted(s.teachers), groupLessonCounts, hasInconsistentGroupCounts};
  });
  return {rawCells, parsedLessons, staff, subjects, yearGroups, subjectYearGroups, warnings, totals:{staffDetected:staff.length, subjectsDetected:subjects.length, yearGroupsDetected:yearGroups.length, teachingLessonsCounted:subjects.reduce((n,s)=>n+s.lessonCount,0), warningCount:warnings.length}};
}
