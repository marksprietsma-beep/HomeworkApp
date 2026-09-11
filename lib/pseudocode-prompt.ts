export type PromptSegment = { type: "text" | "pseudocode"; value: string };

const openingFence = /^```pseudocode[ \t]*\r?$/;
const closingFence = /^```[ \t]*\r?$/;

/** Parse only Clarion's pseudocode presentation fences, never general Markdown. */
export function parsePseudocodePrompt(prompt: string): PromptSegment[] {
  const lines = prompt.split(/(?<=\n)/);
  const segments: PromptSegment[] = [];
  let text = "";
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const content = line.endsWith("\n") ? line.slice(0, -1) : line;
    if (!openingFence.test(content)) { text += line; continue; }
    let end = index + 1;
    while (end < lines.length) {
      const candidate = lines[end].endsWith("\n") ? lines[end].slice(0, -1) : lines[end];
      if (closingFence.test(candidate)) break;
      end += 1;
    }
    if (end === lines.length) return [{ type: "text", value: prompt }];
    if (text) segments.push({ type: "text", value: text.replace(/\n$/, "") });
    segments.push({ type: "pseudocode", value: lines.slice(index + 1, end).join("").replace(/\n$/, "") });
    text = "";
    index = end;
  }
  if (text) segments.push({ type: "text", value: text.replace(/^\n/, "") });
  return segments.length ? segments : [{ type: "text", value: prompt }];
}
