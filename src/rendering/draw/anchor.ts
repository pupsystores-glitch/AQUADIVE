// Anchor draw module — moved verbatim from the game component
// (Sprint 2, Commit R1). Colors reference theme tokens with byte-identical
// values; geometry and animation math are unchanged.
//
// Since Commit R4 the sprite arrives as an AssetManager handle
// (docs/05_RENDERING_ARCHITECTURE.md §9, §15): the blit happens only when
// the handle reports ready, preserving the previous "draw nothing until
// loaded" behavior.

import type { AssetHandle } from "../assets";
import { ANCHOR_THEME } from "../theme";

export function drawAnchor(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  swayAngle: number,
  crashed: boolean,
  boost: number,
  drawH: number,
  anchor: AssetHandle,
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(swayAngle);

  // Soft warm halo, brighter when boosted
  const haloAlpha = 0.16 + boost * 0.5;
  const halo = ctx.createRadialGradient(0, 4, 4, 0, 4, drawH * 0.55);
  halo.addColorStop(0, ANCHOR_THEME.halo(haloAlpha));
  halo.addColorStop(1, ANCHOR_THEME.haloEdge);
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 4, drawH * 0.55, 0, Math.PI * 2);
  ctx.fill();

  if (boost > 0.05) {
    ctx.shadowColor = ANCHOR_THEME.boostGlow;
    ctx.shadowBlur = 28 * boost;
  }

  const img = anchor.ready ? anchor.image : null;
  if (img) {
    const aspect = img.naturalWidth / img.naturalHeight;
    const drawW = drawH * aspect;
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
  }

  if (crashed) {
    ctx.strokeStyle = ANCHOR_THEME.crashCrack;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-12, -drawH * 0.15);
    ctx.lineTo(4, -drawH * 0.02);
    ctx.lineTo(-6, drawH * 0.08);
    ctx.lineTo(10, drawH * 0.22);
    ctx.stroke();
  }

  ctx.restore();
}
