# CURRENT TASK

TASK 005

Sprint 2 — Rendering Architecture

Objective:

Design and then extract the rendering system, per the approved roadmap (Phase 2 deliverable feeding Phase 4).

Progress:

- Commit 1 — Architecture Planning (`docs/05_RENDERING_ARCHITECTURE.md`, documentation only): DONE, verified.
- Commit 2 — R1: eight draw helpers moved verbatim into `src/rendering/draw/` + `theme.ts` color tokens: DONE, approved.
- Commit 3 — R2: `src/rendering/camera.ts` replacing the inline `worldToScreen` closure and the 3 culling checks (§6 corrected for asymmetric margins): DONE, approved.
- Commit 4 — R3: `render-state.ts` (RenderState/RenderTime/RenderLayer contract) + `scene-renderer.ts` (public entry point owning ctx/DPR/camera/layer list) + 5 layer files (background → environment → world → actor → effects); `drawScene` deleted, component assembles `RenderState` from refs inside the tick and calls `frame()`; `SHIP_WORLD_Y` named per §8; §18 import corrections recorded: DONE, approved.
- Commit 5 — R4: `src/rendering/assets.ts` AssetManager (manifest, eager preload at module init, ready-gated handles, log-once failure policy); module-scope `ANCHOR_IMAGE` deleted from `draw/anchor.ts`; `drawAnchor` takes an `AssetHandle`; Actor layer passes `assets.get("anchor")`: DONE, approved.
- Commit 6 — R5: FX timing handoff completed (`draw/impact-fx.ts` no longer imports `SHIP_IMPACT_FX_SECONDS`; `life` is computed by the Effects layer and passed as a parameter) + dev-only frame-time meter in `scene-renderer.ts` (rolling avg + p95, console-logged every ~5 s, DEV-gated and compiled out of production; §4/§14/§20 corrections recorded sanctioning this single wall-clock exemption): DONE, awaiting approval.

R1–R5 are complete: the rendering architecture of `docs/05_RENDERING_ARCHITECTURE.md` is fully implemented. `AbyssAnchor.tsx` contains simulation + UI only; Phase 5 (engine extraction) can proceed against the stable rendering API (`SceneRenderer.frame(RenderState, RenderTime)`).

Next (needs approval): Sprint 2 close-out review, then Phase 5 planning. Still pending from Sprint 1: the `sampleJackpot` move (its own commit when approved).

Note on R5 scope: R3 already routes ship-impact FX through `shipImpact.elapsed` in `RenderState` (required by the fixed §4 contract and the no-clock rule — the `performance.now()` bookkeeping stayed in the component/caller). R5 therefore reduces to: removing the `SHIP_IMPACT_FX_SECONDS` import from `draw/impact-fx.ts`/layers, plus the dev-only frame-time meter.

Notes carried over from Sprint 1 (TASK 004):

- Sprint 1 closed after Commit 5. The remaining half of Step 1.2 (move `sampleJackpot` into `src/lib/abyss-game.ts`) was not executed and remains pending; it must be scheduled as its own commit when approved.

Rules for this task:

- Rendering commits follow `docs/05_RENDERING_ARCHITECTURE.md` §19 (extraction order) and §21 (validation) exactly.
- Behavior-preserving only; no gameplay, visual, or tuning changes.
- One extraction step per commit; the game must remain playable after every commit.
- Wait for approval between commits.
