import { type Subtitle } from "../types";
import { msToTimestamp, timestampToMs } from "./time";

const MIN_LEN_MS = 50;

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

export function normalizeSubs(subs: Subtitle[], durationMs?: number): Subtitle[] {
  const d = typeof durationMs === 'number' ? Math.max(0, Math.round(durationMs)) : Number.POSITIVE_INFINITY;

  const items = [...subs]
    .map(s => {
      const start = Math.max(0, Math.round(s.startMs || 0));
      const end = Math.max(0, Math.round(s.endMs || 0));
      return { ...s, startMs: start, endMs: Math.max(end, start + MIN_LEN_MS) };
    })
    .sort((a, b) => a.startMs - b.startMs);

  // De-overlap in a single pass and clamp to duration
  let prevEnd = 0;
  for (const s of items) {
    if (s.startMs < prevEnd) s.startMs = prevEnd;                // push right to previous end
    s.endMs = Math.max(s.endMs, s.startMs + MIN_LEN_MS);         // ensure min length
    if (isFinite(d)) {
      s.startMs = Math.min(s.startMs, Math.max(0, d - MIN_LEN_MS));
      s.endMs = Math.min(s.endMs, d);
    }
    prevEnd = s.endMs;
  }
  return items;
}

// Serialize to SRT text (after normalization)
export function toSRT(subs: Subtitle[], durationMs?: number): string {
  const items = normalizeSubs(subs, durationMs);
  return items
    .map((s, i) =>
      `${i + 1
      }
${msToTimestamp(s.startMs)} --> ${msToTimestamp(s.endMs)}
${(s.text || "").replace(/\r/g, "").trim()}

`)
    .join("")
    .trimEnd() + "\n";
}