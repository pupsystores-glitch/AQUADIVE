# RENDERING ARCHITECTURE

Status: Approved design (Sprint 2, Commit 1)
Scope: Frontend rendering only. This document changes no code.
Goal: Every future rendering commit is a mechanical execution step. No rendering commit should ever need to make an architectural decision — it should only need to consult this document.

Benchmark: production HTML5 multiplayer crash games (Aviator, JetX class) — a single always-running scene, thousands of concurrent spectators server-side, 60 FPS on mid-range mobile, instant reconnect/re-render from a state snapshot.

---

## 1. Current Rendering Pipeline

Everything below lives in `src/components/AbyssAnchor.tsx` today.

```
requestAnimationFrame (single rAF loop inside a useEffect)
  └── tick(ts)
        ├── simulation update (multiplier, descent, spawning, collisions,
        │    phase transitions, money math — NOT rendering, listed for context)
        └── drawScene()                      ← immediate-mode, full redraw
              ├── canvas resize + DPR clamp (MAX_DPR)
              ├── background gradient        (lerpColor by depthRatio)
              ├── light rays                 (fade with depth, additive)
              ├── bubbles                    (procedural, seeded by anim time)
              ├── worldToScreen(wy)          ← inline camera (anchor-locked)
              ├── creatures                  (drawCreature → 10-kind switch)
              ├── surface ship               (drawShip, culled by screen Y)
              ├── sea floor + shipwreck      (drawSeaFloor → drawTreasure ×10)
              ├── chain                      (drawChain, procedural links)
              ├── anchor sprite              (drawAnchor, preloaded PNG)
              └── ship-impact jackpot FX     (drawShipImpact, time-based life)
```

Supporting facts that any refactor must preserve:

- **Single canvas**, sized to CSS box × `devicePixelRatio` (capped at `MAX_DPR = 2`), reset via `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)` every frame.
- **Camera** is one inline closure: `worldToScreen(wy) = h * ANCHOR_SCREEN_Y_FRAC + (wy − (worldY + ANCHOR_WORLD_OFFSET_PX))`. The anchor is pinned at 55 % of screen height; the world scrolls past it.
- **Animation clock** is `swayRef` — an accumulated simulation-time value (`+= dt`, dt clamped by `MAX_TICK_SECONDS`), *not* wall-clock time. Sway, rays, bubbles, creature wiggle and chain wave all derive from it. Impact FX alone uses `performance.now()` deltas.
- **State inputs** to drawing are React refs (`worldYRef`, `creaturesRef`, `boostRef`, `phaseRef`, `shipImpactRef`, `swayRef`) — mutable objects shared between the simulation and the draw code.
- **Draw helpers** (`drawShip`, `drawChain`, `drawShipImpact`, `drawAnchor`, `drawCreature`, `drawFish`, `drawSeaFloor`, `drawTreasure`) are already standalone module-level functions taking `(ctx, ...params)` — they touch no React state. This is the most valuable property of the current code: extraction can be verbatim.
- **Assets**: one preloaded `HTMLImageElement` (anchor sprite) created at module scope; everything else is procedural vector drawing.
- **UI** (multiplier readout, banners, chest picker, bet controls) is React DOM layered above the canvas — the canvas never draws text or UI.

## 2. Problems with the Current Implementation

