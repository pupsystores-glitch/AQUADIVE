// Environment layer — light rays + ambient bubbles (Sprint 2, Commit R3;
// docs/05_RENDERING_ARCHITECTURE.md §5 layer 2, §7, §11). Body moved
// verbatim from the component's drawScene; the animation clock arrives as
// `time.animTime` (formerly swayRef.current). The `screen` composite mode
// stays inside its own save/restore, exactly as before.

import type { RenderLayer } from "../render-state";

export const environmentLayer: RenderLayer = {
  name: "environment",
  render(ctx, state, camera, time) {
    const { w, h } = camera.viewport;

    // Light rays from surface (fade with depth)
    const rayAlpha = (1 - state.depthRatio) * 0.18;
    if (rayAlpha > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      for (let i = 0; i < 4; i++) {
        const x = (w * (i + 0.5)) / 4 + Math.sin(time.animTime * 0.4 + i) * 14;
        const g = ctx.createLinearGradient(x, 0, x, h * 0.7);
        g.addColorStop(0, `rgba(180,220,255,${rayAlpha})`);
        g.addColorStop(1, "rgba(180,220,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x - 30, 0);
        ctx.lineTo(x + 30, 0);
        ctx.lineTo(x + 80, h * 0.7);
        ctx.lineTo(x - 80, h * 0.7);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // Particles / bubbles
    const bubbleSeed = time.animTime;
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    for (let i = 0; i < 24; i++) {
      const bx = (i * 73 + bubbleSeed * 12) % w;
      const by = h - ((i * 41 + bubbleSeed * 60) % h);
      const br = 1 + ((i * 17) % 3);
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    }
  },
};
