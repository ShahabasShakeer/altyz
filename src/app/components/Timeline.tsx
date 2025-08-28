import React, { useEffect, useMemo, useRef, useCallback } from "react";
import { type Subtitle } from "../types";
import { BLOCK_ADJUST_MS, SEEK_STEP_MS, MOVE_BLOCK_STEP_MS } from "../config";
import TimelineBlock from "./TimelineBlock";
import { clamp, msToMinuteClock } from "../lib/time";
import { throttle } from "../lib/util";

type Props = {
  durationMs: number;
  currentMs: number;                         // changes every tick, but we won't pass it to blocks
  setCurrentMs: (ms: number) => void;        // safe setter from App
  onExternalSeek: (ms: number) => void;      // explicit seeks (click/[/]/jump)
  pxPerSec: number;
  subtitles: Subtitle[];
  setSubtitles: (updater: (prev: Subtitle[]) => Subtitle[]) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  isEditingText: boolean;
  setIsEditingText: (v: boolean) => void;
  onCreateAt: (ms: number) => void;
  onJumpToBlock: (id: string) => void;
  onDeleteSelected: () => void;
};

export default function Timeline({
  durationMs,
  currentMs,
  setCurrentMs,
  onExternalSeek,
  pxPerSec,
  subtitles,
  setSubtitles,
  selectedId,
  setSelectedId,
  isEditingText,
  setIsEditingText,
  onCreateAt,
  onJumpToBlock,
  onDeleteSelected,
}: Props) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const playheadRef = useRef<HTMLDivElement | null>(null);
  const pxTotal = Math.max(0, (durationMs / 1000) * pxPerSec);

  // Always sorted snapshot for adjacency logic
  const sorted = useMemo(
    () => [...subtitles].sort((a, b) => a.startMs - b.startMs),
    [subtitles]
  );

  // --- stable handlers passed to blocks (avoid new fn refs each tick) ---
  const onSelectId = useCallback((id: string) => {
    setSelectedId(id);
    onJumpToBlock(id);        // triggers external seek via App
  }, [setSelectedId, onJumpToBlock]);

  const onChangeById = useCallback((id: string, updater: (s: Subtitle)=>Subtitle) => {
    setSubtitles((prev: Subtitle[]) => {
      const next: Subtitle[] = prev.map((s: Subtitle) => (s.id === id ? updater(s) : s));
      next.sort((a: Subtitle, b: Subtitle) => a.startMs - b.startMs);
      return next;
    });
  }, [setSubtitles]);

  // --- movement helpers (no-overlap move with RightCtrl handled in the global keys below) ---
  const selectPrevNext = (dir: -1 | 1) => {
    if (!sorted.length) return;
    if (!selectedId) {
      const idx = dir === 1 ? 0 : sorted.length - 1;
      setSelectedId(sorted[idx].id);
      onJumpToBlock(sorted[idx].id);
      return;
    }
    const idx = sorted.findIndex(s => s.id === selectedId);
    if (idx < 0) return;
    const nextIdx = clamp(idx + dir, 0, sorted.length - 1);
    setSelectedId(sorted[nextIdx].id);
    onJumpToBlock(sorted[nextIdx].id);
  };

  const moveSelectedBlock = (deltaMs: number) => {
    if (!selectedId || !sorted.length) return;
    const idx = sorted.findIndex(s => s.id === selectedId);
    if (idx < 0) return;

    const curr = sorted[idx];
    const len = curr.endMs - curr.startMs;

    const prevEnd = idx > 0 ? sorted[idx - 1].endMs : 0;
    const nextStart = idx < sorted.length - 1 ? sorted[idx + 1].startMs : durationMs;

    const lower = Math.max(0, prevEnd);
    const upper = Math.min(durationMs - len, nextStart - len);
    if (upper < lower) return;

    const targetStart = clamp(curr.startMs + deltaMs, lower, upper);
    const targetEnd = targetStart + len;
    if (targetStart === curr.startMs) return;

    onChangeById(curr.id, (s) => ({ ...s, startMs: targetStart, endMs: targetEnd }));
  };

  // --- keyboard shortcuts (no per-tick updates; gated by isEditingText) ---
  const rightCtrlDownRef = useRef(false);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "ControlLeft") rightCtrlDownRef.current = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "ControlLeft") rightCtrlDownRef.current = false;
    };
    const blur = () => (rightCtrlDownRef.current = false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditingText) return;

      // prevent page scroll on space
      if (e.code === "Space") e.preventDefault();

      if (e.key === "Delete" && selectedId) {
        e.preventDefault();
        onDeleteSelected();
        return;
      }

      // RightCtrl + Arrow: MOVE selected block (no-overlap)
      if (rightCtrlDownRef.current && selectedId && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        const delta = (e.key === "ArrowRight" ? MOVE_BLOCK_STEP_MS : -MOVE_BLOCK_STEP_MS);
        moveSelectedBlock(delta);
        return;
      }

      // '+' creates block
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        onCreateAt(currentMs);
        return;
      }

      // [ / ] seek (explicit, tell video to seek once)
      if (e.key === '[') {
        e.preventDefault();
        onExternalSeek(currentMs - SEEK_STEP_MS);
        return;
      }
      if (e.key === ']') {
        e.preventDefault();
        onExternalSeek(currentMs + SEEK_STEP_MS);
        return;
      }

      // ArrowLeft/Right — navigate between blocks
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        selectPrevNext(-1);
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        selectPrevNext(1);
        return;
      }

      // ArrowUp/Down — lengthen/shorten selected block
      if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && selectedId) {
        e.preventDefault();
        const delta = (e.key === 'ArrowUp' ? BLOCK_ADJUST_MS : -BLOCK_ADJUST_MS);
        onChangeById(selectedId, (s) => {
          const newEnd = clamp(s.endMs + delta, s.startMs + 50, durationMs);
          return { ...s, endMs: newEnd };
        });
        return;
      }

      // Enter — open text editor
      if (e.key === 'Enter' && selectedId) {
        e.preventDefault();
        setIsEditingText(true);
        return;
      }
    };

    window.addEventListener("keydown", onKey, { passive: false });
    return () => window.removeEventListener("keydown", onKey);
  }, [
    isEditingText,
    selectedId,
    currentMs,
    durationMs,
    onCreateAt,
    onExternalSeek,
    setIsEditingText,
    onDeleteSelected,
  ]);

  // --- click to seek (explicit) ---
  const onTrackClick = (e: React.MouseEvent) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const xRaw = e.clientX - rect.left + trackRef.current.scrollLeft;
    const x = clamp(xRaw, 0, pxTotal);
    const seconds = pxPerSec > 0 ? (x / pxPerSec) : 0;
    const ms = Math.round(seconds * 1000);
    onExternalSeek(ms);
  };

  // --- move playhead via transform; no React left/width bindings ---
  useEffect(() => {
    if (!playheadRef.current) return;
    const px = (currentMs / 1000) * pxPerSec;
    playheadRef.current.style.transform = `translateX(${px}px)`;
  }, [currentMs, pxPerSec]);

  // --- edge-triggered, throttled follow (nudge scroll only near edges) ---
  const nudgeScroll = useMemo(() => throttle((targetX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const pad = 200;
    const maxScroll = Math.max(0, pxTotal - el.clientWidth);
    if (targetX < el.scrollLeft + pad) {
      el.scrollLeft = Math.max(0, targetX - pad);
    } else if (targetX > el.scrollLeft + el.clientWidth - pad) {
      el.scrollLeft = Math.min(maxScroll, targetX - el.clientWidth + pad);
    }
  }, 100 /* ~10Hz */), [pxTotal]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const x = (currentMs / 1000) * pxPerSec;
    nudgeScroll(x);
  }, [currentMs, pxPerSec, nudgeScroll]);

  // keep scrollLeft within bounds when zoom/duration changes
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const maxScroll = Math.max(0, pxTotal - el.clientWidth);
    if (el.scrollLeft > maxScroll) el.scrollLeft = maxScroll;
    if (el.scrollLeft < 0) el.scrollLeft = 0;
  }, [pxTotal]);

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 shadow-lg">
      <div className="px-4 py-2 text-sm text-neutral-300 border-b border-neutral-800 flex items-center justify-between">
        <div>Timeline</div>
        <div className="font-mono text-xs text-neutral-400">
          {msToMinuteClock(currentMs)} / {msToMinuteClock(durationMs)}
        </div>
      </div>

      <div
        ref={trackRef}
        className="relative overflow-x-auto overflow-y-hidden h-16"
        onClick={onTrackClick}
      >
        <div className="relative h-full" style={{ width: pxTotal }}>
          {/* Blocks (memoized; no currentMs dependency) */}
          {sorted.map(s => (
            <TimelineBlock
              key={s.id}
              item={s}
              selected={s.id === selectedId}
              pxPerSec={pxPerSec}
              durationMs={durationMs}
              onSelectId={onSelectId}
              onChangeById={onChangeById}
            />
          ))}

          {/* Playhead (moved via ref transform) */}
          <div
            ref={playheadRef}
            className="absolute top-0 bottom-0 w-[2px] bg-emerald-400 will-change-transform"
            style={{ transform: 'translateX(0px)' }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-2 text-xs text-neutral-400 border-t border-neutral-800">
        <div>
          Tip: <span className="font-mono">Del</span> Delete •
          <span className="ml-2 font-mono">RightCtrl + ←/→</span> Move block •
          <span className="ml-2 font-mono">Space</span> Play/Pause •
          <span className="ml-2 font-mono">[ ]</span> Seek •
          <span className="ml-2 font-mono">+</span> New •
          <span className="ml-2 font-mono">← →</span> Select •
          <span className="ml-2 font-mono">↑ ↓</span> ±500ms •
          <span className="ml-2 font-mono">Enter</span> Edit •
          <span className="ml-2 font-mono">Esc</span> Save
        </div>
      </div>
    </div>
  );
}
