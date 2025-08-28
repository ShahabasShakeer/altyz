import React, { useEffect, useState } from "react";
import { type Subtitle } from "../types";

type Props = {
  subtitle: Subtitle | null;
  onSaveAndClose: (text: string) => void;
  onCancel?: () => void; // not used, Esc saves
};

export default function SubtitleEditor({ subtitle, onSaveAndClose }: Props) {
  const [draft, setDraft] = useState(subtitle?.text ?? "");

  useEffect(() => {
    setDraft(subtitle?.text ?? "");
  }, [subtitle?.id]);

  if (!subtitle) return null;

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 shadow-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-neutral-300">
          Editing subtitle <span className="font-mono text-neutral-400">[{subtitle.id.slice(0,8)}]</span>
        </div>
        <div className="text-xs text-neutral-400">Press <span className="font-mono">Esc</span> to save & close</div>
      </div>

      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            onSaveAndClose(draft.trim() || "Subtitle");
          }
        }}
        className="w-full h-32 bg-black/60 text-neutral-100 text-sm outline-none rounded-xl p-3 resize-y"
        autoFocus
        placeholder="Type subtitle text…"
      />

      <div className="flex justify-end gap-2 mt-2">
        <button
          className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm"
          onClick={() => onSaveAndClose(draft.trim() || "Subtitle")}
        >
          Save
        </button>
      </div>
    </div>
  );
}
