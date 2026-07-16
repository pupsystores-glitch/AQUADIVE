// Chain draw module — moved verbatim from the game component
// (Sprint 2, Commit R1). Colors reference theme tokens with byte-identical
// values; geometry and animation math are unchanged.

import { CHAIN_THEME } from "../theme";

export function drawChain(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  t: number,
) {
  // A real metallic chain: alternating oriented oval links following a gently
  // sagging path from the surface down to the anchor's shackle ring.
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;

  const pointAt = (u: number) => {
    const sag = Math.sin(u * Math.PI) * 6;
    const wave = Math.sin(u * Math.PI * 2 - t * 1.1) * 1.4 * Math.sin(u * Math.PI);
    const off = sag * Math.sign(dx || 1) * 0.22 + wave;
    return {
      x: x1 + dx * u + nx * off,
      y: y1 + dy * u + ny * off,
    };
  };

  const linkSpacing = 7.2; // px between link centers along the curve
  const count = Math.max(4, Math.floor(len / linkSpacing));

  ctx.save();
  for (let i = 0; i < count; i++) {
    const u = i / (count - 1);
    const p = pointAt(u);
    const p2 = pointAt(Math.min(1, u + 1 / (count * 4)));
    const ang = Math.atan2(p2.y - p.y, p2.x - p.x);
    const perp = (i % 2) * (Math.PI / 2); // alternate link orientation

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(ang + perp);

    // Outer link — dark iron outline
    ctx.strokeStyle = CHAIN_THEME.outerLink;
    ctx.lineWidth = 3.6;
    ctx.beginPath();
    ctx.ellipse(0, 0, 6.2, 3.4, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Mid steel body
    ctx.strokeStyle = CHAIN_THEME.midLink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 6.2, 3.4, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Top highlight for brushed-steel feel
    ctx.strokeStyle = CHAIN_THEME.highlight;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, -0.6, 5.4, 2.7, 0, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();

    ctx.restore();
  }
  ctx.restore();
}
