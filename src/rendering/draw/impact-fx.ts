// Ship-impact jackpot FX draw module — moved verbatim from the game
// component (Sprint 2, Commit R1). Colors reference theme tokens with
// byte-identical values; geometry, RNG jitter and animation math are
// unchanged. Per docs/05_RENDERING_ARCHITECTURE.md §12 this module is
// exempt from the no-RNG rule. Since the Commit R5 timing handoff the
// module holds no timing knowledge: `dt` (elapsed seconds) and `life`
// (0..1 of the FX lifetime) both arrive as parameters — the lifetime
// constant lives with the Effects layer (§12 timing contract).

import { IMPACT_FX_THEME } from "../theme";

export function drawShipImpact(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  dt: number,
  life: number,
) {
  const alpha = 1 - life;
  ctx.save();

  // Pink jackpot flash overlay
  const flash = ctx.createRadialGradient(cx, cy, 10, cx, cy, Math.max(w, h) * 0.9);
  flash.addColorStop(0, IMPACT_FX_THEME.flashInner(0.55 * alpha));
  flash.addColorStop(0.35, IMPACT_FX_THEME.flashMid(0.22 * alpha));
  flash.addColorStop(1, IMPACT_FX_THEME.flashEdge);
  ctx.fillStyle = flash;
  ctx.fillRect(0, 0, w, h);

  // Radiating pink lightning bolts
  ctx.strokeStyle = IMPACT_FX_THEME.bolt(0.95 * alpha);
  ctx.lineWidth = 2.4;
  ctx.shadowColor = IMPACT_FX_THEME.boltGlow;
  ctx.shadowBlur = 18;
  const bolts = 10;
  for (let i = 0; i < bolts; i++) {
    const angle = (i / bolts) * Math.PI * 2 + dt * 1.6;
    const reach = 70 + life * 220 + (i % 3) * 20;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    let x = cx;
    let y = cy;
    const steps = 5;
    for (let s = 1; s <= steps; s++) {
      const rr = (reach * s) / steps;
      const jitter = (Math.random() - 0.5) * 18;
      x = cx + Math.cos(angle) * rr + Math.sin(angle * 2) * jitter;
      y = cy + Math.sin(angle) * rr + Math.cos(angle * 2) * jitter;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Sparkle particles
  ctx.fillStyle = IMPACT_FX_THEME.sparkle(0.9 * alpha);
  for (let i = 0; i < 24; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 20 + Math.random() * (60 + life * 180);
    const sx = cx + Math.cos(a) * r;
    const sy = cy + Math.sin(a) * r;
    ctx.beginPath();
    ctx.arc(sx, sy, 1 + Math.random() * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // JACKPOT ring pulse
  ctx.strokeStyle = IMPACT_FX_THEME.ring(0.8 * alpha);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, 30 + life * 180, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}
