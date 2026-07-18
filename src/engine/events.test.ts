// Tests for the EventBus mechanism (docs/06 §12 rules, §18 firewalling).
import { describe, expect, it, vi } from "vitest";
import { EventBus } from "./events";

interface TestMap {
  ping: { n: number };
  pong: { s: string };
}

describe("EventBus — queue + post-tick dispatch (§12)", () => {
  it("queues emits and delivers them in order on dispatchQueued", () => {
    const bus = new EventBus<TestMap>();
    const seen: Array<number | string> = [];
    bus.on("ping", (p) => seen.push(p.n));
    bus.on("pong", (p) => seen.push(p.s));

    bus.emit("ping", { n: 1 });
    bus.emit("pong", { s: "a" });
    bus.emit("ping", { n: 2 });
    expect(seen).toEqual([]); // nothing synchronous

    bus.dispatchQueued();
    expect(seen).toEqual([1, "a", 2]);

    bus.dispatchQueued(); // queue drained — no re-delivery
    expect(seen).toEqual([1, "a", 2]);
  });

  it("unsubscribes via the returned function and via off()", () => {
    const bus = new EventBus<TestMap>();
    const seen: number[] = [];
    const listenerA = (p: { n: number }) => seen.push(p.n);
    const unsubscribeB = bus.on("ping", (p) => seen.push(p.n * 10));
    bus.on("ping", listenerA);

    bus.emit("ping", { n: 1 });
    bus.dispatchQueued();
    expect(seen).toEqual([10, 1]);

    unsubscribeB();
    bus.off("ping", listenerA);
    bus.emit("ping", { n: 2 });
    bus.dispatchQueued();
    expect(seen).toEqual([10, 1]); // nobody left listening
  });

  it("firewalls listener exceptions: logs and keeps delivering (§18)", () => {
    const bus = new EventBus<TestMap>();
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const seen: number[] = [];
    bus.on("ping", () => {
      throw new Error("broken FX hook");
    });
    bus.on("ping", (p) => seen.push(p.n));

    bus.emit("ping", { n: 7 });
    bus.dispatchQueued();

    expect(seen).toEqual([7]); // the second listener still ran
    expect(errorLog).toHaveBeenCalledTimes(1);
    errorLog.mockRestore();
  });

  it("defers events emitted during dispatch to the next dispatch (no reentrancy)", () => {
    const bus = new EventBus<TestMap>();
    const seen: number[] = [];
    bus.on("ping", (p) => {
      seen.push(p.n);
      if (p.n === 1) bus.emit("ping", { n: 99 });
    });

    bus.emit("ping", { n: 1 });
    bus.dispatchQueued();
    expect(seen).toEqual([1]); // the reentrant emit stayed queued

    bus.dispatchQueued();
    expect(seen).toEqual([1, 99]);
  });
});
