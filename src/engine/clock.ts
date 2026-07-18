// Fixed tick model constants (docs/06_ENGINE_ARCHITECTURE.md §7). Moved
// out of game-engine.ts in E4 so the state machine can quantize its timers
// to whole ticks without importing the facade.

/** Fixed simulation tick length (§7: 60 Hz). */
export const TICK_SECONDS = 1 / 60;

/**
 * Catch-up cap per advance (§7): at most 3 ticks (= 0.05 s) are consumed
 * per call — the direct translation of the old per-frame
 * MAX_TICK_SECONDS = 0.05 clamp.
 */
export const MAX_TICKS_PER_ADVANCE = 3;
