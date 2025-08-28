import React from "react";
import { type Subtitle } from "../types";
import { clamp } from "../lib/time";

type Props = {
  item: Subtitle;
  selected: boolean;
  pxPerSec: number;
  durationMs: number;
  onSelectId: (id: string) => void;                         // stable fn
  onChangeById: (id: string, updater: (s: Subtitle)=>Subtitle) => void; // stable fn
};

function TimelineBlock({
  item, selected, pxPerSec, durationMs, onSelectId, onChangeById
}: Props) {
  const onResize = (side: 'left' | 'right', e: React.MouseEvent) => {
    e.stopPropagation();
    const startX = e.clientX;
    const { startMs: startL, endMs: startR } = item;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dMs = (dx / pxPerSec) * 1000;
      if (side === 'left') {
        const ns = clamp(Math.round(startL + dMs), 0, startR - 50);
        onChangeById(item.id, (s) => ({ ...s, startMs: ns }));
      } else {
        const ne = clamp(Math.round(startR + dMs), startL + 50, durationMs);
        onChangeById(item.id, (s) => ({ ...s, endMs: ne }));
      }
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const left = (item.startMs / 1000) * pxPerSec;
  const width = ((item.endMs - item.startMs) / 1000) * pxPerSec;

  return (
    <div
      className={[
        "absolute top-2 h-10 rounded-xl border",
        selected ? "bg-emerald-500/20 border-emerald-500" : "bg-neutral-700/40 border-neutral-600",
        "shadow-md select-none flex items-stretch"
      ].join(' ')}
      style={{ left, width }}
      onClick={(e) => { e.stopPropagation(); onSelectId(item.id); }}
      title="Click to select • Enter to edit in panel"
    >
      <div
        onMouseDown={(e) => onResize('left', e)}
        className="w-2 cursor-ew-resize rounded-l-xl hover:bg-emerald-400/50"
      />
      <div className="flex-1 px-2 py-1 overflow-hidden">
        <div className={"text-xs truncate " + (selected ? "text-emerald-200" : "text-neutral-200")}>
          {item.text.replace(/\n/g, " ")}
        </div>
      </div>
      <div
        onMouseDown={(e) => onResize('right', e)}
        className="w-2 cursor-ew-resize rounded-r-xl hover:bg-emerald-400/50"
      />
    </div>
  );
}

export default React.memo(TimelineBlock, (prev, next) => {
  // Only re-render when geometry/selection/content actually changes
  return (
    prev.selected === next.selected &&
    prev.pxPerSec === next.pxPerSec &&
    prev.durationMs === next.durationMs &&
    prev.item.startMs === next.item.startMs &&
    prev.item.endMs === next.item.endMs &&
    prev.item.text === next.item.text
  );
});
