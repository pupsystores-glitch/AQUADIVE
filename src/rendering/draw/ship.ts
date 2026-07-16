// Surface ship draw module — moved verbatim from the game component
// (Sprint 2, Commit R1). Colors reference theme tokens with byte-identical
// values; geometry and animation math are unchanged.

import { SHIP_THEME } from "../theme";

export function drawShip(ctx: CanvasRenderingContext2D, cx: number, cy: number, t: number) {
  ctx.save();
  // Water surface line
  ctx.strokeStyle = SHIP_THEME.waterLine;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let x = -200; x < 400; x += 8) {
    const y = cy + 20 + Math.sin(t * 1.5 + x * 0.08) * 2;
    if (x === -200) ctx.moveTo(cx + x, y);
    else ctx.lineTo(cx + x, y);
  }
  ctx.stroke();

  // Rocking
  const rock = Math.sin(t * 1.2) * 0.05;
  ctx.translate(cx, cy);
  ctx.rotate(rock);

  // Hull
  ctx.fillStyle = SHIP_THEME.hullFill;
  ctx.strokeStyle = SHIP_THEME.hullStroke;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-46, 0);
  ctx.lineTo(46, 0);
  ctx.lineTo(34, 18);
  ctx.lineTo(-34, 18);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Plank line
  ctx.strokeStyle = SHIP_THEME.plankLine;
  ctx.beginPath();
  ctx.moveTo(-40, 8);
  ctx.lineTo(40, 8);
  ctx.stroke();

  // Mast
  ctx.strokeStyle = SHIP_THEME.mast;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -36);
  ctx.stroke();
  // Sail
  ctx.fillStyle = SHIP_THEME.sail;
  ctx.beginPath();
  ctx.moveTo(2, -34);
  ctx.quadraticCurveTo(24, -22, 2, -8);
  ctx.closePath();
  ctx.fill();

  // Sailor (boy)
  ctx.fillStyle = SHIP_THEME.sailorSkin;
  ctx.beginPath();
  ctx.arc(-18, -8, 3.5, 0, Math.PI * 2); // head
  ctx.fill();
  ctx.fillStyle = SHIP_THEME.sailorShirt; // red shirt
  ctx.fillRect(-21, -4, 6, 6);
  // Arm wave
  ctx.strokeStyle = SHIP_THEME.sailorSkin;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-18, -2);
  ctx.lineTo(-18 + Math.cos(t * 3) * 4, -6 + Math.sin(t * 3) * 2);
  ctx.stroke();
  // Hat
  ctx.fillStyle = SHIP_THEME.sailorHat;
  ctx.beginPath();
  ctx.ellipse(-18, -11, 4.5, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
