import React, { useEffect, useRef } from "react";
import { type Subtitle } from "../types";
import { DIAG_ENABLE } from "../config";

type Props = {
  src: string | null;
  playing: boolean;
  setPlaying: (p: boolean) => void;
  currentMs: number;
  setCurrentMs: (ms: number) => void;           // explicit seeks & paused
  setCurrentMsThrottled: (ms: number) => void;  // playback-driven throttled updates
  subtitles: Subtitle[];
  onDuration: (ms: number) => void;
  durationMs?: number;
  seekNonce?: number;
};

export default function VideoPlayer({
  src, playing, setPlaying, currentMs,
  setCurrentMs, setCurrentMsThrottled,
  subtitles, onDuration, durationMs = Infinity, seekNonce = -1,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastSeekNonceRef = React.useRef<number>(-1);

  // ==== DIAGNOSTIC: log events ====
  useEffect(() => {
    if (!DIAG_ENABLE) return;
    const v = videoRef.current;
    if (!v) return;

    const log = (evt: Event) => {
      // small, consistent line
      // eslint-disable-next-line no-console
      console.log(
        `[VIDEO:${evt.type}] t=${(v.currentTime*1000|0)}ms paused=${v.paused} ended=${v.ended}`
      );
    };

    const events = [
      "play","playing","pause","waiting","stalled","seeking","seeked",
      "timeupdate","ratechange","progress","loadedmetadata","canplay","canplaythrough","ended","suspend"
    ] as const;

    events.forEach(e => v.addEventListener(e, log));
    return () => events.forEach(e => v.removeEventListener(e, log));
  }, []);

  // ==== Playback tick (RAF or rVFC) ====
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const tick = () => {
      const ms = Math.min(v.currentTime * 1000, durationMs);
      // Throttled UI update to avoid per-frame React churn
      setCurrentMsThrottled(ms);
      rafRef.current = requestAnimationFrame(tick);
    };

    if (playing) {
      v.play().catch(() => {});
      rafRef.current = requestAnimationFrame(tick);
    } else {
      v.pause();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [playing, setCurrentMsThrottled, durationMs]);

  // ==== Seek only when paused or on explicit seekNonce ====
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const targetSec = Math.min(currentMs, durationMs) / 1000;

    if (!playing) {
      if (Math.abs(v.currentTime - targetSec) > 0.01) v.currentTime = targetSec;
      return;
    }
    if (seekNonce !== lastSeekNonceRef.current) {
      v.currentTime = targetSec;
      lastSeekNonceRef.current = seekNonce;
    }
  }, [currentMs, durationMs, playing, seekNonce]);

  const onLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v || !isFinite(v.duration)) return;
    onDuration(Math.round(v.duration * 1000));
  };

  // (Active subtitle overlay unchanged)
  const active = subtitles.find(s => currentMs >= s.startMs && currentMs <= s.endMs);

  return (
    <div className="relative bg-black rounded-2xl overflow-hidden shadow-xl border border-neutral-800">
      {src ? (
        <>
          <video
            ref={videoRef}
            src={src}
            className="w-full max-h-[60vh] object-contain bg-black"
            controls
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onLoadedMetadata={onLoadedMetadata}
          />
          {active && (
            <div className="absolute bottom-4 left-0 right-0 flex justify-center px-6 pointer-events-none">
              <div className="bg-black/70 px-4 py-2 rounded text-neutral-100 text-lg text-center">
                {active.text.split('\n').map((l, i) => <div key={i}>{l}</div>)}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="h-64 grid place-items-center text-neutral-400">
          Upload a video to start
        </div>
      )}
    </div>
  );
}
