import { parsePseudocodePrompt } from "../../lib/pseudocode-prompt";
import { HighlightedPseudocode } from "./highlighted-pseudocode";

export function QuestionPrompt({ prompt }: { prompt: string }) {
  const segments = parsePseudocodePrompt(prompt);
  if (segments.length === 1 && segments[0].type === "text") return <>{prompt}</>;
  return <div className="grid gap-3 whitespace-pre-wrap">{segments.map((segment, index) => segment.type === "text" ? <span key={index}>{segment.value}</span> : <pre key={index} className="max-w-full overflow-x-auto rounded-xl border border-slate-300 bg-slate-50 p-4 text-left font-mono text-base font-normal leading-6 shadow-inner [font-synthesis:none] [font-variant-ligatures:none] [tab-size:2]" aria-label="Pseudocode example"><code><HighlightedPseudocode value={segment.value} /></code></pre>)}</div>;
}
