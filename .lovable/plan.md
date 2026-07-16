# Polish pass: speed, creatures, anchor & chain

Visual + feel tuning only. No game-logic / payout changes.

## 1. Faster descent
In `src/lib/abyss-game.ts` → `descentSpeed()`:
- Raise base from `28` → ~`70` px/s.
- Raise multiplier-scaled term cap from `160` → ~`320`, and steepen the curve (`Math.pow(m, 0.9) * 18`).
- Keep goldfish boost as a relative multiplier on top so boosts still feel punchy.

Result: anchor visibly cuts through water from the first second, accelerates more aggressively as multiplier climbs (still Aviator-like easing, not jumpy).

## 2. Richer sea life
In `src/components/AbyssAnchor.tsx` creature spawner + renderer:
- Increase spawn density (~1.6–2× current rate), with more variety at each depth band:
  - Surface band: bigger fish schools, seahorses, jellyfish (new), drifting kelp.
  - Mid band: octopus, sea lions, manta ray silhouette (new), bubble plumes.
  - Deep band: whales, anglerfish glow dot (new), more goldfish chance.
- Keep style minimalist flat shapes / silhouettes (Aviator / Burning-Hot vibe) — no detailed illustration, no overcrowding. Background creatures rendered at lower opacity so the anchor stays the focal point.

## 3. More striking anchor
Redraw the anchor on canvas:
- Larger silhouette, classic admiralty shape with a defined stock, curved arms and pointed flukes.
- Two-tone gold: warm gold body + darker gold inner shading + thin highlight stroke on one edge for a metallic read.
- Soft gold glow halo (stronger while boosted, dimmed otherwise).
- Subtle idle bob + slow side-to-side sway preserved (per existing spec).

## 4. Prettier rope / chain
Replace the current single line with tier-specific renderers, all anchored to the ship and following the anchor's sway with a slight catenary curve:
- `rope` (low bet): braided look — two offset sine strands in warm hemp tone with a thin highlight.
- `chain` (mid bet): alternating vertical / horizontal oval links in steel grey with a highlight dot per link.
- `heavy` (high bet): thicker, darker links with a gold sheen and a faint glow, links spaced tighter.

All three sway naturally with the anchor and segment-shorten as the anchor descends off-screen from the ship.

## Out of scope
Crash math, multiplier curve, bonus chest logic, balance / bet UI.
