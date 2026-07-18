// EngineDriver tests (Sprint 3, Commit E6; docs/06 §13): the driver owns
// the rAF loop and the wall clock — here both are stubbed, so the tests
// drive frames with explicit timestamps and assert the frame pipeline:
// wall delta → advance → projections → sink, plus the attach/detach
// session semantics (detach pauses, never resets; re-attach resumes with a
// fresh wall-clock baseline).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MAX_TICKS_PER_ADVANCE, TICK_SECONDS } from "./clock";
import { EngineDriver, type EngineDriverSink } from "./driver";
import { GameEngine, type EnginePublicState } from "./game-engine";
import type { RenderState, RenderTime } from "@/rendering/render-state";
import type { RoundAuthority } from "./round-authority";

const stubAuthority = (): RoundAuthority => ({
  sampleCrashPoint: () => 2,
  sampleJackpot: () => 100,
  rollBonusChests: () => [
    { id: 0, multiplier: 2, opened: false },
    { id: 1, multiplier: 6.5, opened: false },
    { id: 2, multiplier: 30, opened: false },
  ],
});

const makeEngine = () =>
  new GameEngine({ authority: stubAuthority(), worldRng: { next: () => 0.5 } });

// ----- stubbed rAF host -----
const host = globalThis as unknown as {
  requestAnimationFrame?: (cb: FrameRequestCallback) => number;
  cancelAnimationFrame?: (id: number) => void;
};
let pending: Map<number, FrameRequestCallback>;
let nextId: number;

beforeEach(() => {
  pending = new Map();
  nextId = 1;
  host.requestAnimationFrame = (cb) => {
    const id = nextId++;
    pending.set(id, cb);
    return id;
  };
  host.cancelAnimationFrame = (id) => {
    pending.delete(id);
  };
});

afterEach(() => {
  delete host.requestAnimationFrame;
  delete host.cancelAnimationFrame;
});

/** Fire all pending rAF callbacks with the given timestamp (ms). */
const fire = (tsMs: number) => {
  const callbacks = [...pending.values()];
  pending.clear();
  for (const cb of callbacks) cb(tsMs);
};

const recordingSink = () => {
  const frames: Array<{ state: RenderState; time: RenderTime }> = [];
  const syncs: EnginePublicState[] = [];
  const sink: EngineDriverSink = {
    frame: (state, time) => frames.push({ state, time }),
    sync: (state) => syncs.push(state),
  };
  return { sink, frames, syncs };
};

describe("EngineDriver — the rAF loop + wall clock owner (§13)", () => {
  it("feeds wall deltas into advance() and hands all three projections to the sink each frame", () => {
    const engine = makeEngine();
    const driver = new EngineDriver(engine);
    const { sink, frames, syncs } = recordingSink();

    driver.attach(sink);
    expect(driver.running).toBe(true);

    fire(1000); // first frame after attach: zero delta — never a jump
    expect(engine.tickCount).toBe(0);
    expect(frames).toHaveLength(1);
    expect(frames[0].time).toEqual({ animTime: 0, frameDt: 0 });
    expect(frames[0].state.phase).toBe("idle");
    expect(syncs).toHaveLength(1);
    expect(syncs[0].countdownSeconds).toBe(5);

    fire(1017); // a 17 ms frame: one whole tick of wall time consumed
    expect(engine.tickCount).toBe(1);
    expect(frames[1].time.animTime).toBeCloseTo(TICK_SECONDS, 12);
    expect(frames[1].time.frameDt).toBeCloseTo(0.017, 12);
    expect(syncs[1].countdownSeconds).toBeCloseTo(5 - TICK_SECONDS, 12);
  });

  it("clamps a tab-away frame: catch-up capped, frameDt at the renderer contract clamp", () => {
    const engine = makeEngine();
    const driver = new EngineDriver(engine);
    const { sink, frames } = recordingSink();

    driver.attach(sink);
    fire(0);
    fire(3000); // 3 s gap
    expect(engine.tickCount).toBe(MAX_TICKS_PER_ADVANCE); // §7: excess dropped
    expect(frames[1].time.frameDt).toBe(0.05); // docs/05 §4 clamp
  });

  it("detach pauses the session and keeps engine state; re-attach resumes with a fresh baseline", () => {
    const engine = makeEngine();
    const driver = new EngineDriver(engine);
    const first = recordingSink();

    driver.attach(first.sink);
    fire(0);
    fire(100);
    const ticksBefore = engine.tickCount;
    expect(ticksBefore).toBeGreaterThan(0);

    driver.detach();
    expect(driver.running).toBe(false);
    expect(pending.size).toBe(0); // loop cancelled, nothing scheduled

    const second = recordingSink();
    driver.attach(second.sink);
    fire(60_000); // long wall-clock gap while detached…
    expect(engine.tickCount).toBe(ticksBefore); // …contributes zero delta
    expect(second.frames).toHaveLength(1);

    fire(60_017); // a 17 ms frame: one whole tick
    expect(engine.tickCount).toBe(ticksBefore + 1); // resumed, not restarted
    expect(first.frames).toHaveLength(2); // the old sink never hears again
  });
});
