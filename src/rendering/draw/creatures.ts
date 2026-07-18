// Creature draw module — moved verbatim from the game component
// (Sprint 2, Commit R1). Colors reference theme tokens with byte-identical
// values; geometry and animation math are unchanged.

import type { CreatureKind } from "@/shared/creatures";
import { CREATURE_THEME } from "../theme";

export function drawCreature(
  ctx: CanvasRenderingContext2D,
  kind: CreatureKind,
  x: number,
  y: number,
  size: number,
  t: number,
  consumed: boolean,
) {
  if (consumed) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, size);
  ctx.globalAlpha = 0.85;
  switch (kind) {
    case "fishSchool":
      ctx.fillStyle = CREATURE_THEME.fishSchool;
      for (let i = 0; i < 5; i++) {
        const fx = (i - 2) * 9;
        const fy = Math.sin(t * 2 + i) * 3;
        drawFish(ctx, fx, fy, 6, CREATURE_THEME.fishSchoolFish);
      }
      break;
    case "goldfish":
      drawFish(ctx, 0, Math.sin(t * 3) * 2, 9, CREATURE_THEME.goldfish);
      ctx.fillStyle = CREATURE_THEME.goldfishGlow;
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "octopus": {
      ctx.fillStyle = CREATURE_THEME.octopus;
      ctx.beginPath();
      ctx.ellipse(0, -2, 10, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      // tentacles
      ctx.strokeStyle = CREATURE_THEME.octopus;
      ctx.lineWidth = 2;
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 2.5, 4);
        ctx.quadraticCurveTo(i * 4, 10 + Math.sin(t * 2 + i) * 2, i * 5, 16);
        ctx.stroke();
      }
      // eyes
      ctx.fillStyle = CREATURE_THEME.octopusEyes;
      ctx.fillRect(-4, -4, 2, 2);
      ctx.fillRect(2, -4, 2, 2);
      break;
    }
    case "seahorse":
      ctx.strokeStyle = CREATURE_THEME.seahorse;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.quadraticCurveTo(6, -4, 0, 2);
      ctx.quadraticCurveTo(-6, 8, 0, 14);
      ctx.stroke();
      ctx.fillStyle = CREATURE_THEME.seahorse;
      ctx.beginPath();
      ctx.arc(0, -12, 3, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "sealion": {
      ctx.fillStyle = CREATURE_THEME.sealionBody;
      ctx.beginPath();
      ctx.ellipse(0, 0, 18, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(14, -4, 6, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = CREATURE_THEME.sealionEye;
      ctx.fillRect(16, -5, 1.5, 1.5);
      // flippers
      ctx.fillStyle = CREATURE_THEME.sealionFlipper;
      ctx.beginPath();
      ctx.ellipse(-6, 6 + Math.sin(t * 3) * 1, 6, 2, 0.3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "whale": {
      ctx.fillStyle = CREATURE_THEME.whaleBody;
      ctx.beginPath();
      ctx.ellipse(0, 0, 30, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      // tail
      ctx.beginPath();
      ctx.moveTo(-28, 0);
      ctx.lineTo(-38, -8);
      ctx.lineTo(-38, 8);
      ctx.closePath();
      ctx.fill();
      // belly
      ctx.fillStyle = CREATURE_THEME.whaleBelly;
      ctx.beginPath();
      ctx.ellipse(0, 4, 24, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      // eye
      ctx.fillStyle = CREATURE_THEME.whaleEye;
      ctx.beginPath();
      ctx.arc(20, -2, 1.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "kelp": {
      ctx.strokeStyle = CREATURE_THEME.kelp;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 30);
      for (let i = 0; i <= 8; i++) {
        const yy = 30 - i * 8;
        const xx = Math.sin(t * 1.2 + i * 0.5) * 6;
        ctx.lineTo(xx, yy);
      }
      ctx.stroke();
      break;
    }
    case "jellyfish": {
      const pulse = 1 + Math.sin(t * 2.2) * 0.12;
      ctx.fillStyle = CREATURE_THEME.jellyfishBell;
      ctx.beginPath();
      ctx.ellipse(0, -2, 10 * pulse, 7 * pulse, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = CREATURE_THEME.jellyfishInner;
      ctx.beginPath();
      ctx.ellipse(0, -2, 10 * pulse, 7 * pulse, 0, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = CREATURE_THEME.jellyfishTentacles;
      ctx.lineWidth = 1.2;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 3, -2);
        ctx.quadraticCurveTo(
          i * 3 + Math.sin(t * 2 + i) * 3,
          6,
          i * 3 + Math.sin(t * 1.5 + i) * 4,
          16,
        );
        ctx.stroke();
      }
      break;
    }
    case "manta": {
      ctx.fillStyle = CREATURE_THEME.manta;
      const flap = Math.sin(t * 1.6) * 4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-18, -8 - flap, -30, 2);
      ctx.quadraticCurveTo(-16, 6, 0, 6);
      ctx.quadraticCurveTo(16, 6, 30, 2);
      ctx.quadraticCurveTo(18, -8 - flap, 0, 0);
      ctx.closePath();
      ctx.fill();
      // tail
      ctx.strokeStyle = CREATURE_THEME.manta;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(0, 4);
      ctx.lineTo(0, 16);
      ctx.stroke();
      break;
    }
    case "anglerfish": {
      ctx.fillStyle = CREATURE_THEME.anglerBody;
      ctx.beginPath();
      ctx.ellipse(0, 0, 12, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      // tail
      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.lineTo(-18, -5);
      ctx.lineTo(-18, 5);
      ctx.closePath();
      ctx.fill();
      // teeth
      ctx.strokeStyle = CREATURE_THEME.anglerTeeth;
      ctx.lineWidth = 0.8;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(6 + i * 1.5, 2);
        ctx.lineTo(6 + i * 1.5, 4);
        ctx.stroke();
      }
      // lure stalk
      ctx.strokeStyle = CREATURE_THEME.anglerLureStalk;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(4, -6);
      ctx.quadraticCurveTo(8, -14, 12 + Math.sin(t * 2) * 1.5, -16);
      ctx.stroke();
      // glowing lure
      const glow = ctx.createRadialGradient(12, -16, 0, 12, -16, 8);
      glow.addColorStop(0, CREATURE_THEME.anglerLureGlow);
      glow.addColorStop(1, CREATURE_THEME.anglerLureGlowEdge);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(12, -16, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = CREATURE_THEME.anglerLureCore;
      ctx.beginPath();
      ctx.arc(12, -16, 1.6, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }

  ctx.restore();
}

function drawFish(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, size, size * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-size, 0);
  ctx.lineTo(-size - 4, -3);
  ctx.lineTo(-size - 4, 3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
