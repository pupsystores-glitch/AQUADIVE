// Pure presentation constants (docs/06_ENGINE_ARCHITECTURE.md §4 constants
// ownership: presentation values move under src/rendering). Byte-identical
// to their previous homes in src/game/config.ts and src/game/constants.ts
// (Sprint 3, Commit E2). Background palette colors moved to theme.ts, the
// white-label boundary, in the same commit.

/** Device pixel ratio cap for the canvas backing store. */
export const MAX_DPR = 2;

/** Anchor's fixed vertical position on screen (fraction of canvas height). */
export const ANCHOR_SCREEN_Y_FRAC = 0.55;

/** Drawn height of the anchor sprite on screen (px). */
export const ANCHOR_DRAW_H = 155;

/** Ring center vertical position within the anchor sprite (fraction of image height). */
export const ANCHOR_RING_Y_FRAC = 0.135;

/** Ship-impact jackpot FX lifetime (seconds); pairs with SHIP_IMPACT_TO_CHESTS_MS. */
export const SHIP_IMPACT_FX_SECONDS = 1.4;