1. **No ownership boundary.** Simulation, rendering, money math and UI share one 1,415-line component. A visual tweak and an economics change touch the same file — unacceptable for a real-money game where rendering code must be auditable as *provably unable* to affect outcomes.
2. **Renderer reads mutable simulation state directly.** Draw code dereferences the same refs the simulation mutates. There is no defined "state in, pixels out" contract, so the renderer cannot be tested, replayed, or driven by a server snapshot (multiplayer requirement).
3. **React lifecycle coupling.** The rAF loop lives in a `useEffect`; `drawScene` is a `useCallback` with a dependency array. Remounting the component restarts the world. A multiplayer client must keep rendering through UI re-renders, route changes and reconnects.
4. **Camera is not a concept.** The world→screen mapping is an inline closure. Camera shake on crash, zoom on jackpot, or a spectator free-camera would all require surgery inside `drawScene`.
5. **No layer model.** Draw order is implicit in statement order. Inserting a parallax layer or a particle system means finding the right line inside a 110-line function.
6. **Per-frame allocation pressure.** Every frame allocates gradients (`createLinearGradient` ×5+, `createRadialGradient` ×2+ during FX), arrays and closures. Fine on desktop; measurable GC churn on low-end mobile at 60 FPS.
7. **Nondeterministic world rendering.** Impact-FX bolt jitter and sparkles call `Math.random()` per frame. Harmless today, but it makes frame-snapshot testing impossible and blurs the line the platform needs: *all randomness that matters comes from the (future) server; the renderer is deterministic given (state, time).*
8. **No asset pipeline.** The single sprite is loaded by module side effect with no ready-signal, error path, or place to add atlases, audio-synced FX or skinned themes (white-label requirement).
9. **Magic literals in draw helpers.** Colors, sizes and speeds inside the eight helpers are hardcoded (explicitly deferred in Sprint 1) — blocking theming/white-labeling.
10. **Not portable.** Nothing separates "what the scene contains" from "how Canvas 2D draws it," so a future PixiJS/WebGL migration would today mean a rewrite instead of a backend swap.

## 3. Target Rendering Architecture

Three principles, in priority order:

1. **Renderer = pure consumer.** The renderer receives an immutable-by-convention `RenderState` snapshot plus a time value and produces pixels. It never mutates game state, never computes outcomes, never knows money exists.
2. **Layered scene, shallow graph.** A crash game scene is a fixed, ordered set of layers, not an arbitrary object tree. We formalize layers and keep the per-entity graph flat (see §5).
3. **Canvas 2D now, backend-swappable later.** The public surface (`SceneRenderer`, layer interfaces, `Camera`, `AssetManager`) is API-first; Canvas 2D is an implementation detail confined to draw modules (see §16).

```
┌────────────────────────── React (UI shell) ──────────────────────────┐
│  mounts <canvas>, renders DOM HUD, forwards canvas to the renderer   │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ canvas element + resize notifications
┌──────────────────────────────▼───────────────────────────────────────┐
│                         SceneRenderer                                │
│  owns: ctx, DPR/resize, Camera, ordered RenderLayer[]                │
│  frame(state: RenderState, time: RenderTime): void                   │
│    for each layer → layer.render(ctx, state, camera, time)           │
└───────┬───────────┬───────────┬───────────┬───────────┬──────────────┘
        ▼           ▼           ▼           ▼           ▼
  Background   Environment    World       Actor      Effects
   (gradient,   (light rays,  (creatures, (chain,    (impact FX,
    ocean        bubbles,      ship,       anchor)    particles,
    bands)       parallax)     floor,                 screen flash)
                               treasure)
        ▲                                                  ▲
        └────────────── AssetManager (sprites/atlases) ────┘

  RenderState  ← produced by src/engine each frame (Phase 5 work)
  FX triggers  ← engine event bus, fire-and-forget (see §17)
```

Until the engine extraction (Phase 5) lands, the existing component builds the `RenderState` from its refs and calls `SceneRenderer.frame()` — the renderer is engine-ready from day one, while the simulation stays where it is.

## 4. Renderer Responsibilities

**SceneRenderer** (the only public entry point):
- Owns the `CanvasRenderingContext2D`, backing-store sizing, DPR clamp, per-frame clear/transform reset.
- Owns the `Camera` and the ordered layer list.
- `frame(state, time)` — renders one complete frame. Idempotent for identical inputs (modulo the FX-layer exception in §12).
- `resize(width, height, dpr)` — explicit; no hidden reads of `window` inside draw paths.
- `dispose()` — releases the context reference and cached surfaces.

