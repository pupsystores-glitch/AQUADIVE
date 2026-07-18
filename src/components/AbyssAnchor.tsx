import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BETTING_WINDOW_SECONDS,
  BOOST_DECAY_PER_SECOND,
  BOOST_GAIN_PER_GOLDFISH,
  BOOST_MULTIPLIER_BONUS,
  BOOST_SPEED_FACTOR,
  COLLISION_DX_FRAC,
  COLLISION_DY_PX,
  CREATURE_SPAWN_EVERY,
  DIVE_SPAWN_DEPTH_PX,
  ENGINE_STATE_TO_PHASE,
  GameEngine,
  INITIAL_SPAWN_DEPTH_PX,
  LocalRoundAuthority,
  MAX_TICK_SECONDS,
  SPAWN_AHEAD_PX,
  SPAWN_JITTER_PX,
  createMathRandomRng,
  descentSpeed,
  multiplierAt,
  rollCreature,
  type BonusChest,
  type Creature,
  type DivingTickOutcome,
  type RoundAuthority,
} from "@/engine";
import { CASH_FLASH_MS, HISTORY_LIMIT, JACKPOT_FLASH_MS, QUICK_BETS } from "@/game/config";
import { COUNTDOWN_TICK_MS, DEFAULT_BALANCE, DEFAULT_BET } from "@/game/constants";
import { chainTier, formatMultiplier } from "@/game/presentation";
import type { HistoryEntry, LastWin } from "@/game/types";
import {
  SHIP_IMPACT_FX_SECONDS,
  SceneRenderer,
  type Phase,
  type RenderState,
} from "@/rendering/scene-renderer";
import { ANCHOR_WORLD_OFFSET_PX, CHAIN_MAX_DEPTH } from "@/shared/world";

// E2 seam (docs/06_ENGINE_ARCHITECTURE.md §11, §16): outcome draws go
// through the RoundAuthority; world draws (creature rolls, spawn jitter) go
// through the `world` Rng stream. Both are constructed here only until E3,
// when the GameEngine facade takes them as injected dependencies.
const worldRng = createMathRandomRng();
const roundAuthority: RoundAuthority = new LocalRoundAuthority(createMathRandomRng());

