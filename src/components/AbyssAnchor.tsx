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
import anchorImgSrc from "@/assets/anchor.png";
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
import type { HistoryEntry, LastWin, RunState } from "@/game/types";

// Preloaded anchor sprite — shared across mounts.
const ANCHOR_IMAGE: HTMLImageElement | null = typeof window !== "undefined" ? new Image() : null;
if (ANCHOR_IMAGE) ANCHOR_IMAGE.src = anchorImgSrc;

export default function AbyssAnchor() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const [balance, setBalance] = useState(1000);
  const [bet, setBet] = useState(5);
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
  const nextSpawnAtRef = useRef(120);
  const nextCreatureId = useRef(1);
  const lastTsRef = useRef<number | null>(null);
  const boostRef = useRef(0);
  const swayRef = useRef(0);
  const hasCashedRef = useRef(false);
  const participatingRef = useRef(false);
  const betRef = useRef(5);
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
    nextSpawnAtRef.current = 60;
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
    }, 100);
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
      const dt = Math.min(0.05, (ts - last) / 1000);
      lastTsRef.current = ts;
      swayRef.current += dt;

      if (phaseRef.current === "diving" && runRef.current) {
        const elapsed = (ts - runRef.current.startedAt) / 1000;
        let m = multiplierAt(elapsed);
        // boost decays
        if (boostRef.current > 0) {
          boostRef.current = Math.max(0, boostRef.current - dt * 0.6);
          m += boostRef.current * 0.4; // small bump while active
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
        const speed = descentSpeed(m) * (1 + boostRef.current * 0.8);
        worldYRef.current += speed * dt;

        // spawn creatures
        while (worldYRef.current + 900 > nextSpawnAtRef.current) {
          spawnCreature(nextSpawnAtRef.current);
          nextSpawnAtRef.current += CREATURE_SPAWN_EVERY - Math.random() * 18;
        }

        // collision with goldfish → boost
        const anchorWorldY = worldYRef.current + 220;
        for (const c of creaturesRef.current) {
          if (c.consumed) continue;
          const dy = Math.abs(c.worldY - anchorWorldY);
          if (dy < COLLISION_DY_PX && Math.abs(c.x - 0.5) < COLLISION_DX_FRAC) {
            if (c.kind === "goldfish") {
              c.consumed = true;
              boostRef.current = Math.min(1, boostRef.current + 0.8);
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
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
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
    const top = lerpColor([60, 130, 165], [8, 18, 40], depthRatio);
    const bot = lerpColor([14, 40, 80], [2, 6, 18], depthRatio);
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
    const anchorScreenY = h * 0.55;
    const worldToScreen = (wy: number) => anchorScreenY + (wy - (worldY + 220));

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
    const floorScreenY = worldToScreen(CHAIN_MAX_DEPTH + 220);
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
      if (dt < 1.4) {
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

function lerpColor(a: number[], b: number[], t: number): number[] {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t));
}

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

function drawShip(ctx: CanvasRenderingContext2D, cx: number, cy: number, t: number) {
  ctx.save();
  // Water surface line
  ctx.strokeStyle = "rgba(180, 220, 255, 0.5)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let x = -200; x < 400; x += 8) {
    const y = cy + 20 + Math.sin(t * 1.5 + x * 0.08) * 2;
    if (x === -200) ctx.moveTo(cx + x, y); else ctx.lineTo(cx + x, y);
  }
  ctx.stroke();

  // Rocking
  const rock = Math.sin(t * 1.2) * 0.05;
  ctx.translate(cx, cy);
  ctx.rotate(rock);

  // Hull
  ctx.fillStyle = "#2a1a0e";
  ctx.strokeStyle = "#a47148";
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
  ctx.strokeStyle = "rgba(164, 113, 72, 0.5)";
  ctx.beginPath();
  ctx.moveTo(-40, 8);
  ctx.lineTo(40, 8);
  ctx.stroke();

  // Mast
  ctx.strokeStyle = "#7a4b2a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -36);
  ctx.stroke();
  // Sail
  ctx.fillStyle = "#f3ead4";
  ctx.beginPath();
  ctx.moveTo(2, -34);
  ctx.quadraticCurveTo(24, -22, 2, -8);
  ctx.closePath();
  ctx.fill();

  // Sailor (boy)
  ctx.fillStyle = "#f0c9a0";
  ctx.beginPath();
  ctx.arc(-18, -8, 3.5, 0, Math.PI * 2); // head
  ctx.fill();
  ctx.fillStyle = "#c44b3a"; // red shirt
  ctx.fillRect(-21, -4, 6, 6);
  // Arm wave
  ctx.strokeStyle = "#f0c9a0";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-18, -2);
  ctx.lineTo(-18 + Math.cos(t * 3) * 4, -6 + Math.sin(t * 3) * 2);
  ctx.stroke();
  // Hat
  ctx.fillStyle = "#1a3a6a";
  ctx.beginPath();
  ctx.ellipse(-18, -11, 4.5, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawChain(
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
    ctx.strokeStyle = "rgba(32, 38, 46, 0.95)";
    ctx.lineWidth = 3.6;
    ctx.beginPath();
    ctx.ellipse(0, 0, 6.2, 3.4, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Mid steel body
    ctx.strokeStyle = "rgba(150, 160, 172, 0.95)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 6.2, 3.4, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Top highlight for brushed-steel feel
    ctx.strokeStyle = "rgba(240, 246, 255, 0.85)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, -0.6, 5.4, 2.7, 0, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();

    ctx.restore();
  }
  ctx.restore();
}

function drawShipImpact(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  dt: number,
) {
  const life = Math.min(1, dt / 1.4);
  const alpha = 1 - life;
  ctx.save();

  // Pink jackpot flash overlay
  const flash = ctx.createRadialGradient(cx, cy, 10, cx, cy, Math.max(w, h) * 0.9);
  flash.addColorStop(0, `rgba(255, 90, 190, ${0.55 * alpha})`);
  flash.addColorStop(0.35, `rgba(255, 60, 160, ${0.22 * alpha})`);
  flash.addColorStop(1, "rgba(255, 60, 160, 0)");
  ctx.fillStyle = flash;
  ctx.fillRect(0, 0, w, h);

  // Radiating pink lightning bolts
  ctx.strokeStyle = `rgba(255, 190, 235, ${0.95 * alpha})`;
  ctx.lineWidth = 2.4;
  ctx.shadowColor = "rgba(255, 90, 200, 0.95)";
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
  ctx.fillStyle = `rgba(255, 220, 240, ${0.9 * alpha})`;
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
  ctx.strokeStyle = `rgba(255, 120, 210, ${0.8 * alpha})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, 30 + life * 180, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}



function drawAnchor(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  swayAngle: number,
  crashed: boolean,
  boost: number,
  drawH: number,
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(swayAngle);

  // Soft warm halo, brighter when boosted
  const haloAlpha = 0.16 + boost * 0.5;
  const halo = ctx.createRadialGradient(0, 4, 4, 0, 4, drawH * 0.55);
  halo.addColorStop(0, `rgba(255, 220, 120, ${haloAlpha})`);
  halo.addColorStop(1, "rgba(255, 220, 120, 0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 4, drawH * 0.55, 0, Math.PI * 2);
  ctx.fill();

  if (boost > 0.05) {
    ctx.shadowColor = "rgba(255, 210, 90, 0.95)";
    ctx.shadowBlur = 28 * boost;
  }

  const img = ANCHOR_IMAGE;
  if (img && img.complete && img.naturalWidth > 0) {
    const aspect = img.naturalWidth / img.naturalHeight;
    const drawW = drawH * aspect;
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
  }

  if (crashed) {
    ctx.strokeStyle = "rgba(255,80,80,0.95)";
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


function drawCreature(
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
      ctx.fillStyle = "rgba(180,210,230,0.7)";
      for (let i = 0; i < 5; i++) {
        const fx = (i - 2) * 9;
        const fy = Math.sin(t * 2 + i) * 3;
        drawFish(ctx, fx, fy, 6, "rgba(180,210,230,0.85)");
      }
      break;
    case "goldfish":
      drawFish(ctx, 0, Math.sin(t * 3) * 2, 9, "#f4c64a");
      ctx.fillStyle = "rgba(255,210,90,0.25)";
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "octopus": {
      ctx.fillStyle = "#7a3b6a";
      ctx.beginPath();
      ctx.ellipse(0, -2, 10, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      // tentacles
      ctx.strokeStyle = "#7a3b6a";
      ctx.lineWidth = 2;
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 2.5, 4);
        ctx.quadraticCurveTo(i * 4, 10 + Math.sin(t * 2 + i) * 2, i * 5, 16);
        ctx.stroke();
      }
      // eyes
      ctx.fillStyle = "#fff";
      ctx.fillRect(-4, -4, 2, 2);
      ctx.fillRect(2, -4, 2, 2);
      break;
    }
    case "seahorse":
      ctx.strokeStyle = "#e8a657";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.quadraticCurveTo(6, -4, 0, 2);
      ctx.quadraticCurveTo(-6, 8, 0, 14);
      ctx.stroke();
      ctx.fillStyle = "#e8a657";
      ctx.beginPath();
      ctx.arc(0, -12, 3, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "sealion": {
      ctx.fillStyle = "#6a5a4a";
      ctx.beginPath();
      ctx.ellipse(0, 0, 18, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(14, -4, 6, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.fillRect(16, -5, 1.5, 1.5);
      // flippers
      ctx.fillStyle = "#5a4a3a";
      ctx.beginPath();
      ctx.ellipse(-6, 6 + Math.sin(t * 3) * 1, 6, 2, 0.3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "whale": {
      ctx.fillStyle = "#3a5a7a";
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
      ctx.fillStyle = "rgba(220,230,240,0.4)";
      ctx.beginPath();
      ctx.ellipse(0, 4, 24, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      // eye
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(20, -2, 1.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "kelp": {
      ctx.strokeStyle = "rgba(80,140,90,0.7)";
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
      ctx.fillStyle = "rgba(220, 170, 230, 0.55)";
      ctx.beginPath();
      ctx.ellipse(0, -2, 10 * pulse, 7 * pulse, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 220, 245, 0.35)";
      ctx.beginPath();
      ctx.ellipse(0, -2, 10 * pulse, 7 * pulse, 0, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = "rgba(220, 170, 230, 0.6)";
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
      ctx.fillStyle = "rgba(40, 60, 90, 0.85)";
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
      ctx.strokeStyle = "rgba(40, 60, 90, 0.85)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(0, 4);
      ctx.lineTo(0, 16);
      ctx.stroke();
      break;
    }
    case "anglerfish": {
      ctx.fillStyle = "#1a1820";
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
      ctx.strokeStyle = "#f0f0f0";
      ctx.lineWidth = 0.8;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(6 + i * 1.5, 2);
        ctx.lineTo(6 + i * 1.5, 4);
        ctx.stroke();
      }
      // lure stalk
      ctx.strokeStyle = "#3a3640";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(4, -6);
      ctx.quadraticCurveTo(8, -14, 12 + Math.sin(t * 2) * 1.5, -16);
      ctx.stroke();
      // glowing lure
      const glow = ctx.createRadialGradient(12, -16, 0, 12, -16, 8);
      glow.addColorStop(0, "rgba(255, 235, 140, 0.95)");
      glow.addColorStop(1, "rgba(255, 235, 140, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(12, -16, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff4c0";
      ctx.beginPath();
      ctx.arc(12, -16, 1.6, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }

  ctx.restore();
}

function drawFish(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
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

function drawSeaFloor(ctx: CanvasRenderingContext2D, w: number, h: number, floorY: number) {
  ctx.save();

  // Murky sand gradient
  const grd = ctx.createLinearGradient(0, floorY - 60, 0, h);
  grd.addColorStop(0, "rgba(30,26,22,0)");
  grd.addColorStop(0.4, "rgba(46,38,28,0.85)");
  grd.addColorStop(1, "rgba(22,18,12,1)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, floorY - 60, w, h - (floorY - 60));

  // Sand mounds
  ctx.fillStyle = "#3a2e1e";
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
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.beginPath();
  ctx.ellipse(0, 30, 120, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Main hull — dark weathered wood
  const hullGrd = ctx.createLinearGradient(0, -30, 0, 30);
  hullGrd.addColorStop(0, "#3a2a1a");
  hullGrd.addColorStop(0.6, "#241811");
  hullGrd.addColorStop(1, "#120a06");
  ctx.fillStyle = hullGrd;
  ctx.strokeStyle = "#0a0604";
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
  ctx.strokeStyle = "rgba(90,60,40,0.35)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const y = -2 + i * 9;
    ctx.beginPath();
    ctx.moveTo(-110, y);
    ctx.quadraticCurveTo(0, y + 4, 105, y);
    ctx.stroke();
  }

  // Portholes (glowing faint)
  for (const [px, py] of [[-70, 8], [-40, 8], [-10, 10], [30, 8], [60, 10]] as const) {
    ctx.fillStyle = "#0a0604";
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#5a4028";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "rgba(120, 180, 200, 0.25)";
    ctx.beginPath();
    ctx.arc(px, py, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Broken mast — snapped, leaning
  ctx.strokeStyle = "#2a1c10";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-20, -18);
  ctx.lineTo(-55, -70);
  ctx.stroke();
  // Torn sail rag
  ctx.fillStyle = "rgba(180,170,140,0.35)";
  ctx.beginPath();
  ctx.moveTo(-55, -70);
  ctx.quadraticCurveTo(-30, -55, -40, -40);
  ctx.quadraticCurveTo(-52, -50, -55, -70);
  ctx.closePath();
  ctx.fill();

  // Bowsprit
  ctx.strokeStyle = "#1a1008";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(105, -4);
  ctx.lineTo(135, -14);
  ctx.stroke();

  // Hole in hull (dark cavity)
  ctx.fillStyle = "#050302";
  ctx.beginPath();
  ctx.ellipse(15, 12, 14, 8, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // Algae fringe on top
  ctx.strokeStyle = "rgba(60,110,70,0.55)";
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
    ctx.fillStyle = "#3a1f0c";
    ctx.strokeStyle = "#1a0e06";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(-14, -6, 28, 12);
    ctx.fill();
    ctx.stroke();
    // Open lid (tilted back)
    ctx.fillStyle = "#4a2810";
    ctx.beginPath();
    ctx.moveTo(-14, -6);
    ctx.lineTo(-16, -18);
    ctx.lineTo(14, -18);
    ctx.lineTo(14, -6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Gold bands
    ctx.strokeStyle = "#caa238";
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-14, -2); ctx.lineTo(14, -2); ctx.stroke();
    // Spilling coins
    ctx.fillStyle = "#f3cf5a";
    for (const [cx, cy] of [[-2, -2], [4, -1], [-6, 1], [8, 2], [0, 3], [-10, 4]] as const) {
      ctx.beginPath();
      ctx.arc(cx, cy, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Gem inside
    ctx.fillStyle = "#5ad0ff";
    ctx.beginPath();
    ctx.moveTo(-3, -8); ctx.lineTo(0, -12); ctx.lineTo(3, -8); ctx.lineTo(0, -4);
    ctx.closePath();
    ctx.fill();
  } else if (kind === "coin") {
    ctx.fillStyle = "#caa238";
    ctx.strokeStyle = "#6e4f15";
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
    ctx.fillStyle = "#fff1b0";
    ctx.beginPath();
    ctx.ellipse(-4.5, -1.6, 1.2, 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "gem") {
    ctx.fillStyle = "#c93a5a";
    ctx.strokeStyle = "#5a1020";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-4, 0); ctx.lineTo(0, -6); ctx.lineTo(4, 0); ctx.lineTo(0, 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255,200,220,0.6)";
    ctx.beginPath();
    ctx.moveTo(-1.5, -2); ctx.lineTo(0, -5); ctx.lineTo(1, -2);
    ctx.closePath();
    ctx.fill();
  } else if (kind === "goblet") {
    ctx.fillStyle = "#caa238";
    ctx.strokeStyle = "#6e4f15";
    ctx.lineWidth = 0.8;
    // cup
    ctx.beginPath();
    ctx.moveTo(-4, -8); ctx.lineTo(4, -8); ctx.lineTo(3, -3); ctx.lineTo(-3, -3);
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
