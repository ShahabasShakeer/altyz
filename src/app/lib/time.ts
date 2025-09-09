export const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

export const msToTimestamp = (msIn: number) => {
  // SRT needs integer ms, 3 digits, comma separator
  const ms = Math.max(0, Math.round(msIn || 0));
  const totalSeconds = Math.floor(ms / 1000);
  const s = totalSeconds % 60;
  const m = Math.floor(totalSeconds / 60) % 60;
  const h = Math.floor(totalSeconds / 3600);
  const mmm = (ms % 1000).toString().padStart(3, '0');
  const pad2 = (n: number) => n.toString().padStart(2, '0');
  return `${pad2(h)}:${pad2(m)}:${pad2(s)},${mmm}`;
};


export const timestampToMs = (ts: string) => {
  // Supports "HH:MM:SS,mmm"
  const m = ts.trim().match(/^(\d+):(\d{2}):(\d{2}),(\d{3})$/);
  if (!m) return 0;
  const h = parseInt(m[1], 10);
  const mi = parseInt(m[2], 10);
  const s = parseInt(m[3], 10);
  const ms = parseInt(m[4], 10);
  return (((h * 60 + mi) * 60) + s) * 1000 + ms;
};

export const msToMinuteClock = (ms: number) => {
  const totalMs = Math.max(0, Math.floor(ms));
  const totalSeconds = Math.floor(totalMs / 1000);
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  const mmm = totalMs % 1000;
  const pad2 = (n: number) => n.toString().padStart(2, '0');
  const pad3 = (n: number) => n.toString().padStart(3, '0');
  return `${pad2(mm)}:${pad2(ss)}:${pad3(mmm)}`; // mm:ss:ms
};