export default function AbyssAnchor() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const rendererRef = useRef<SceneRenderer | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

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

  const roundBetRef = useRef(0); // this round's locked bet (0 when spectating) — settlement-side (§3)
  const phaseRef = useRef<Phase>("idle");
  const worldYRef = useRef(0); // anchor's depth in world px
  const creaturesRef = useRef<Creature[]>([]);
  const nextSpawnAtRef = useRef(INITIAL_SPAWN_DEPTH_PX);
  const nextCreatureId = useRef(1);
  const lastTsRef = useRef<number | null>(null);
  const boostRef = useRef(0);
  const hasCashedRef = useRef(false);
  const participatingRef = useRef(false);
  const betRef = useRef(DEFAULT_BET);
  const shipImpactRef = useRef<number | null>(null); // performance.now() when anchor hit ship
  const jackpotMultRef = useRef(1); // multiplier locked at ship impact, used for chest math

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { participatingRef.current = participating; }, [participating]);
  useEffect(() => { betRef.current = bet; }, [bet]);

  // ----- place a bet during the betting window -----
  const placeBet = useCallback(() => {
    if (phaseRef.current !== "idle") return;
    if (participatingRef.current) return;
    const b = betRef.current;
    if (b <= 0 || b > balance) return;
    setBalance((prev) => +(prev - b).toFixed(2));
    setParticipating(true);
  }, [balance]);

  // ----- betting countdown display (100 ms UI refresh) -----
  // The betting→diving transition is engine-owned since E4: the machine's
  // countdown runs on the simulation clock (delta D1) and starting the dive
  // is its transition, not this interval's. This interval only mirrors
  // engine state into the HUD; delta D5 (E6) deletes it in favor of
  // per-frame state reads.
  useEffect(() => {
    if (phase !== "idle") return;
    setCountdown(engineRef.current?.countdown ?? BETTING_WINDOW_SECONDS);
    const iv = window.setInterval(() => {
      setCountdown(engineRef.current?.countdown ?? BETTING_WINDOW_SECONDS);
    }, COUNTDOWN_TICK_MS);
    return () => window.clearInterval(iv);
  }, [phase]);

  // ----- cashout (money is locked in, but anchor keeps descending) -----
  // Still a direct callback reading the rendered multiplier — it becomes a
  // queued engine command with sanctioned delta D4 in E5.
  const cashOut = useCallback(() => {
    if (phaseRef.current !== "diving") return;
    if (!participatingRef.current) return;
    if (hasCashedRef.current) return;
    const m = multiplier;
    const win = +(roundBetRef.current * m).toFixed(2);
    setBalance((b) => +(b + win).toFixed(2));
    setLastWin({ amount: win, mult: m });
    setHistory((h) => [{ mult: m, crashed: false }, ...h].slice(0, HISTORY_LIMIT));
    hasCashedRef.current = true;
    setHasCashed(true);
    setCashFlash(true);
    setTimeout(() => setCashFlash(false), CASH_FLASH_MS);
    // stay in "diving" — anchor continues until the chain snaps.
  }, [multiplier]);

  // ----- chest pick — applied by the engine state machine (E4) -----
  // Chest math, the result timer and the return to betting are machine-owned;
  // display + settlement ride the chestPicked event listener in the game loop.
  const pickChest = useCallback((id: 0 | 1 | 2) => {
    engineRef.current?.pickChest(id);
  }, []);

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
    // Assemble the RenderState snapshot from refs only (never render-scope
    // variables — docs/05_RENDERING_ARCHITECTURE.md §20 risk 3) and hand it
    // to the SceneRenderer. The rAF loop stays here: the renderer never
    // schedules itself (§17). Since E3, `animTime` reads the engine's
    // simulation clock (docs/06 §8: the accumulated clamped clock is
    // precisely simTime after the fixed-tick extraction).
    const renderFrame = (frameDt: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (rendererRef.current === null) rendererRef.current = new SceneRenderer(canvas);
      const renderer = rendererRef.current;
      renderer.resize(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio || 1);

      // Ship-impact FX clock: performance.now() bookkeeping stays with the
      // caller (§12); the renderer only ever sees elapsed seconds.
      let shipImpact: RenderState["shipImpact"] = null;
      if (shipImpactRef.current != null) {
        const elapsed = (performance.now() - shipImpactRef.current) / 1000;
        if (elapsed < SHIP_IMPACT_FX_SECONDS) {
          shipImpact = { elapsed };
        } else {
          shipImpactRef.current = null;
        }
      }

      const worldY = worldYRef.current;
      renderer.frame(
        {
          phase: phaseRef.current,
          worldY,
          depthRatio: Math.min(1, worldY / CHAIN_MAX_DEPTH),
          boost: boostRef.current,
          creatures: creaturesRef.current,
          crashed: phaseRef.current === "crashed",
          shipImpact,
        },
        { animTime: engine.simTime, frameDt },
      );
    };

    // The diving-tick pipeline (docs/06 §6.3) — component-owned until E5.
    // Since E4 the engine's round state machine owns all phases and timers
    // and calls this body only while `diving`, once per fixed 60 Hz tick.
    // D1 (E4): the multiplier's elapsed time reads the simulation clock.
    // D3 (E4): a terminal outcome (crash / sea floor) ends the pipeline for
    // this tick; the machine applies the transition and its entry actions.
    const stepSimulation = (dt: number): DivingTickOutcome | void => {
      let m = multiplierAt(engine.diveElapsed);
      // boost decays
      if (boostRef.current > 0) {
        boostRef.current = Math.max(0, boostRef.current - dt * BOOST_DECAY_PER_SECOND);
        m += boostRef.current * BOOST_MULTIPLIER_BONUS; // small bump while active
        setBoost(boostRef.current);
      }

      // crash check — terminal (D3); the crashed listener clamps the display
      if (m >= engine.crashAt) return "crashed";
      setMultiplier(m);

      // descent
      const speed = descentSpeed(m) * (1 + boostRef.current * BOOST_SPEED_FACTOR);
      worldYRef.current += speed * dt;

      // spawn creatures (world-stream draws, docs/06 §11)
      while (worldYRef.current + SPAWN_AHEAD_PX > nextSpawnAtRef.current) {
        creaturesRef.current.push(
          rollCreature(nextSpawnAtRef.current, nextCreatureId.current++, worldRng),
        );
        nextSpawnAtRef.current += CREATURE_SPAWN_EVERY - worldRng.next() * SPAWN_JITTER_PX;
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

      // sea floor → SHIP IMPACT — terminal (D3); the machine samples the
      // jackpot and the shipImpact listener below settles and displays it
      if (worldYRef.current >= CHAIN_MAX_DEPTH) return "seaFloor";
    };

    const engine = new GameEngine({ authority: roundAuthority, divingTick: stepSimulation });
    engineRef.current = engine;

    // Settlement + display listeners (§21 E4: the settlement listener is
    // extracted from the old inline transition code; §12 event edge). All
    // money math is verbatim — the engine computes outcomes, never balances
    // (§3). UI flash timings (CASH/JACKPOT_FLASH_MS) stay here per §8.
    const subscriptions = [
      engine.events.on("stateChanged", ({ to }) => {
        setPhase(ENGINE_STATE_TO_PHASE[to]);
      }),
      engine.events.on("diveStarted", () => {
        roundBetRef.current = participatingRef.current ? betRef.current : 0;
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
      }),
      engine.events.on("crashed", ({ multiplier: m }) => {
        setMultiplier(m);
        if (!hasCashedRef.current) {
          setHistory((h) => [{ mult: m, crashed: true }, ...h].slice(0, HISTORY_LIMIT));
        }
      }),
      engine.events.on("shipImpact", ({ jackpotMultiplier: jackpot }) => {
        jackpotMultRef.current = jackpot;
        shipImpactRef.current = performance.now(); // FX bookkeeping until E6
        setMultiplier(jackpot);
        if (participatingRef.current && !hasCashedRef.current) {
          const win = +(roundBetRef.current * jackpot).toFixed(2);
          setBalance((b) => +(b + win).toFixed(2));
          setLastWin({ amount: win, mult: jackpot });
          hasCashedRef.current = true;
          setHasCashed(true);
          setCashFlash(true);
          setTimeout(() => setCashFlash(false), JACKPOT_FLASH_MS);
        }
        setHistory((h) => [{ mult: jackpot, crashed: false }, ...h].slice(0, HISTORY_LIMIT));
      }),
      engine.events.on("chestsRevealed", ({ chests: revealed }) => {
        setChests(revealed);
        setChosenChest(null);
      }),
      engine.events.on("chestPicked", ({ chestId, chestMultiplier, finalMultiplier }) => {
        setChosenChest({ id: chestId, multiplier: chestMultiplier, opened: true });
        setMultiplier(finalMultiplier);
        if (participatingRef.current) {
          // The previous jackpot win was already credited; add the delta from multiplying it.
          const jackpot = jackpotMultRef.current;
          const prevWin = +(roundBetRef.current * jackpot).toFixed(2);
          const totalWin = +(roundBetRef.current * finalMultiplier).toFixed(2);
          const delta = +(totalWin - prevWin).toFixed(2);
          setBalance((b) => +(b + delta).toFixed(2));
          setLastWin({ amount: totalWin, mult: finalMultiplier });
        }
        setHistory((h) =>
          [{ mult: finalMultiplier, crashed: false }, ...h].slice(0, HISTORY_LIMIT),
        );
      }),
    ];

    // The rAF loop feeds wall-clock frame deltas into the engine and
    // renders once per frame with the latest state (§7: ticks and frames
    // are independent). frameDt keeps the previous clamp — it is the
    // renderer's contract value (docs/05 §4), not a simulation input.
    const frame = (ts: number) => {
      const last = lastTsRef.current ?? ts;
      const wallDt = (ts - last) / 1000;
      lastTsRef.current = ts;
      engine.advance(wallDt);
      renderFrame(Math.min(MAX_TICK_SECONDS, wallDt));
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTsRef.current = null;
      subscriptions.forEach((unsubscribe) => unsubscribe());
      engineRef.current = null;
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, []);

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
// Icon components
// ============================================================

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
