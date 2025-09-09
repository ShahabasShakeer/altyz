import React, { useCallback, useMemo, useState } from "react";
import TopBar from "./components/TopBar";
import VideoPlayer from "./components/VideoPlayer";
import Timeline from "./components/Timeline";
import { type Subtitle } from "./types";
import { ZOOM_DEFAULT_PX_PER_SEC, DEFAULT_BLOCK_MS, DIAG_ENABLE, DIAG_THROTTLE_FPS } from "./config";
import { parseSRT } from "./lib/srt";
import SubtitleEditor from "./components/SubtitleEditor";
import { msToMinuteClock } from "./lib/time";
import { toSRT } from "./lib/srt";
import { clamp } from "./lib/time";




export default function App() {
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [videoDurationMs, setVideoDurationMs] = useState(0);
    const [seekNonce, setSeekNonce] = React.useState(0);

    const [playing, setPlaying] = useState(false);
    const [currentMs, setCurrentMs] = useState(0);

    const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isEditingText, setIsEditingText] = useState(false);

    const [zoom, setZoom] = useState(ZOOM_DEFAULT_PX_PER_SEC);


    const lastTickRef = React.useRef(0);

    const setCurrentMsSafe = React.useCallback(
        (ms: number) => setCurrentMs(clamp(ms, 0, videoDurationMs)),
        [videoDurationMs]
    );

    // Use this instead of setCurrentMsSafe INSIDE the video tick when playing
    // TODO: REMOVE
    const setCurrentMsThrottled = React.useCallback((ms: number) => {
        if (!DIAG_ENABLE) return setCurrentMsSafe(ms);
        const now = performance.now();
        const minDelta = 1000 / DIAG_THROTTLE_FPS; // e.g., ~66ms for 15fps
        if (now - lastTickRef.current >= minDelta) {
            lastTickRef.current = now;
            setCurrentMsSafe(ms);
        }
    }, [setCurrentMsSafe]);

    React.useEffect(() => {
        setCurrentMsSafe(currentMs);
    }, [videoDurationMs]); // eslint-disable-line react-hooks/exhaustive-deps

    // Spacebar handled here so we can toggle play/pause
    React.useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (isEditingText) return;
            if (e.code === 'Space') {
                e.preventDefault();
                setPlaying(p => !p);
            }
        };
        window.addEventListener("keydown", onKey, { passive: false });
        return () => window.removeEventListener("keydown", onKey);
    }, [isEditingText]);

    const onVideoFile = (file: File) => {
        if (videoUrl) URL.revokeObjectURL(videoUrl);
        const url = URL.createObjectURL(file);
        setVideoUrl(url);
        // We’ll capture duration after the user hits play or metadata loads via a hidden probe:
        // Simpler approach: let Video element inform duration via onloadedmetadata (below)
    };

    // safe external seek: clamp + mark as explicit seek
    const externalSeek = React.useCallback((ms: number) => {
        if (DIAG_ENABLE) console.log("[SEEK:explicit]", ms);
        setCurrentMsSafe(ms);
        setSeekNonce(n => n + 1);
    }, [setCurrentMsSafe]);

    const selectedSubtitle = React.useMemo(
        () => subtitles.find(s => s.id === selectedId) ?? null,
        [subtitles, selectedId]
    );

    // Hack: create a hidden video to detect duration on first load (so timeline knows exact length)
    React.useEffect(() => {
        if (!videoUrl) { setVideoDurationMs(0); return; }
        const v = document.createElement('video');
        v.src = videoUrl;
        const handler = () => {
            setVideoDurationMs(Math.round(v.duration * 1000));
            v.removeEventListener('loadedmetadata', handler);
        };
        v.addEventListener('loadedmetadata', handler);
    }, [videoUrl]);

    const exportSrt = React.useCallback(() => {
        if (!subtitles.length) return;
        const srt = toSRT(subtitles, videoDurationMs); // pass duration to clamp/normalize
        const blob = new Blob([srt], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "subtitles.srt";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }, [subtitles, videoDurationMs]);


    const onSrtFile = async (file: File) => {
        const text = await file.text();
        const parsed = parseSRT(text);
        setSubtitles(parsed);
        setSelectedId(parsed[0]?.id ?? null);
    };

    const createBlockAt = useCallback((ms: number) => {
        if (!videoDurationMs) return;
        const startMs = clamp(ms, 0, Math.max(0, videoDurationMs - DEFAULT_BLOCK_MS));
        const endMs = clamp(startMs + DEFAULT_BLOCK_MS, startMs + 50, videoDurationMs);
        const s: Subtitle = {
            id: crypto.randomUUID(),
            startMs,
            endMs,
            text: "New subtitle",
        };
        const updated = [...subtitles, s].sort((a, b) => a.startMs - b.startMs);
        setSubtitles(updated);
        setSelectedId(s.id);
    }, [subtitles, videoDurationMs]);

    // Remove currently selected block, pick a sensible next selection, and clamp playhead
    const deleteSelected = React.useCallback(() => {
        if (!selectedId) return;

        // always work off a sorted snapshot for adjacency
        const sorted = [...subtitles].sort((a, b) => a.startMs - b.startMs);
        const idx = sorted.findIndex(s => s.id === selectedId);
        if (idx === -1) return;

        const nextCandidate = sorted[idx + 1] ?? sorted[idx - 1] ?? null;

        // remove
        setSubtitles(prev => prev.filter(s => s.id !== selectedId));

        // update selection
        setSelectedId(nextCandidate ? nextCandidate.id : null);

        // close the text editor if it was open
        setIsEditingText(false);

        // move playhead to the new selection start (or clamp where it is)
        if (nextCandidate) {
            setCurrentMsSafe(nextCandidate.startMs);
        } else {
            setCurrentMsSafe(clamp(currentMs, 0, videoDurationMs));
        }
    }, [
        selectedId,
        subtitles,
        setSubtitles,
        setSelectedId,
        setIsEditingText,
        setCurrentMsSafe,
        currentMs,
        videoDurationMs
    ]);


    // const onJumpToBlock = (id: string) => {
    //     const s = subtitles.find(x => x.id === id);
    //     if (!s) return;
    //     setCurrentMs(s.startMs);
    // };

    const onJumpToBlock = (id: string) => {
        const s = subtitles.find(x => x.id === id);
        if (!s) return;
        externalSeek(s.startMs);
    };

    // Active subtitle for overlay (computed here for clarity; also computed in VideoPlayer)
    const active = useMemo(
        () => subtitles.find(s => currentMs >= s.startMs && currentMs <= s.endMs),
        [subtitles, currentMs]
    );

    return (
        <div className="min-h-screen bg-neutral-950 text-neutral-100">
            <TopBar
                onVideoFile={onVideoFile}
                onSrtFile={onSrtFile}
                zoom={zoom}
                setZoom={setZoom}
            />

            <main className="max-w-6xl mx-auto p-4 space-y-4">
                <VideoPlayer
                    src={videoUrl}
                    playing={playing}
                    setPlaying={setPlaying}
                    currentMs={currentMs}
                    durationMs={videoDurationMs}
                    setCurrentMs={setCurrentMsSafe}
                    setCurrentMsThrottled={setCurrentMsThrottled}  // for playback-driven ticks
                    subtitles={subtitles}
                    onDuration={(ms) => setVideoDurationMs(ms)}
                    seekNonce={seekNonce}
                />


                <Timeline
                    durationMs={videoDurationMs}
                    currentMs={currentMs}
                    setCurrentMs={setCurrentMsSafe}
                    onExternalSeek={externalSeek}
                    pxPerSec={zoom}
                    subtitles={subtitles}
                    setSubtitles={setSubtitles}
                    selectedId={selectedId}
                    setSelectedId={setSelectedId}
                    isEditingText={isEditingText}
                    setIsEditingText={setIsEditingText}
                    onCreateAt={createBlockAt}
                    onJumpToBlock={onJumpToBlock}
                    onDeleteSelected={deleteSelected}
                />

                {/* Controls row: Play/Pause + current time indicator */}
                <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                        <button
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm"
                            onClick={() => setPlaying(p => !p)}
                        >
                            {playing ? 'Pause (Space)' : 'Play (Space)'}
                        </button>
                        <button
                            className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-sm"
                            onClick={() => createBlockAt(currentMs)}
                        >
                            + Add Block (at playhead)
                        </button>
                        {/* NEW: Delete Selected */}
                        <button
                            className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                            onClick={deleteSelected}
                            disabled={!selectedId}
                            title={selectedId ? "Delete the selected subtitle" : "Select a subtitle first"}>
                            Delete Selected
                        </button>
                        <button
                            className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={exportSrt}
                            disabled={!subtitles.length}
                        >
                            Export .srt
                        </button>

                    </div>
                    <div className="text-sm text-neutral-400">
                        {active ? <span>Editing: <span className="text-neutral-200">{active.text.slice(0, 40)}</span></span> : <span>No active subtitle</span>}
                    </div>
                </div>

                {/* NEW: Separate text editor */}
                {isEditingText && (
                    <SubtitleEditor
                        subtitle={selectedSubtitle}
                        onSaveAndClose={(newText) => {
                            if (selectedSubtitle) {
                                setSubtitles(subtitles.map(s => s.id === selectedSubtitle.id ? { ...s, text: newText } : s));
                            }
                            setIsEditingText(false);
                        }}
                    />
                )}

                <div className="text-xs text-neutral-500">
                    Keyboard editing is disabled while you’re editing a subtitle’s text (Esc to save and exit).
                </div>
            </main>
        </div>
    );
}
