import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = require("node:fs").readFileSync("lib/timetable-analyser.ts", "utf8");
const out = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
const dir = mkdtempSync(join(tmpdir(), "timetable-analyser-"));
const modPath = join(dir, "timetable-analyser.cjs");
writeFileSync(modPath, out);
const { analyseTimetableWorkbook, parseSheet } = require(modPath);

const sheetXml = `<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1"/><c r="C1" t="s"><v>1</v></c></row></sheetData></worksheet>`;
const rows = parseSheet(sheetXml, ["First", "Third"]);
assert.equal(rows[0][0], "First");
assert.equal(rows[0][1], "");
assert.equal(rows[0][2], "Third");

const enc = new TextEncoder();
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(buf) { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function u16(n) { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; }
function u32(n) { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; }
function zip(files) {
  const local = [], central = []; let offset = 0;
  for (const [name, content] of files) {
    const nameBuf = enc.encode(name), data = enc.encode(content), crc = crc32(data);
    const lh = Buffer.concat([Buffer.from([0x50,0x4b,0x03,0x04]), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(nameBuf.length), u16(0), Buffer.from(nameBuf), Buffer.from(data)]);
    local.push(lh);
    central.push(Buffer.concat([Buffer.from([0x50,0x4b,0x01,0x02]), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(nameBuf.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), Buffer.from(nameBuf)]));
    offset += lh.length;
  }
  const cd = Buffer.concat(central);
  return Buffer.concat([...local, cd, Buffer.from([0x50,0x4b,0x05,0x06]), u16(0), u16(0), u16(files.length), u16(files.length), u32(cd.length), u32(offset), u16(0)]);
}
const ss = ["Name","Code","Monday","Tutor Time","P1","P2","P3","P4","P5","P6","P7","Alison Phaup","APH","Dan Su","DSU","12ACC1\nAccounting\nA101","Unavailable Time","Y12ABC","100"];
const sharedStrings = `<sst>${ss.map(s => `<si><t>${s.replace(/&/g,"&amp;").replace(/</g,"&lt;")}</t></si>`).join("")}</sst>`;
const wbSheet = `<worksheet><sheetData>
<row r="1"><c r="C1" t="s"><v>2</v></c><c r="D1"/><c r="E1"/><c r="F1"/><c r="G1"/><c r="H1"/><c r="I1"/><c r="J1"/><c r="K1"/></row>
<row r="2"><c r="A2" t="s"><v>0</v></c><c r="B2" t="s"><v>1</v></c><c r="C2" t="s"><v>3</v></c><c r="D2" t="s"><v>4</v></c><c r="E2" t="s"><v>5</v></c><c r="F2" t="s"><v>6</v></c><c r="G2" t="s"><v>7</v></c><c r="H2" t="s"><v>8</v></c><c r="I2" t="s"><v>9</v></c><c r="J2" t="s"><v>10</v></c></row>
<row r="3"><c r="A3" t="s"><v>11</v></c><c r="B3" t="s"><v>12</v></c><c r="C3"/><c r="D3" t="s"><v>16</v></c><c r="E3" t="s"><v>18</v></c></row>
<row r="4"><c r="A4" t="s"><v>13</v></c><c r="B4" t="s"><v>14</v></c><c r="C4" t="s"><v>17</v></c><c r="D4" t="s"><v>15</v></c><c r="E4" t="s"><v>15</v></c><c r="F4" t="s"><v>15</v></c><c r="G4" t="s"><v>15</v></c><c r="H4" t="s"><v>15</v></c></row>
</sheetData></worksheet>`;
const xlsx = zip([
  ["xl/workbook.xml", `<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Timetable Week(US)" sheetId="1" r:id="rId1"/></sheets></workbook>`],
  ["xl/_rels/workbook.xml.rels", `<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>`],
  ["xl/sharedStrings.xml", sharedStrings],
  ["xl/worksheets/sheet1.xml", wbSheet],
]);
const analysis = await analyseTimetableWorkbook(xlsx, "fixture.xlsx");
const alison = analysis.staff.find(s => s.staffName === "Alison Phaup");
const dan = analysis.staff.find(s => s.staffName === "Dan Su");
assert.equal(alison.isTutor, false);
assert.deepEqual(alison.tutorGroups, []);
assert.equal(dan.teachingLessonCount, 5);
assert.ok(!analysis.staff.flatMap(s => s.tutorGroups).some(g => /^\d+$/.test(g) || g === "Unavailable Time"));
assert.equal(analysis.subjectYearGroups.find(s => s.subject === "Accounting" && s.yearGroup === "Y12")?.lessonCount, 5);
console.log("timetable analyser fixture checks passed");
