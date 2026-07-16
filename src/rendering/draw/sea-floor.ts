// Sea floor + shipwreck + treasure draw module — moved verbatim from the
// game component (Sprint 2, Commit R1). Colors reference theme tokens with
// byte-identical values; geometry and animation math are unchanged.

import { SEA_FLOOR_THEME, TREASURE_THEME } from "../theme";

export function drawSeaFloor(ctx: CanvasRenderingContext2D, w: number, h: number, floorY: number) {
  ctx.save();

  // Murky sand gradient
  const grd = ctx.createLinearGradient(0, floorY - 60, 0, h);
  grd.addColorStop(0, SEA_FLOOR_THEME.sandTop);
  grd.addColorStop(0.4, SEA_FLOOR_THEME.sandMid);
  grd.addColorStop(1, SEA_FLOOR_THEME.sandBottom);
  ctx.fillStyle = grd;
  ctx.fillRect(0, floorY - 60, w, h - (floorY - 60));

  // Sand mounds
  ctx.fillStyle = SEA_FLOOR_THEME.mounds;
  ctx.beginPath();
  ctx.moveTo(0, floorY + 6);
  for (let x = 0; x <= w; x += 24) {
    const yy = floorY + 6 + Math.sin(x * 0.05) * 5 - (x > w * 0.3 && x < w * 0.75 ? 8 : 0);
    ctx.lineTo(x, yy);
  }
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  // --- SUNKEN SHIPWRECK — tilted, broken hull ---
  const shipCx = w * 0.52;
  const shipCy = floorY - 6;
  ctx.save();
  ctx.translate(shipCx, shipCy);
  ctx.rotate(-0.18); // tilted to port

  // Hull shadow beneath
  ctx.fillStyle = SEA_FLOOR_THEME.wreckShadow;
  ctx.beginPath();
  ctx.ellipse(0, 30, 120, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Main hull — dark weathered wood
  const hullGrd = ctx.createLinearGradient(0, -30, 0, 30);
  hullGrd.addColorStop(0, SEA_FLOOR_THEME.wreckHullTop);
  hullGrd.addColorStop(0.6, SEA_FLOOR_THEME.wreckHullMid);
  hullGrd.addColorStop(1, SEA_FLOOR_THEME.wreckHullBottom);
  ctx.fillStyle = hullGrd;
  ctx.strokeStyle = SEA_FLOOR_THEME.wreckHullStroke;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-115, -6);
  ctx.quadraticCurveTo(-120, 24, -80, 30);
  ctx.lineTo(70, 30);
  ctx.quadraticCurveTo(115, 26, 110, -4);
  // broken deck line on top — jagged
  ctx.lineTo(80, -8);
  ctx.lineTo(60, -22);
  ctx.lineTo(40, -10);
  ctx.lineTo(20, -18);
  ctx.lineTo(-10, -6);
  ctx.lineTo(-30, -20);
  ctx.lineTo(-55, -8);
  ctx.lineTo(-80, -18);
  ctx.lineTo(-100, -4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Plank seams
  ctx.strokeStyle = SEA_FLOOR_THEME.wreckPlankSeam;
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const y = -2 + i * 9;
    ctx.beginPath();
    ctx.moveTo(-110, y);
    ctx.quadraticCurveTo(0, y + 4, 105, y);
    ctx.stroke();
  }

  // Portholes (glowing faint)
  for (const [px, py] of [
    [-70, 8],
    [-40, 8],
    [-10, 10],
    [30, 8],
    [60, 10],
  ] as const) {
    ctx.fillStyle = SEA_FLOOR_THEME.portholeFill;
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = SEA_FLOOR_THEME.portholeRim;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = SEA_FLOOR_THEME.portholeGlow;
    ctx.beginPath();
    ctx.arc(px, py, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Broken mast — snapped, leaning
  ctx.strokeStyle = SEA_FLOOR_THEME.brokenMast;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-20, -18);
  ctx.lineTo(-55, -70);
  ctx.stroke();
  // Torn sail rag
  ctx.fillStyle = SEA_FLOOR_THEME.sailRag;
  ctx.beginPath();
  ctx.moveTo(-55, -70);
  ctx.quadraticCurveTo(-30, -55, -40, -40);
  ctx.quadraticCurveTo(-52, -50, -55, -70);
  ctx.closePath();
  ctx.fill();

  // Bowsprit
  ctx.strokeStyle = SEA_FLOOR_THEME.bowsprit;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(105, -4);
  ctx.lineTo(135, -14);
  ctx.stroke();

  // Hole in hull (dark cavity)
  ctx.fillStyle = SEA_FLOOR_THEME.hullHole;
  ctx.beginPath();
  ctx.ellipse(15, 12, 14, 8, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // Algae fringe on top
  ctx.strokeStyle = SEA_FLOOR_THEME.algae;
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 12; i++) {
    const ax = -100 + i * 18;
    ctx.beginPath();
    ctx.moveTo(ax, -8);
    ctx.quadraticCurveTo(ax + 3, -18, ax + (i % 2 ? 5 : -3), -26 - (i % 3) * 4);
    ctx.stroke();
  }

  ctx.restore();

  // --- SCATTERED TREASURE around the wreck ---
  const treasure: [number, number, "chest" | "coin" | "gem" | "goblet"][] = [
    [w * 0.18, floorY + 8, "chest"],
    [w * 0.28, floorY + 14, "coin"],
    [w * 0.32, floorY + 10, "coin"],
    [w * 0.36, floorY + 16, "gem"],
    [w * 0.72, floorY + 10, "chest"],
    [w * 0.78, floorY + 16, "coin"],
    [w * 0.83, floorY + 12, "goblet"],
    [w * 0.88, floorY + 18, "coin"],
    [w * 0.24, floorY + 22, "coin"],
    [w * 0.68, floorY + 22, "gem"],
  ];
  for (const [tx, ty, kind] of treasure) {
    drawTreasure(ctx, tx, ty, kind);
  }

  ctx.restore();
}

function drawTreasure(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  kind: "chest" | "coin" | "gem" | "goblet",
) {
  ctx.save();
  ctx.translate(x, y);
  if (kind === "chest") {
    // Open treasure chest spilling gold
    ctx.fillStyle = TREASURE_THEME.chestBody;
    ctx.strokeStyle = TREASURE_THEME.chestOutline;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(-14, -6, 28, 12);
    ctx.fill();
    ctx.stroke();
    // Open lid (tilted back)
    ctx.fillStyle = TREASURE_THEME.chestLid;
    ctx.beginPath();
    ctx.moveTo(-14, -6);
    ctx.lineTo(-16, -18);
    ctx.lineTo(14, -18);
    ctx.lineTo(14, -6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Gold bands
    ctx.strokeStyle = TREASURE_THEME.chestBand;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-14, -2);
    ctx.lineTo(14, -2);
    ctx.stroke();
    // Spilling coins
    ctx.fillStyle = TREASURE_THEME.chestCoins;
    for (const [cx, cy] of [
      [-2, -2],
      [4, -1],
      [-6, 1],
      [8, 2],
      [0, 3],
      [-10, 4],
    ] as const) {
      ctx.beginPath();
      ctx.arc(cx, cy, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Gem inside
    ctx.fillStyle = TREASURE_THEME.chestGem;
    ctx.beginPath();
    ctx.moveTo(-3, -8);
    ctx.lineTo(0, -12);
    ctx.lineTo(3, -8);
    ctx.lineTo(0, -4);
    ctx.closePath();
    ctx.fill();
  } else if (kind === "coin") {
    ctx.fillStyle = TREASURE_THEME.coin;
    ctx.strokeStyle = TREASURE_THEME.coinEdge;
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 4; i++) {
      const ox = (i - 1.5) * 3;
      const oy = -i * 0.4;
      ctx.beginPath();
      ctx.ellipse(ox, oy, 3, 1.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    // Top coin highlight
    ctx.fillStyle = TREASURE_THEME.coinHighlight;
    ctx.beginPath();
    ctx.ellipse(-4.5, -1.6, 1.2, 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "gem") {
    ctx.fillStyle = TREASURE_THEME.gem;
    ctx.strokeStyle = TREASURE_THEME.gemEdge;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(0, -6);
    ctx.lineTo(4, 0);
    ctx.lineTo(0, 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = TREASURE_THEME.gemShine;
    ctx.beginPath();
    ctx.moveTo(-1.5, -2);
    ctx.lineTo(0, -5);
    ctx.lineTo(1, -2);
    ctx.closePath();
    ctx.fill();
  } else if (kind === "goblet") {
    ctx.fillStyle = TREASURE_THEME.goblet;
    ctx.strokeStyle = TREASURE_THEME.gobletEdge;
    ctx.lineWidth = 0.8;
    // cup
    ctx.beginPath();
    ctx.moveTo(-4, -8);
    ctx.lineTo(4, -8);
    ctx.lineTo(3, -3);
    ctx.lineTo(-3, -3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // stem
    ctx.fillRect(-0.8, -3, 1.6, 4);
    // base
    ctx.beginPath();
    ctx.ellipse(0, 1, 4, 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}
