// Rendering theme — color tokens for the canvas draw modules.
//
// Extracted verbatim from the draw helpers in the game component
// (Sprint 2, Commit R1). Every value is byte-identical to the prototype.
// This module is the white-label boundary (docs/05_RENDERING_ARCHITECTURE.md §7):
// draw modules take colors from here, never inline.
//
// Alpha-modulated colors (FX fades, boost halo) are exposed as functions
// taking the final per-frame alpha; the alpha math itself stays at the
// call site so the draw code remains verbatim.

// ----- Surface ship (draw/ship.ts) -----

export const SHIP_THEME = {
  waterLine: "rgba(180, 220, 255, 0.5)",
  hullFill: "#2a1a0e",
  hullStroke: "#a47148",
  plankLine: "rgba(164, 113, 72, 0.5)",
  mast: "#7a4b2a",
  sail: "#f3ead4",
  sailorSkin: "#f0c9a0",
  sailorShirt: "#c44b3a",
  sailorHat: "#1a3a6a",
} as const;

// ----- Chain (draw/chain.ts) -----

export const CHAIN_THEME = {
  outerLink: "rgba(32, 38, 46, 0.95)",
  midLink: "rgba(150, 160, 172, 0.95)",
  highlight: "rgba(240, 246, 255, 0.85)",
} as const;

// ----- Anchor (draw/anchor.ts) -----

export const ANCHOR_THEME = {
  halo: (alpha: number) => `rgba(255, 220, 120, ${alpha})`,
  haloEdge: "rgba(255, 220, 120, 0)",
  boostGlow: "rgba(255, 210, 90, 0.95)",
  crashCrack: "rgba(255,80,80,0.95)",
} as const;

// ----- Creatures (draw/creatures.ts) -----

export const CREATURE_THEME = {
  fishSchool: "rgba(180,210,230,0.7)",
  fishSchoolFish: "rgba(180,210,230,0.85)",
  goldfish: "#f4c64a",
  goldfishGlow: "rgba(255,210,90,0.25)",
  octopus: "#7a3b6a",
  octopusEyes: "#fff",
  seahorse: "#e8a657",
  sealionBody: "#6a5a4a",
  sealionEye: "#000",
  sealionFlipper: "#5a4a3a",
  whaleBody: "#3a5a7a",
  whaleBelly: "rgba(220,230,240,0.4)",
  whaleEye: "#000",
  kelp: "rgba(80,140,90,0.7)",
  jellyfishBell: "rgba(220, 170, 230, 0.55)",
  jellyfishInner: "rgba(255, 220, 245, 0.35)",
  jellyfishTentacles: "rgba(220, 170, 230, 0.6)",
  manta: "rgba(40, 60, 90, 0.85)",
  anglerBody: "#1a1820",
  anglerTeeth: "#f0f0f0",
  anglerLureStalk: "#3a3640",
  anglerLureGlow: "rgba(255, 235, 140, 0.95)",
  anglerLureGlowEdge: "rgba(255, 235, 140, 0)",
  anglerLureCore: "#fff4c0",
} as const;

// ----- Sea floor + shipwreck (draw/sea-floor.ts) -----

export const SEA_FLOOR_THEME = {
  sandTop: "rgba(30,26,22,0)",
  sandMid: "rgba(46,38,28,0.85)",
  sandBottom: "rgba(22,18,12,1)",
  mounds: "#3a2e1e",
  wreckShadow: "rgba(0,0,0,0.55)",
  wreckHullTop: "#3a2a1a",
  wreckHullMid: "#241811",
  wreckHullBottom: "#120a06",
  wreckHullStroke: "#0a0604",
  wreckPlankSeam: "rgba(90,60,40,0.35)",
  portholeFill: "#0a0604",
  portholeRim: "#5a4028",
  portholeGlow: "rgba(120, 180, 200, 0.25)",
  brokenMast: "#2a1c10",
  sailRag: "rgba(180,170,140,0.35)",
  bowsprit: "#1a1008",
  hullHole: "#050302",
  algae: "rgba(60,110,70,0.55)",
} as const;

// ----- Treasure props (draw/sea-floor.ts) -----

export const TREASURE_THEME = {
  chestBody: "#3a1f0c",
  chestOutline: "#1a0e06",
  chestLid: "#4a2810",
  chestBand: "#caa238",
  chestCoins: "#f3cf5a",
  chestGem: "#5ad0ff",
  coin: "#caa238",
  coinEdge: "#6e4f15",
  coinHighlight: "#fff1b0",
  gem: "#c93a5a",
  gemEdge: "#5a1020",
  gemShine: "rgba(255,200,220,0.6)",
  goblet: "#caa238",
  gobletEdge: "#6e4f15",
} as const;

// ----- Ship-impact jackpot FX (draw/impact-fx.ts) -----

export const IMPACT_FX_THEME = {
  flashInner: (alpha: number) => `rgba(255, 90, 190, ${alpha})`,
  flashMid: (alpha: number) => `rgba(255, 60, 160, ${alpha})`,
  flashEdge: "rgba(255, 60, 160, 0)",
  bolt: (alpha: number) => `rgba(255, 190, 235, ${alpha})`,
  boltGlow: "rgba(255, 90, 200, 0.95)",
  sparkle: (alpha: number) => `rgba(255, 220, 240, ${alpha})`,
  ring: (alpha: number) => `rgba(255, 120, 210, ${alpha})`,
} as const;

// ----- Scene background palette (layers/background.ts; RGB triplets for lerpColor) -----
// Moved from src/game/constants.ts in Sprint 3, Commit E2 (docs/06 §4:
// presentation constants live under src/rendering; colors belong here, the
// white-label boundary). Values byte-identical.

/** Gradient top color near the surface. */
export const BG_TOP_SURFACE: number[] = [60, 130, 165];

/** Gradient top color in the abyss. */
export const BG_TOP_ABYSS: number[] = [8, 18, 40];

/** Gradient bottom color near the surface. */
export const BG_BOTTOM_SURFACE: number[] = [14, 40, 80];

/** Gradient bottom color in the abyss. */
export const BG_BOTTOM_ABYSS: number[] = [2, 6, 18];