**Every `RenderLayer`** implements:

```ts
interface RenderLayer {
  readonly name: string;
  render(ctx: CanvasRenderingContext2D, state: RenderState,
         camera: Camera, time: RenderTime): void;
}
```

**Hard rules (enforceable in review):**
- No layer imports from `src/engine` internals, `src/lib/abyss-game.ts` economics, or React.
- No layer mutates `state`. TypeScript `Readonly<>` types on `RenderState`.
- No `Math.random()` outside the Effects layer (§12).
- No `performance.now()` / `Date.now()` anywhere in rendering — time arrives as a parameter (`RenderTime { animTime; frameDt }`).
- No money, bets, balances or multiplier *values* in the renderer. (The multiplier is displayed by the DOM HUD, §13.)

**RenderState** (the contract; exact fields finalized in the first extraction commit, shape fixed here):

```ts
interface RenderState {
  phase: Phase;                    // idle | diving | cashed | crashed | bonus
  worldY: number;                  // anchor depth, world px
  depthRatio: number;              // 0..1 of CHAIN_MAX_DEPTH
  boost: number;                   // 0..1 golden boost
  creatures: readonly RenderCreature[];
  crashed: boolean;
  shipImpact: { elapsed: number } | null;   // seconds since impact, renderer-clock based
}
```

## 5. Scene Graph

Deliberate decision: **a fixed, ordered layer list with flat per-layer entity collections — not a general-purpose hierarchical scene graph.**

Rationale: crash-game scenes are small (tens of entities) and structurally stable. A retained-mode tree (parents, transforms, z-sorting, dirty flags) is the single biggest source of accidental complexity in small engines, and PixiJS will provide a real one if/when we migrate (§16). What we standardize instead:

- **Layer order is data**: `SceneRenderer` holds `RenderLayer[]`; order in the array *is* z-order. Inserting a layer = one array entry.
- **Within a layer**, entities render in collection order; the World layer draws in the fixed order *creatures → ship → sea floor → treasure* is **not** kept — the current, verified visual order is preserved exactly: creatures → surface ship → sea floor/wreck/treasure → (Actor layer: chain → anchor). Any reordering is a visual change and out of scope.
- **Local transforms** stay what they are today: each draw module does its own `save/translate/rotate/scale/restore`. No global transform stack.
- If a future feature genuinely needs hierarchy (e.g., creatures attached to a moving reef), that is the trigger to re-evaluate — documented here so nobody bolts a tree on casually.

Canonical layer order (bottom → top):

| # | Layer | Contents |
|---|-------|----------|
| 1 | Background | depth-lerped gradient, ocean color bands |
| 2 | Environment | light rays, ambient bubbles, (future) parallax silhouettes |
| 3 | World | creatures, surface ship, sea floor, shipwreck, treasure |
| 4 | Actor | chain, anchor (always above world) |
| 5 | Effects | ship-impact FX, (future) particles, screen flashes |

DOM HUD sits above all canvas layers (§13).

## 6. Camera System

`Camera` becomes a class in `src/rendering/camera.ts`:

```ts
class Camera {
  // authoritative state
  follow(worldY: number): void;          // anchor-locked follow (today's behavior)
  // queries used by layers
  worldToScreenY(worldY: number): number;
  isVisibleY(worldY: number, margin: number): boolean;   // culling helper
  readonly viewport: { w: number; h: number };
}
```

- **V1 must reproduce the current transform bit-for-bit**: `screenY = h * ANCHOR_SCREEN_Y_FRAC + (worldY − (followY + ANCHOR_WORLD_OFFSET_PX))`. X is untransformed (creatures position by `x * w`); the camera is vertical-only by design and stays that way until a feature demands otherwise.
- Culling moves from ad-hoc `sy < -120 || sy > h + 120` checks to `camera.isVisibleY(wy, margin)` — same math, one place.
- **Extension points (interfaces reserved now, implemented never/later):** `shake(amplitude, duration)` for crash impact, `zoom` for jackpot punch-in, smoothed follow (lerp toward target) for ship-impact landing. Each is additive offset/scale applied inside `worldToScreenY` — no layer code changes when they arrive.
- The camera is owned by `SceneRenderer` and updated once per frame from `RenderState.worldY` *before* layers render. Layers never write to it.

