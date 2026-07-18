// Creature domain data + the depth-banded spawn tables
// (docs/06_ENGINE_ARCHITECTURE.md §9, §10).
//
// The Creature shape and the kind table + attribute rolls are moved verbatim
// from the spawnCreature closure in AbyssAnchor.tsx (Sprint 3, Commit E2).
// Draws come from the injected `world` Rng stream in the exact original
// order — kind, x, worldY, size, phase, dir — because spawn placement is
// outcome-relevant (§11: goldfish → boost → multiplier bonus and descent
// speed), never cosmetic.

import type { CreatureKind } from "@/shared/creatures";
import { CHAIN_MAX_DEPTH } from "@/shared/world";
import type { Rng } from "../rng";

export interface Creature {
  id: number;
  kind: CreatureKind;
  x: number; // 0..1 horizontal position
  worldY: number; // absolute depth (pixels in world space)
  size: number;
  phase: number; // anim offset
  dir: 1 | -1;
  consumed?: boolean;
}

/** Roll a new creature for a spawn trigger at `worldY` (six draws, fixed order). */
export function rollCreature(worldY: number, id: number, rng: Rng): Creature {
  const depthRatio = Math.min(1, worldY / CHAIN_MAX_DEPTH);
  // pick kind based on depth
  const r = rng.next();
  let kind: CreatureKind;
  if (depthRatio < 0.25) {
    kind =
      r < 0.35
        ? "fishSchool"
        : r < 0.55
          ? "seahorse"
          : r < 0.72
            ? "jellyfish"
            : r < 0.88
              ? "kelp"
              : r < 0.96
                ? "fishSchool"
                : "goldfish";
  } else if (depthRatio < 0.6) {
    kind =
      r < 0.25
        ? "fishSchool"
        : r < 0.45
          ? "octopus"
          : r < 0.6
            ? "jellyfish"
            : r < 0.75
              ? "manta"
              : r < 0.88
                ? "sealion"
                : r < 0.96
                  ? "kelp"
                  : "goldfish";
  } else {
    kind =
      r < 0.2
        ? "octopus"
        : r < 0.4
          ? "sealion"
          : r < 0.62
            ? "whale"
            : r < 0.78
              ? "anglerfish"
              : r < 0.9
                ? "manta"
                : r < 0.96
                  ? "jellyfish"
                  : "goldfish";
  }
  return {
    id,
    kind,
    x: 0.1 + rng.next() * 0.8,
    worldY: worldY + 200 + rng.next() * 80,
    size: 0.8 + rng.next() * 0.6,
    phase: rng.next() * Math.PI * 2,
    dir: rng.next() < 0.5 ? 1 : -1,
  };
}
