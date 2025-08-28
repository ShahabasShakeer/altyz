import React from "react";
import { ZOOM_MIN_PX_PER_SEC, ZOOM_MAX_PX_PER_SEC } from "../config";

type Props = {
  onVideoFile: (file: File) => void;
  onSrtFile: (file: File) => void;
  zoom: number;
  setZoom: (z: number) => void;
};

export default function TopBar({ onVideoFile, onSrtFile, zoom, setZoom }: Props) {
  return (
    <div className="w-full bg-neutral-900/80 backdrop-blur sticky top-0 z-30 border-b border-neutral-800">
      <div className="max-w-6xl mx-auto px-4 py-3 grid md:grid-cols-3 gap-3 items-center">
        {/* Left: Uploads */}
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 cursor-pointer text-sm">
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onVideoFile(f);
              }}
            />
            Upload Video
          </label>

          <label className="inline-flex items-center px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 cursor-pointer text-sm">
            <input
              type="file"
              accept=".srt"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onSrtFile(f);
              }}
            />
            Upload .srt
          </label>
        </div>

        {/* Middle: Title */}
        <div className="text-center text-sm md:text-base text-neutral-200">
          <span className="font-semibold">Altyz</span>
          {/* <span className="ml-2 text-neutral-400">— Dark Mode</span> */}
        </div>

        {/* Right: Zoom */}
        <div className="flex items-center justify-end gap-3">
          <span className="text-xs text-neutral-400">Zoom</span>
          <input
            type="range"
            min={ZOOM_MIN_PX_PER_SEC}
            max={ZOOM_MAX_PX_PER_SEC}
            value={zoom}
            onChange={(e) => setZoom(parseInt(e.target.value, 10))}
            className="w-40"
          />
        </div>
      </div>
    </div>
  );
}