## 7. Ocean Layers

The ocean look is the game's identity; it gets an explicit model instead of scattered literals:

- **Depth palette**: the existing four-color lerp (`BG_TOP/BOTTOM_SURFACE/ABYSS` from `src/game/constants.ts`) is generalized to an ordered list of *depth bands* `{ depthRatio, top, bottom }[]`, linearly interpolated. V1 ships with exactly two bands reproducing today's gradient byte-identically; adding a mid-water teal band later is data, not code.
- **Light rays** belong to the Environment layer; intensity = `(1 − depthRatio) * 0.18` exactly as today; they self-disable below the alpha threshold.
- **Bubbles** stay procedural/deterministic (position derived from `animTime` and index — today's formula), so they cost zero state and survive snapshot/replay.
- **Parallax (future)**: the Environment layer reserves a slot for slow-scrolling silhouette strips (rock walls, distant kelp) whose scroll factor is `k * worldY, k < 1`. Documented now so it lands as "add a strip", not a redesign.
- **Theme boundary**: all ocean palette data lives in one theme object (`src/rendering/theme.ts`, populated during extraction) — the white-label hook. Draw modules take colors from the theme, never inline (the Sprint-1 deferred literals land there).

## 8. Ship Renderer

`src/rendering/draw/ship.ts`

- `drawShip(ctx, cx, cy, t)` moves **verbatim**: water surface line, rocking hull, mast, sail, waving sailor.
- Rendered by the World layer only when `camera.isVisibleY(SHIP_WORLD_Y, margin)` — the ship's world position (`−180`, currently inline) becomes a named constant.
- The chain's top attachment (`min(shipScreenY + 40, 0)`) is computed by the Actor layer from the same constant — the current ship/chain visual relationship is preserved exactly.
- Future (not now): sail flutter states per phase, sailor reaction animation on crash — both are new params to this one module.

## 9. Anchor Renderer

`src/rendering/draw/anchor.ts` — the hero object, and the only sprite-based renderer today.

- `drawAnchor(ctx, cx, cy, swayAngle, crashed, boost, drawH)` moves verbatim: halo (boost-scaled), glow shadow, sprite blit, crash crack overlay.
- **Sway math** (pendulum X offset, sway angle, ring-position trig from `ANCHOR_RING_Y_FRAC`) currently lives in `drawScene`; it moves into the Actor layer — it is presentation, derived only from `animTime`, and must never feed back into collision logic (the engine keeps its own notion of the anchor's position).
- The sprite comes from the `AssetManager` (§15) instead of a module-scope `Image`; the "draw nothing until loaded" behavior is preserved (blit only when the handle reports ready).
- Chain (`drawChain`) is part of the Actor layer, drawn before the anchor, endpoints computed exactly as today (ship attachment → shackle ring accounting for sway rotation).

## 10. Creature Renderer

`src/rendering/draw/creatures.ts`

- The 10-kind `switch` in `drawCreature` plus `drawFish` move verbatim. Internally the switch may become a `Record<CreatureKind, DrawFn>` registry **in a later, separate commit** — adding a creature then = adding one entry + one draw function; the extraction commit itself changes nothing.
- The World layer owns iteration: culling via `camera.isVisibleY(c.worldY, 120)`, horizontal sway (`sin(animTime * 0.6 + c.phase) * 12 * c.dir`), and skipping `consumed` creatures — all byte-identical formulas.
- Creature *spawning, movement and collision* are simulation (engine territory). The renderer receives creatures as data and draws them. `RenderCreature` = `Pick<Creature, "kind" | "x" | "worldY" | "size" | "phase" | "dir" | "consumed">`.
- Future creatures with sprite art draw through the same `DrawFn` signature using AssetManager handles — no layer changes.

## 11. Background Renderer

`src/rendering/layers/background.ts` (+ `environment.ts`)

- Background layer: depth-band gradient fill (one `createLinearGradient` per frame is acceptable — see §14 for the caching rule and when it triggers).
- Environment layer: light rays (verbatim, including the `screen` composite mode inside its own save/restore) and bubbles (verbatim formula).
- Sea floor and shipwreck are **not** background — they are world-anchored objects at `CHAIN_MAX_DEPTH` and live in the World layer (`drawSeaFloor` + `drawTreasure` move verbatim). This distinction (screen-space backdrop vs. world-space object) is the rule for classifying any future scenery.

## 12. Effects Renderer

`src/rendering/layers/effects.ts` — top canvas layer; the only place where visual chaos is allowed.

- `drawShipImpact` moves verbatim (flash overlay, lightning bolts, sparkles, ring pulse).
- **Timing contract**: the layer receives `shipImpact: { elapsed } | null` in `RenderState` and draws while `elapsed < SHIP_IMPACT_FX_SECONDS`. The `performance.now()` bookkeeping that today lives in `drawScene` becomes the caller's job (component now, engine later) — the renderer stays clock-free.
- **The `Math.random()` exemption**: FX jitter (bolt paths, sparkle placement) is explicitly permitted to be nondeterministic, because FX are fire-and-forget, gameplay-irrelevant, and re-rolled per frame by design. Snapshot tests (§21) therefore either disable the Effects layer or run with a stubbed RNG. Everything below the Effects layer must be deterministic in `(state, time)`.
- **Future effects** (cash-out confetti, chest-open burst, crash debris) each become an FX entry triggered over the event channel (§17) with the same pattern: trigger → lifetime → self-remove. A tiny FX list (`{ kind, startedAt }[]`) inside the layer is the only renderer-owned mutable state in the whole system, and it is reconstructible garbage by definition.

## 13. UI Rendering Boundaries

The split that exists today is correct and becomes law:

**DOM/React owns** (everything textual, interactive, or money-related): top bar, balance, history strip, multiplier readout + "potential win", countdown, crash/cash banners, chest picker, bet controls. Rationale: accessibility, i18n/localization (roadmap), font rendering quality, input handling, and keeping money strictly out of the canvas codepath.

**Canvas owns** (the diegetic world): ocean, creatures, ship, chain, anchor, floor, treasure, FX.

**Boundary rules:**
- The canvas never renders text. If a "world-space number" is ever wanted (e.g., floating +50× at the wreck), it is a DOM element positioned via a renderer-exposed `worldToScreenY` query — the renderer exposes read-only queries, it does not draw HUD.
- DOM never paints over gameplay-critical canvas area with opaque surfaces; overlays remain `pointer-events-none` except interactive panels (as today).
- React state that mirrors render data (e.g., `boost` for the badge) flows from the engine/store, never *from* the renderer. The renderer is a leaf.

## 14. Rendering Performance Strategy

Budget: 60 FPS (16.6 ms) on a mid-range Android phone; the render half of the frame gets ≤ 6 ms.

Ordered by leverage, with explicit "do when" triggers so future commits don't guess:

1. **Keep the single-rAF, full-redraw model.** Dirty rectangles are a net loss for a scene where the camera moves every frame. (Decision, not a TODO.)
2. **Zero per-frame allocation in steady state** (target, enforced in review): reuse scratch objects, hoist arrays (e.g., the treasure table in `drawSeaFloor` becomes module-level data), no closures created inside `frame()`. Gradients are the known exception → rule 3.
3. **Gradient/pattern caching**: cache `createLinearGradient` results keyed by (h, quantized depthRatio). *Do when* profiling shows > 0.5 ms/frame in gradient creation — not before (premature caching adds invalidation bugs).
4. **Culling**: keep Y-culling for creatures/ship/floor (already present, moves into `Camera`). Creature list is also pruned by the *engine* once far above the viewport (simulation concern, noted for completeness).
5. **Static-scene pre-render**: the shipwreck + treasure tableau is static per session → render once to an offscreen canvas at first visibility, then blit. *Do when* floor-visible frames measurably exceed budget; the World layer's structure (one `drawSeaFloor` call site) makes this a local change.
6. **DPR cap stays at 2** (`MAX_DPR`) — retina-3 backing stores triple fill cost for imperceptible gain at these art styles.
7. **No shadows/filters in hot paths**: `shadowBlur` is Canvas 2D's slowest feature; today it appears only on boost-glow and FX (short-lived) — acceptable. New steady-state uses are forbidden; bake glows into sprites instead.
8. **Instrumentation before optimization**: a dev-only frame-time meter (rolling avg + p95, drawn by a debug layer or logged) lands with the SceneRenderer so every later claim in this section is measurable.
9. **Degradation ladder** (future, mobile): reduce bubble count → drop light rays → halve FX particle counts. Encoded as a `quality: "high" | "low"` flag on `SceneRenderer` — reserved in the API now, implemented when a real device needs it.

## 15. Asset Management Strategy

`src/rendering/assets.ts` — deliberately tiny now, shaped for growth:

```ts
interface AssetHandle { readonly image: HTMLImageElement | null; readonly ready: boolean; }
const assets: AssetManager;   // preload(manifest) → Promise<void>; get(key): AssetHandle
```

- **V1**: one manifest entry (`anchor` → `src/assets/anchor.png`). Preload starts at module init (matching today's eager load); draw modules render sprites only when `handle.ready` — reproducing the current "skip blit until loaded" behavior, so first-frame behavior is unchanged.
- **Failure policy**: a failed load leaves `ready = false` forever and logs once; the game keeps running (vector art is the fallback aesthetic). No retries in V1.
- **Growth path (documented, not built)**: sprite atlases (single `drawImage` source, frame rects in the manifest) when sprite count > ~5; theme-scoped manifests for white-label skins (manifest chosen by theme id, same keys); versioned URLs for CDN cache-busting when a backend exists.
- **Rule**: no module-scope `new Image()` side effects outside `assets.ts`; nothing else in the codebase touches asset URLs.

## 16. Future PixiJS Migration Considerations

Decision reaffirmed from the Architecture Blueprint: **Canvas 2D now.** The scene is a few dozen draw calls; Canvas 2D is nowhere near its ceiling, ships zero bytes of dependency, and works everywhere. PixiJS (WebGL/WebGPU) becomes worth it when we want: heavy particle counts, shader effects (water distortion, god-rays), sprite-heavy themes, or hundreds of animated entities.

What this architecture does *now* to keep that door open (and what it deliberately does not):

- **The boundary is the layer list + `RenderState` + `Camera`**, none of which mention Canvas 2D types except the `ctx` parameter in `RenderLayer.render`. Migration = new `PixiSceneRenderer` implementing the same `frame(state, time)` contract with layers as Pixi `Container`s; the engine, state shape, camera math and UI are untouched.
- **Draw modules are the porting unit.** Each `draw/*.ts` file maps to one Pixi display-object factory + per-frame update. Verbatim procedural drawing ports to `Graphics`; the anchor sprite ports to `Sprite`.
- **We do NOT abstract the drawing API** (no `IGraphicsContext` wrapper over Canvas/WebGL). That abstraction is the classic over-engineering trap: it costs complexity every day and still leaks. Accepting "port the draw modules by hand later" is cheaper. This is an explicit, considered trade-off.
- Immediate-mode habits that would fight Pixi's retained mode are already avoided by the layer model: per-layer state is minimal, world objects are data-driven, and z-order is the layer array.

## 17. Renderer Communication

Two channels in, zero channels out:

1. **State channel (every frame, pull)**: `sceneRenderer.frame(renderState, time)`. Today the component assembles `RenderState` from its refs; after Phase 5 the engine produces it. In multiplayer, the network client updates the engine, the engine interpolates/extrapolates, and the renderer still just receives snapshots — reconnects and spectator joins render correctly from the first snapshot by construction.
2. **Event channel (sparse, push, fire-and-forget)**: FX triggers (`shipImpact`, future `cashout`, `crash`, `chestOpened`) via the engine event bus (Phase 5, Step 4.1). Until the bus exists, the equivalent data rides inside `RenderState` (`shipImpact.elapsed` — exactly what V1 does). Rule: events may only ever start *cosmetic* behavior.

**Out: nothing.** The renderer exposes read-only queries (`worldToScreenY`, frame stats) but emits no events, mutates no state, and calls no gameplay code. Input (canvas taps, if ever needed) is DOM → UI → engine; the renderer is not in that path.

React integration: one thin hook (`useSceneRenderer(canvasRef)`) owns construct/resize/dispose. The rAF loop remains outside the renderer (it belongs to the game loop / engine driver), calling `frame()` once per tick — the renderer never schedules itself.

## 18. Rendering Folder Structure

Extends the Sprint-1 `src/rendering/README.md` contract:

```
src/rendering/
├── README.md              (exists — update pointer to this doc)
├── scene-renderer.ts      SceneRenderer: ctx/DPR/resize, camera, layer list, frame()
├── camera.ts              Camera: follow, worldToScreenY, isVisibleY, viewport
├── render-state.ts        RenderState / RenderCreature / RenderTime types
├── theme.ts               ocean palette bands + draw-module color tokens
├── assets.ts              AssetManager + manifest (anchor sprite)
├── layers/
│   ├── background.ts      depth-gradient backdrop
│   ├── environment.ts     light rays, bubbles
│   ├── world.ts           creatures, ship, sea floor iteration + culling
│   ├── actor.ts           chain + anchor + sway math
│   └── effects.ts         ship-impact FX (+ future FX list)
└── draw/
    ├── ship.ts            drawShip
    ├── chain.ts           drawChain
    ├── anchor.ts          drawAnchor
    ├── creatures.ts       drawCreature, drawFish
    ├── sea-floor.ts       drawSeaFloor, drawTreasure
    └── impact-fx.ts       drawShipImpact
```

Conventions: direct module imports, no barrels until a folder has a stable public surface (Sprint-1 decision); `draw/` modules export pure `(ctx, ...) => void` functions and may import only `theme.ts`, `assets.ts` and `src/shared` (correction recorded during R1: additionally, type-only imports from `src/lib/abyss-game` (`CreatureKind`) until the domain types move in the engine extraction, and `SHIP_IMPACT_FX_SECONDS` from `src/game/constants` until the R5 timing handoff removes it); `layers/` may additionally import `camera.ts` and `render-state.ts`; only `scene-renderer.ts` is imported from outside `src/rendering`.

## 19. Rendering Extraction Order

Each step = one commit, behavior-preserving, game playable after each. Order chosen so every commit moves code with *fewer* dependencies than the one after it.

| Commit | Step | Contents | Risk |
|--------|------|----------|------|
| R1 | Pure draw modules | Move the 8 helpers verbatim into `draw/*.ts` (+ `theme.ts` receiving their literals as named tokens, byte-identical values). Component imports them. | Minimal — functions are already standalone. |
| R2 | Camera | `camera.ts`; replace the inline `worldToScreen` closure and the 3 culling checks. | Low — one formula, snapshot-comparable. |
| R3 | RenderState + SceneRenderer + layers | `render-state.ts`, `scene-renderer.ts`, 5 layer files; `drawScene` body redistributes into layers; component builds `RenderState` from its refs and calls `frame()`. | Main step — draw *order* must be preserved exactly; verify against §5's canonical order. |
| R4 | AssetManager | `assets.ts`; module-scope `ANCHOR_IMAGE` deleted; anchor draw takes a handle. | Low — watch first-frame behavior. |
| R5 | FX timing handoff | Impact FX driven by `shipImpact.elapsed` in state; `performance.now()` bookkeeping moves to the caller; frame-time meter (dev-only) added. | Low. |

Corresponds to approved plan Steps 2.1 (R1), 2.2 (R2+R3), 2.3 (R4); R5 closes the clock-free contract. After R5, `AbyssAnchor.tsx` contains simulation + UI only, and Phase 5 (engine extraction) can proceed against a stable rendering API. Each commit ends with the validation pass in §21.

## 20. Risks

1. **Silent visual regressions** — the #1 risk. Verbatim moves can still break via changed call order, lost `save/restore` pairing, or composite-mode leaks (`screen` mode in rays, `shadowBlur` in boost/FX are the sharp edges). Mitigation: §21 screenshot protocol + preserve exact statement order within layers.
2. **Time-source confusion.** `animTime` (accumulated, clamped) vs. wall-clock FX timing differ subtly; mixing them shifts sway/FX speeds. Mitigation: `RenderTime` carries only the accumulated clock; FX elapsed arrives precomputed in state (R5); grep-level review rule: no `performance.now()` under `src/rendering/`.
3. **React re-render interactions.** `drawScene` today closes over `bet` (a stale-closure hazard the refactor *removes*, but during R3 the half-migrated state assembly can accidentally capture stale refs). Mitigation: assemble `RenderState` inside the tick callback from refs only, never from render-scope variables.
4. **Sway math relocation** (R3) moves anchor X/angle computation; the chain endpoint depends on it via ring trig. Mitigation: move the whole block as one unit into the Actor layer; snapshot-compare at multiple `animTime` values.
5. **Performance regression from indirection** (layer dispatch, state assembly per frame). Realistically negligible (5 virtual calls/frame), but the R5 frame-time meter turns this from belief into measurement.
6. **Scope creep** — the standing project risk: extraction commits "improving" visuals or tuning constants. Mitigation: this document is the contract; any visual change is a separate, explicitly-approved task.
7. **Asset-loading behavior change** (R4): eager module-load → manager preload could alter first-paint if done naively. Mitigation: preload still starts at module init; acceptance test covers cold-load first frames.

## 21. Validation Strategy

Every rendering commit passes all of the following before it is committed:

1. **TypeScript**: `tsc --noEmit` clean; lint at the recorded baseline (47 prettier + 1 hook warning) — no new findings.
2. **Screenshot comparison protocol** (manual now, scriptable later): capture the canvas at defined checkpoints *before* and *after* the change and compare side-by-side — (a) idle surface with ship, (b) mid-dive ~0.5 depthRatio with creatures, (c) sea-floor approach with wreck + treasure, (d) ship-impact FX frame, (e) crashed state with crack overlay. FX frames (d) compare structure, not pixels (permitted RNG).
3. **Manual gameplay pass** (the Git-workflow "verify the game" step): full round loop — bet → dive → cash out → crash round → jackpot round → chest pick; confirm sway, chain attachment, culling pop-in margins, boost glow, banners.
4. **Determinism spot-check** (from R3): with the Effects layer disabled, two `frame()` calls with the same `(state, time)` produce identical output (eyeball now; `canvas.toDataURL()` equality once a test harness exists).
5. **Performance sanity** (from R5): frame-time meter shows no regression vs. the previous commit on the dev machine; record the number in the commit message.
6. **Console hygiene**: zero new warnings/errors during a full round.

Future (when the test harness lands, Phase 5+): golden-image tests per layer against fixed `RenderState` fixtures — the layer/state separation defined here is exactly what makes those tests possible.

---

*This document is the single source of architectural truth for rendering. If an extraction commit discovers a conflict between this document and reality, the commit stops and the document is corrected first (Master Rules: never guess).*
