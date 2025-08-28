export const DEFAULT_BLOCK_MS = 2000;        // default length for new subtitle
export const BLOCK_ADJUST_MS = 500;          // up/down arrows (configurable)
export const SEEK_STEP_MS = 100;             // [ and ] step (configurable)
export const ZOOM_MIN_PX_PER_SEC = 40;
export const ZOOM_MAX_PX_PER_SEC = 400;
export const ZOOM_DEFAULT_PX_PER_SEC = 120;
export const MOVE_BLOCK_STEP_MS = 100; // how much to move a block with RightCtrl+Arrow
// === DIAGNOSTICS ===
export const DIAG_ENABLE = true;                 // flip to quickly enable/disable all diag logging
export const DIAG_THROTTLE_FPS = 15;            // UI update rate for currentMs when playing
export const DIAG_DISABLE_FOLLOW_SCROLL = true; // true = don't auto-scroll timeline to follow playhead
