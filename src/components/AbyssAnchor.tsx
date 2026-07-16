import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type BonusChest,
  type Creature,
  type CreatureKind,
  chainTier,
  descentSpeed,
  formatMultiplier,
  multiplierAt,
  rollBonusChests,
  sampleCrashPoint,
  timeForMultiplier,
  type Phase,
} from "@/lib/abyss-game";
import {
  ANCHOR_DRAW_H,
  ANCHOR_RING_Y_FRAC,
  BETTING_WINDOW_SECONDS,
  CASH_FLASH_MS,
  CHAIN_MAX_DEPTH,
  CHEST_RESULT_TO_IDLE_MS,
  COLLISION_DX_FRAC,
  COLLISION_DY_PX,
  CRASH_BANNER_MS,
  CREATURE_SPAWN_EVERY,
  HISTORY_LIMIT,
  JACKPOT_FLASH_MS,
  QUICK_BETS,
  SHIP_IMPACT_TO_CHESTS_MS,
} from "@/game/config";
import {
  ANCHOR_SCREEN_Y_FRAC,
  ANCHOR_WORLD_OFFSET_PX,
  BG_BOTTOM_ABYSS,
  BG_BOTTOM_SURFACE,
  BG_TOP_ABYSS,
  BG_TOP_SURFACE,
  BOOST_DECAY_PER_SECOND,
  BOOST_GAIN_PER_GOLDFISH,
  BOOST_MULTIPLIER_BONUS,
  BOOST_SPEED_FACTOR,
  COUNTDOWN_TICK_MS,
  DEFAULT_BALANCE,
  DEFAULT_BET,
  DIVE_SPAWN_DEPTH_PX,
  INITIAL_SPAWN_DEPTH_PX,
  MAX_DPR,
  MAX_TICK_SECONDS,
  SHIP_IMPACT_FX_SECONDS,
  SPAWN_AHEAD_PX,
  SPAWN_JITTER_PX,
} from "@/game/constants";
import type { HistoryEntry, LastWin, RunState } from "@/game/types";
import { drawAnchor } from "@/rendering/draw/anchor";
import { drawChain } from "@/rendering/draw/chain";
import { drawCreature } from "@/rendering/draw/creatures";
import { drawShipImpact } from "@/rendering/draw/impact-fx";
import { drawSeaFloor } from "@/rendering/draw/sea-floor";
import { drawShip } from "@/rendering/draw/ship";
import { lerpColor } from "@/shared/utils/color";

