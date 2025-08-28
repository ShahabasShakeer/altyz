import { type Subtitle } from "../types";
import { msToTimestamp, timestampToMs } from "./time";

export function parseSRT(srt: string): Subtitle[] {
  const blocks = srt.split(/\r?\n\r?\n/);
  const out: Subtitle[] = [];

  for (const block of blocks) {
    const lines = block.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) continue;

    // lines[0] may be index (ignore)
    const timingLine = lines[1]?.includes('-->')
      ? lines[1]
      : lines[0]?.includes('-->')
        ? lines[0]
        : '';

    const m = timingLine.match(/(\d+:\d{2}:\d{2},\d{3})\s*-->\s*(\d+:\d{2}:\d{2},\d{3})/);
    if (!m) continue;

    const startMs = timestampToMs(m[1]);
    const endMs = timestampToMs(m[2]);
    const textLines = lines.slice(timingLine === lines[1] ? 2 : 1);
    const text = textLines.join('\n').trim();

    out.push({
      id: crypto.randomUUID(),
      startMs,
      endMs,
      text: text || 'Subtitle',
    });
  }

  // Keep sorted
  out.sort((a, b) => a.startMs - b.startMs);
  return out;
}

// Serialize current subtitles to SRT text
export function toSRT(subs: Subtitle[]): string {
  const items = [...subs].sort((a, b) => a.startMs - b.startMs);
  return items
    .map((s, i) =>
      `${i + 1}
${msToTimestamp(s.startMs)} --> ${msToTimestamp(s.endMs)}
${s.text}\n`
    )
    .join("\n");
}