export default function AbyssAnchor() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const [balance, setBalance] = useState(DEFAULT_BALANCE);
  const [bet, setBet] = useState(DEFAULT_BET);
  const [phase, setPhase] = useState<Phase>("idle");
  const [multiplier, setMultiplier] = useState(1);
  const [lastWin, setLastWin] = useState<LastWin | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [chests, setChests] = useState<[BonusChest, BonusChest, BonusChest] | null>(null);
  const [chosenChest, setChosenChest] = useState<BonusChest | null>(null);
  const [boost, setBoost] = useState(0); // 0..1 short boost when goldfish
  const [hasCashed, setHasCashed] = useState(false);
  const [cashFlash, setCashFlash] = useState(false);
  const [participating, setParticipating] = useState(false);
  const [countdown, setCountdown] = useState(BETTING_WINDOW_SECONDS);

  const runRef = useRef<RunState | null>(null);
  const phaseRef = useRef<Phase>("idle");
  const worldYRef = useRef(0); // anchor's depth in world px
  const creaturesRef = useRef<Creature[]>([]);
  const nextSpawnAtRef = useRef(INITIAL_SPAWN_DEPTH_PX);
  const nextCreatureId = useRef(1);
  const lastTsRef = useRef<number | null>(null);
  const boostRef = useRef(0);
  const swayRef = useRef(0);
  const hasCashedRef = useRef(false);
  const participatingRef = useRef(false);
  const betRef = useRef(DEFAULT_BET);
  const shipImpactRef = useRef<number | null>(null); // performance.now() when anchor hit ship
  const jackpotMultRef = useRef(1); // multiplier locked at ship impact, used for chest math

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { participatingRef.current = participating; }, [participating]);
  useEffect(() => { betRef.current = bet; }, [bet]);

  // ----- creature spawning -----
  const spawnCreature = useCallback((worldY: number) => {
    const depthRatio = Math.min(1, worldY / CHAIN_MAX_DEPTH);
    // pick kind based on depth
    const r = Math.random();
    let kind: CreatureKind;
    if (depthRatio < 0.25) {
      kind = r < 0.35 ? "fishSchool" : r < 0.55 ? "seahorse" : r < 0.72 ? "jellyfish" : r < 0.88 ? "kelp" : r < 0.96 ? "fishSchool" : "goldfish";
    } else if (depthRatio < 0.6) {
      kind = r < 0.25 ? "fishSchool" : r < 0.45 ? "octopus" : r < 0.6 ? "jellyfish" : r < 0.75 ? "manta" : r < 0.88 ? "sealion" : r < 0.96 ? "kelp" : "goldfish";
    } else {
      kind = r < 0.2 ? "octopus" : r < 0.4 ? "sealion" : r < 0.62 ? "whale" : r < 0.78 ? "anglerfish" : r < 0.9 ? "manta" : r < 0.96 ? "jellyfish" : "goldfish";
    }
    const c: Creature = {
      id: nextCreatureId.current++,
      kind,
      x: 0.1 + Math.random() * 0.8,
      worldY: worldY + 200 + Math.random() * 80,
      size: 0.8 + Math.random() * 0.6,
      phase: Math.random() * Math.PI * 2,
      dir: Math.random() < 0.5 ? 1 : -1,
    };
    creaturesRef.current.push(c);
  }, []);

  // ----- place a bet during the betting window -----
  const placeBet = useCallback(() => {
    if (phaseRef.current !== "idle") return;
    if (participatingRef.current) return;
    const b = betRef.current;
    if (b <= 0 || b > balance) return;
    setBalance((prev) => +(prev - b).toFixed(2));
    setParticipating(true);
  }, [balance]);

  // ----- begin the dive (auto, called by the round timer) -----
  const beginDive = useCallback(() => {
    if (phaseRef.current !== "idle") return;
    const participated = participatingRef.current;
    runRef.current = {
      startedAt: performance.now(),
      crashAt: sampleCrashPoint(),
      bet: participated ? betRef.current : 0,
      bonusTriggered: false,
    };
    worldYRef.current = 0;
    creaturesRef.current = [];
    nextSpawnAtRef.current = DIVE_SPAWN_DEPTH_PX;
    boostRef.current = 0;
    setBoost(0);
    setMultiplier(1);
    setChests(null);
    setChosenChest(null);
    hasCashedRef.current = false;
    setHasCashed(false);
    setCashFlash(false);
    setPhase("diving");
  }, []);

  // ----- auto-round countdown while idle (5s betting window) -----
  useEffect(() => {
    if (phase !== "idle") return;
    const startedAt = performance.now();
    setCountdown(BETTING_WINDOW_SECONDS);
    const iv = window.setInterval(() => {
      const rem = BETTING_WINDOW_SECONDS - (performance.now() - startedAt) / 1000;
      if (rem <= 0) {
        window.clearInterval(iv);
        setCountdown(0);
        beginDive();
      } else {
        setCountdown(rem);
      }
    }, COUNTDOWN_TICK_MS);
    return () => window.clearInterval(iv);
  }, [phase, beginDive]);

  // ----- cashout (money is locked in, but anchor keeps descending) -----
  const cashOut = useCallback(() => {
    if (phaseRef.current !== "diving") return;
    if (!participatingRef.current) return;
    if (hasCashedRef.current) return;
    const run = runRef.current;
    if (!run) return;
    const m = multiplier;
    const win = +(run.bet * m).toFixed(2);
    setBalance((b) => +(b + win).toFixed(2));
    setLastWin({ amount: win, mult: m });
    setHistory((h) => [{ mult: m, crashed: false }, ...h].slice(0, HISTORY_LIMIT));
    hasCashedRef.current = true;
    setHasCashed(true);
    setCashFlash(true);
    setTimeout(() => setCashFlash(false), CASH_FLASH_MS);
    // stay in "diving" — anchor continues until the chain snaps.
  }, [multiplier]);

  // ----- chest pick — multiplies the jackpot multiplier locked at ship impact -----
  const pickChest = useCallback((id: 0 | 1 | 2) => {
    if (!chests || phaseRef.current !== "bonus") return;
    const picked = { ...chests[id], opened: true };
    setChosenChest(picked);
    const run = runRef.current;
    const jackpot = jackpotMultRef.current || multiplier;
    const finalMult = +(jackpot * picked.multiplier).toFixed(2);
    setMultiplier(finalMult);
    if (run && participatingRef.current) {
      // The previous jackpot win was already credited; add the delta from multiplying it.
      const prevWin = +(run.bet * jackpot).toFixed(2);
      const totalWin = +(run.bet * finalMult).toFixed(2);
      const delta = +(totalWin - prevWin).toFixed(2);
      setBalance((b) => +(b + delta).toFixed(2));
      setLastWin({ amount: totalWin, mult: finalMult });
    }
    setHistory((h) => [{ mult: finalMult, crashed: false }, ...h].slice(0, HISTORY_LIMIT));
    setTimeout(() => setPhase("idle"), CHEST_RESULT_TO_IDLE_MS);
  }, [chests, multiplier]);

  // reset per-round flags whenever we return to the betting window
  useEffect(() => {
    if (phase !== "idle") return;
    setParticipating(false);
    hasCashedRef.current = false;
    setHasCashed(false);
    setCashFlash(false);
  }, [phase]);

  // ----- game loop -----
  useEffect(() => {
    const tick = (ts: number) => {
      const last = lastTsRef.current ?? ts;
      const dt = Math.min(MAX_TICK_SECONDS, (ts - last) / 1000);
      lastTsRef.current = ts;
      swayRef.current += dt;

      if (phaseRef.current === "diving" && runRef.current) {
        const elapsed = (ts - runRef.current.startedAt) / 1000;
        let m = multiplierAt(elapsed);
        // boost decays
        if (boostRef.current > 0) {
          boostRef.current = Math.max(0, boostRef.current - dt * BOOST_DECAY_PER_SECOND);
          m += boostRef.current * BOOST_MULTIPLIER_BONUS; // small bump while active
          setBoost(boostRef.current);
        }

        // crash check
        if (m >= runRef.current.crashAt) {
          m = runRef.current.crashAt;
          setMultiplier(m);
          if (!hasCashedRef.current) {
            setHistory((h) => [{ mult: m, crashed: true }, ...h].slice(0, HISTORY_LIMIT));
          }
          setPhase("crashed");
          setTimeout(() => {
            if (phaseRef.current === "crashed") setPhase("idle");
          }, CRASH_BANNER_MS);
        } else {
          setMultiplier(m);
        }

        // descent
        const speed = descentSpeed(m) * (1 + boostRef.current * BOOST_SPEED_FACTOR);
        worldYRef.current += speed * dt;

        // spawn creatures
        while (worldYRef.current + SPAWN_AHEAD_PX > nextSpawnAtRef.current) {
          spawnCreature(nextSpawnAtRef.current);
          nextSpawnAtRef.current += CREATURE_SPAWN_EVERY - Math.random() * SPAWN_JITTER_PX;
        }

        // collision with goldfish → boost
        const anchorWorldY = worldYRef.current + ANCHOR_WORLD_OFFSET_PX;
        for (const c of creaturesRef.current) {
          if (c.consumed) continue;
          const dy = Math.abs(c.worldY - anchorWorldY);
          if (dy < COLLISION_DY_PX && Math.abs(c.x - 0.5) < COLLISION_DX_FRAC) {
            if (c.kind === "goldfish") {
              c.consumed = true;
              boostRef.current = Math.min(1, boostRef.current + BOOST_GAIN_PER_GOLDFISH);
              setBoost(boostRef.current);
            }
          }
        }

        // Reaching the sea floor → SHIP IMPACT → JACKPOT + chest bonus.
        if (!runRef.current.bonusTriggered && worldYRef.current >= CHAIN_MAX_DEPTH) {
          runRef.current.bonusTriggered = true;
          const jackpot = sampleJackpot();
          jackpotMultRef.current = jackpot;
          shipImpactRef.current = performance.now();
          setMultiplier(jackpot);
          if (participatingRef.current && !hasCashedRef.current) {
            const win = +(runRef.current.bet * jackpot).toFixed(2);
            setBalance((b) => +(b + win).toFixed(2));
            setLastWin({ amount: win, mult: jackpot });
            hasCashedRef.current = true;
            setHasCashed(true);
            setCashFlash(true);
            setTimeout(() => setCashFlash(false), JACKPOT_FLASH_MS);
          }
          setHistory((h) => [{ mult: jackpot, crashed: false }, ...h].slice(0, HISTORY_LIMIT));
          // brief impact frame, then reveal 3 chests to multiply the jackpot
          setPhase("cashed");
          setTimeout(() => {
            if (phaseRef.current === "cashed" || phaseRef.current === "diving") {
              setChests(rollBonusChests());
              setChosenChest(null);
              setPhase("bonus");
            }
          }, SHIP_IMPACT_TO_CHESTS_MS);
        }
      }

      drawScene();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spawnCreature]);

  // ----- drawing -----
  const drawScene = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const worldY = worldYRef.current;
    const depthRatio = Math.min(1, worldY / CHAIN_MAX_DEPTH);

    // Background gradient — shifts darker with depth
    const top = lerpColor(BG_TOP_SURFACE, BG_TOP_ABYSS, depthRatio);
    const bot = lerpColor(BG_BOTTOM_SURFACE, BG_BOTTOM_ABYSS, depthRatio);
    const grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, `rgb(${top.join(",")})`);
    grd.addColorStop(1, `rgb(${bot.join(",")})`);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);

    // Light rays from surface (fade with depth)
    const rayAlpha = (1 - depthRatio) * 0.18;
    if (rayAlpha > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      for (let i = 0; i < 4; i++) {
        const x = (w * (i + 0.5)) / 4 + Math.sin(swayRef.current * 0.4 + i) * 14;
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
    const bubbleSeed = swayRef.current;
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    for (let i = 0; i < 24; i++) {
      const bx = ((i * 73 + bubbleSeed * 12) % w);
      const by = (h - ((i * 41 + bubbleSeed * 60) % h));
      const br = 1 + ((i * 17) % 3);
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    }

    // World camera: anchor is fixed near 55% of screen.
    const anchorScreenY = h * ANCHOR_SCREEN_Y_FRAC;
    const worldToScreen = (wy: number) => anchorScreenY + (wy - (worldY + ANCHOR_WORLD_OFFSET_PX));

    // Draw creatures (behind anchor)
    for (const c of creaturesRef.current) {
      const sy = worldToScreen(c.worldY);
      if (sy < -120 || sy > h + 120) continue;
      const sx = c.x * w + Math.sin(swayRef.current * 0.6 + c.phase) * 12 * c.dir;
      drawCreature(ctx, c.kind, sx, sy, c.size, swayRef.current + c.phase, c.consumed === true);
    }

    // Surface ship (only visible near surface)
    const shipScreenY = worldToScreen(-180);
    if (shipScreenY > -120 && shipScreenY < h + 80) {
      drawShip(ctx, w / 2, shipScreenY, swayRef.current);
    }

    // Sea floor + shipwreck — drawn BEFORE the anchor so the anchor visibly lands on top.
    const floorScreenY = worldToScreen(CHAIN_MAX_DEPTH + ANCHOR_WORLD_OFFSET_PX);
    if (floorScreenY < h + 100) {
      drawSeaFloor(ctx, w, h, floorScreenY);
    }

    // Anchor sway — faster & wider for a more natural pendulum swing.
    const anchorX = w / 2 + Math.sin(swayRef.current * 1.4) * 38 + Math.sin(swayRef.current * 0.7) * 10;
    const swayAngle = Math.sin(swayRef.current * 1.8) * 0.22 + Math.sin(swayRef.current * 0.9) * 0.05;

    // Position the anchor sprite so its horizontal stock bar sits near anchorScreenY.
    const drawH = ANCHOR_DRAW_H;
    const ringOffsetFromCenter = drawH * (0.5 - ANCHOR_RING_Y_FRAC); // ring above sprite center
    // Ring position accounting for rotation around the sprite center.
    const anchorRingY = anchorScreenY - Math.cos(swayAngle) * ringOffsetFromCenter;
    const anchorRingX = anchorX + Math.sin(swayAngle) * ringOffsetFromCenter;
    const ringR = 9;

    // Chain from the surface down to the anchor's shackle ring
    const chainStartY = Math.min(shipScreenY + 40, 0);
    drawChain(ctx, w / 2, chainStartY, anchorRingX, anchorRingY - ringR, swayRef.current);

    // Anchor sprite (in front of shipwreck so it lands ON the ship)
    drawAnchor(ctx, anchorX, anchorScreenY, swayAngle, phaseRef.current === "crashed", boostRef.current, drawH);

    // Ship impact burst — pink jackpot lightning for ~1.4s after hit
    if (shipImpactRef.current != null) {
      const dt = (performance.now() - shipImpactRef.current) / 1000;
      if (dt < SHIP_IMPACT_FX_SECONDS) {
        drawShipImpact(ctx, anchorX, anchorScreenY + drawH * 0.3, w, h, dt);
      } else {
        shipImpactRef.current = null;
      }
    }
  }, [bet]);

  // ----- UI -----
  const inDive = phase === "diving";
  const isIdle = phase === "idle";
  const showCrash = phase === "crashed";
  const showBonus = phase === "bonus";
  const canBet = isIdle && !participating && bet > 0 && bet <= balance && countdown > 0.2;

  const potentialWin = useMemo(() => +(bet * multiplier).toFixed(2), [bet, multiplier]);

  return (
    <div className="relative mx-auto flex h-[100dvh] max-w-md flex-col overflow-hidden bg-background text-foreground">
      {/* TOP BAR */}
      <header className="z-20 flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg border border-gold/40 bg-card text-gold">
            <AnchorIcon className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="text-[10px] tracking-[0.2em] text-muted-foreground">REAL-TIME</div>
            <div className="-mt-0.5 text-sm font-bold tracking-[0.25em] text-gold">AQUADIVE</div>
          </div>
        </div>
        <div className="rounded-full border border-border bg-card/70 px-3 py-1 text-xs">
          <span className="text-muted-foreground">Balance </span>
          <span className="font-semibold text-gold">{balance.toFixed(2)}</span>
        </div>
      </header>

      {/* HISTORY STRIP */}
      <div className="z-20 flex gap-1.5 overflow-x-auto px-4 pb-2">
        {history.length === 0 && (
          <span className="text-[11px] text-muted-foreground/70">No rounds yet</span>
        )}
        {history.map((h, i) => (
          <span
            key={i}
            className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
              h.crashed
                ? "border-danger/30 bg-danger/10 text-danger"
                : "border-success/30 bg-success/10 text-success"
            }`}
          >
            {h.mult.toFixed(2)}×
          </span>
        ))}
      </div>

      {/* CANVAS STAGE */}
      <div className="relative flex-1 overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

        {/* Multiplier overlay */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-start pt-6">
          <div className="text-[10px] uppercase tracking-[0.3em] text-white/60">Multiplier</div>
          <div
            className={`mt-1 text-6xl font-black tabular-nums text-gold multiplier-glow ${
              showCrash ? "crash-shake text-danger" : ""
            }`}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {formatMultiplier(multiplier)}
          </div>
          {inDive && participating && (
            <div className="mt-1 text-xs text-white/70">
              Potential <span className="font-semibold text-gold">{potentialWin.toFixed(2)}</span>
            </div>
          )}
          {inDive && !participating && (
            <div className="mt-1 text-xs text-white/60">Spectating this dive</div>
          )}
          {isIdle && (
            <div className="mt-1 text-xs text-white/70">
              Next dive in <span className="font-semibold text-gold tabular-nums">{countdown.toFixed(1)}s</span>
            </div>
          )}
          {boost > 0.05 && (
            <div className="mt-2 rounded-full border border-gold/50 bg-gold/15 px-2 py-0.5 text-[10px] font-bold tracking-wider text-gold">
              GOLDEN BOOST
            </div>
          )}
        </div>

        {/* Crash banner */}
        {showCrash && (
          <div className="absolute inset-x-0 top-1/2 z-30 -translate-y-1/2 px-6 text-center">
            <div className="mx-auto inline-block rounded-xl border border-danger/40 bg-danger/15 px-6 py-3 backdrop-blur-sm">
              <div className="text-xs tracking-[0.3em] text-danger/90">CHAIN SNAPPED</div>
              <div className="mt-1 text-3xl font-black text-danger">{multiplier.toFixed(2)}×</div>
            </div>
          </div>
        )}

        {/* Cashed banner */}
        {cashFlash && lastWin && (
          <div className="absolute inset-x-0 top-1/2 z-30 -translate-y-1/2 px-6 text-center">
            <div className="mx-auto inline-block rounded-xl border border-success/40 bg-success/15 px-6 py-3 backdrop-blur-sm">
              <div className="text-xs tracking-[0.3em] text-success">CASHED OUT</div>
              <div className="mt-1 text-3xl font-black text-success">
                +{lastWin.amount.toFixed(2)}
              </div>
              <div className="text-xs text-white/70">at {lastWin.mult.toFixed(2)}×</div>
            </div>
          </div>
        )}

        {/* Bonus chests */}
        {showBonus && chests && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-end bg-black/40 pb-8 backdrop-blur-sm">
            <div className="mb-3 text-xs uppercase tracking-[0.3em] text-gold">Pirate Wreck — Pick a Chest</div>
            <div className="flex gap-4 px-6">
              {chests.map((c) => (
                <button
                  key={c.id}
                  onClick={() => pickChest(c.id)}
                  disabled={!!chosenChest}
                  className="group flex h-24 w-20 flex-col items-center justify-end rounded-lg border border-gold/40 bg-gradient-to-b from-[#3a2410] to-[#1a0e06] p-2 transition-transform active:scale-95 disabled:opacity-50"
                >
                  <ChestIcon className="h-10 w-10 text-gold transition-transform group-hover:-translate-y-1" />
                  <div className="mt-1 text-[10px] text-gold/70">
                    {chosenChest?.id === c.id ? `+${c.multiplier.toFixed(2)}×` : "???"}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM CONTROLS */}
      <div className="z-20 border-t border-border bg-card/80 px-4 pt-3 pb-4 backdrop-blur">
        <div className="mb-3 flex items-center gap-2">
          <button
            onClick={() => setBet((b) => Math.max(1, +(b / 2).toFixed(2)))}
            className="h-10 w-10 rounded-md border border-border bg-secondary text-lg font-bold text-foreground active:scale-95 disabled:opacity-50"
            disabled={inDive}
          >−</button>
          <div className="flex flex-1 flex-col items-center rounded-md border border-border bg-secondary py-1">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Bet · {chainTier(bet)}</div>
            <input
              type="number"
              value={bet}
              onChange={(e) => setBet(Math.max(0, +e.target.value))}
              disabled={inDive}
              className="w-full bg-transparent text-center text-lg font-bold tabular-nums text-gold outline-none"
            />
          </div>
          <button
            onClick={() => setBet((b) => Math.min(balance, +(b * 2).toFixed(2)))}
            className="h-10 w-10 rounded-md border border-border bg-secondary text-lg font-bold text-foreground active:scale-95 disabled:opacity-50"
            disabled={inDive}
          >+</button>
        </div>
        <div className="mb-3 grid grid-cols-5 gap-1.5">
          {QUICK_BETS.map((v) => (
            <button
              key={v}
              onClick={() => setBet(v)}
              disabled={inDive}
              className={`rounded-md border py-1.5 text-xs font-semibold tabular-nums transition ${
                bet === v
                  ? "border-gold/60 bg-gold/15 text-gold"
                  : "border-border bg-secondary text-muted-foreground"
              } disabled:opacity-50`}
            >
              {v}
            </button>
          ))}
        </div>

        {inDive && participating && !hasCashed ? (
          <button
            onClick={cashOut}
            className="w-full rounded-xl border border-success/40 bg-gradient-to-b from-success to-success/70 py-4 text-lg font-black tracking-wider text-background shadow-[0_0_30px_-8px] shadow-success active:scale-[0.98]"
          >
            CASH OUT · {potentialWin.toFixed(2)}
          </button>
        ) : inDive && participating && hasCashed ? (
          <button
            disabled
            className="w-full cursor-not-allowed rounded-xl border border-success/30 bg-success/10 py-4 text-sm font-bold tracking-widest text-success"
          >
            SECURED +{lastWin?.amount.toFixed(2)} · WATCHING DIVE…
          </button>
        ) : inDive && !participating ? (
          <button
            disabled
            className="w-full cursor-not-allowed rounded-xl border border-border bg-secondary py-4 text-sm font-bold tracking-widest text-muted-foreground"
          >
            SPECTATING · NEXT ROUND SOON
          </button>
        ) : isIdle && participating ? (
          <button
            disabled
            className="w-full cursor-not-allowed rounded-xl border border-gold/30 bg-gold/10 py-4 text-sm font-bold tracking-widest text-gold"
          >
            BET LOCKED · DIVE IN {countdown.toFixed(1)}s
          </button>
        ) : (
          <button
            onClick={placeBet}
            disabled={!canBet || showBonus || showCrash}
            className="w-full rounded-xl border border-gold/40 bg-gradient-to-b from-gold to-gold-deep py-4 text-lg font-black tracking-wider text-background shadow-[0_0_30px_-8px] shadow-gold disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
          >
            {isIdle ? `PLACE BET · ${countdown.toFixed(1)}s` : "WAITING…"}
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Canvas drawing helpers
// ============================================================

// Jackpot multiplier when the anchor reaches the sea floor.
// Weighted: 50% → 50–100×, 35% → 100–200×, 15% → 200–500×.
function sampleJackpot(): number {
  const r = Math.random();
  let m: number;
  if (r < 0.5) m = 50 + Math.random() * 50;
  else if (r < 0.85) m = 100 + Math.random() * 100;
  else m = 200 + Math.random() * 300;
  return +m.toFixed(2);
}

function AnchorIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v15" />
      <path d="M8 11h8" />
      <path d="M5 18a7 7 0 0 0 7 4 7 7 0 0 0 7-4" />
    </svg>
  );
}

function ChestIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v1H4v-1Z" opacity="0.7" />
      <path d="M4 12h16v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-7Z" />
      <rect x="10" y="13" width="4" height="4" rx="0.5" fill="#1a0e06" />
    </svg>
  );
}
