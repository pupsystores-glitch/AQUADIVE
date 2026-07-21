# UI ARCHITECTURE

Status: Proposed design (Sprint 4, Commit 1 candidate — becomes binding on approval)
Scope: The UI layer only (Phase 6 — User Interface). This document changes no code.
Goal: The single source of truth for the Sprint 4 UI extraction. Every UI commit is a mechanical execution step that consults this document; no UI commit should ever need to make an architectural decision.

Precondition: Sprint 4 must not begin until the Sprint 3 close-out is approved (E6 + the bet-basis fix + retrospective, per `docs/16_CURRENT_TASK.md`). This blueprint may be reviewed before that, but Commit U1 may not.

Benchmark: the front ends of production crash games (Aviator, JetX class) — a thin, componentized, responsive shell over an authoritative engine, where every visible number is traceable to engine state or a settlement ledger, and where swapping local settlement for server wallet events (Phase 8) touches one module.

Companion contracts, both binding and untouched by this sprint:

- `docs/05_RENDERING_ARCHITECTURE.md` — the renderer stays a pure `(RenderState, RenderTime) → pixels` consumer.
- `docs/06_ENGINE_ARCHITECTURE.md` — the engine stays the authoritative owner of the round; its facade (`GameEngine`, `EngineDriver`, events, commands, projections) is the fixed input edge of everything designed here. **The engine and renderer are read-only this sprint** (§20 risk 1).

---

## 1. Purpose and Design Goals

Sprint 3 left `src/components/AbyssAnchor.tsx` as a 419-line "UI shell": engine session construction, settlement listeners (all money math), per-frame HUD mirroring, notifications, input handling, and every piece of markup — one file, many responsibilities. Sprint 4 dissolves it into a professional UI framework: a composition root (`GameScreen`), framework-agnostic stores, single-responsibility components, a notification system, and a responsive layout.

Design goals, in priority order:

1. **The settlement layer becomes a module, not a React effect.** Money math (docs/06 §3) moves verbatim into a framework-agnostic wallet store that subscribes to engine events for the lifetime of the game session — not the lifetime of a component mount. This is the Phase 8 seam: server wallet events later replace local computation by swapping this one module.
2. **Session lifetime is fully decoupled from React.** The engine already survives remounts (docs/06 §13); after Sprint 4, so do the wallet, history, and notifications. React components become disposable views over durable session state.
3. **One state, one owner, pull-based.** Every displayed value has exactly one source: engine public state (mirrored per frame) or settlement state (updated per event). Components subscribe to the store slice they render; no value is ever computed in two places (the discipline that caught the bet-basis bug becomes structure).
4. **Single-responsibility components** (Master Rules). Each HUD element, overlay, and control is its own component with a props/store contract, individually testable.
5. **Localization-ready, not localized.** All user-facing strings move to one module (the vision's Localization goal lands as a seam now, an implementation later). The engine already emits no strings (docs/06 §3); after Sprint 4, neither does any component body.
6. **Behavior preservation.** Markup, money math, timings, and interaction behavior move verbatim. The only intended differences are the five sanctioned deltas in §7; approval of this document ratifies them.

## 2. Sprint 4 Objectives

Phase 6 objectives from `docs/04_DEVELOPMENT_ROADMAP.md`, made concrete:

| Roadmap objective | Delivered as |
|---|---|
| UI Architecture | Game session module (§8), store model (§9), component tree (§13), import rules (§6), strings seam (§14) |
| HUD | TopBar, HistoryStrip, MultiplierOverlay, boost badge — store-driven components (§13) |
| Betting Panel | BetControls, QuickBets, ActionButton — the five-state action matrix as a typed derivation (§13.3) |
| Notifications | Event-driven notification store + banner components; `commandRejected` surfaced in dev (§12) |
| Responsive Layout | Mobile layout preserved; desktop breakpoint layout — the one sanctioned visual change (§15) |

Deliverable: Professional UI Framework — `AbyssAnchor.tsx` dissolved into `src/ui/` per §16's target structure, with the game visually and behaviorally identical on mobile viewports.

## 3. Current UI Audit (post-Sprint 3)

What the shell does today, by responsibility (all in `src/components/AbyssAnchor.tsx`):

1. **Session construction** (module scope): `worldRng`, `LocalRoundAuthority`, `GameEngine`, `EngineDriver` — four module-level singletons.
2. **Settlement + display listeners** (mount effect): seven `engine.events.on(...)` subscriptions holding all money math (`betPlaced` debit + bet-basis lock, `cashedOut` credit, `shipImpact` jackpot auto-credit, `chestPicked` delta credit), history recording, and flash timers.
3. **Per-frame HUD sync** (driver sink): `setPhase/setCountdown/setMultiplier/setBoost` once per frame (delta D5).
4. **Canvas stage attach**: `SceneRenderer` construction, resize + frame delegation.
5. **Input → commands**: `placeBet` (with the §3 affordability check), `cashOut`, `pickChest`.
6. **Local UI state**: bet input value, participation/cashed flags (state + ref mirrors), `roundBet` lock, last win, history, chests, flashes.
7. **Markup**: top bar, history strip, multiplier overlay, crash/cashed banners, chest picker, bet controls, quick bets, five-branch action button, two inline SVG icon components.

Numbers: 419 lines; 14 `useState`/`useRef` pairs (5 of them state+ref mirrors of the same fact); 7 event subscriptions; 2 `setTimeout` flash timers; ~30 user-facing string literals; layout fixed at `max-w-md` portrait.

## 4. Problems with the Current Implementation

Defects and structural debts this sprint resolves (each maps to a delta in §7 or a commit in §17):

1. **Settlement lifetime is wrong.** The settlement listeners attach in a mount effect and detach on unmount — but the engine runs at module scope. If the component unmounts mid-round (route change, remount), settlement misses events while the round continues: wallet drift by construction. (V1)
2. **The wallet resets on remount.** `balance`, `history`, `lastWin` are `useState` — a remount resets the player's session money display while the engine world correctly survives (docs/06 §13 made the world durable; the wallet was left behind). (V1)
3. **State + ref mirrors.** `hasCashed`/`hasCashedRef`, `participating`/`participatingRef`, `bet`/`betRef`, `roundBet`/`roundBetRef` — the two-writers pattern docs/06 §20 risk 2 warned about, surviving inside the shell. A store with synchronous reads eliminates every mirror.
4. **Flash timers leak.** `setTimeout(setCashFlash, …)` in listeners fires after unmount and dies with the component; timing state is not owned anywhere. (V2)
5. **`commandRejected` is dropped.** The engine reports every rejected command (docs/06 §12, "UI dev-visible"); the UI subscribes to nothing — silent failures during development. (V2)
6. **Monolithic render.** Every per-frame `multiplier` change re-renders the entire shell — top bar, history, betting panel included. Correct (React bails on equal values) but structurally wasteful and about to get worse with more components. (V3)
7. **Bet input is unsanitized.** `+e.target.value` yields `NaN` on an empty field (`Math.max(0, NaN) = NaN`), which then renders and disables betting until overtyped; the betting cutoff is a magic `0.2` inline. (V4)
8. **Not responsive.** `max-w-md` centered column regardless of viewport; desktop shows a phone-shaped strip. (V5)
9. **One file, many responsibilities** — the Master Rules violation the sprint exists to fix.

## 5. Target UI Architecture

Four layers inside `src/ui/`, with strictly one-way flow:

```
            engine events                    engine projections (per frame)
                 │                                      │
        ┌────────▼──────────┐                  ┌────────▼────────┐
        │  SESSION           │  owns            │                 │
        │  session.ts        │─────────────────▶│  STORES         │
        │  engine + driver + │  writes          │  wallet, round, │
        │  renderer attach   │                  │  notifications, │
        └────────┬──────────┘                  │  bet input      │
                 │ submit(command)              └────────┬────────┘
                 │                                       │ subscribe (useStore)
        ┌────────┴───────────────────────────────────────▼────────┐
        │  COMPONENTS  GameScreen → TopBar / HistoryStrip /        │
        │  MultiplierOverlay / Banners / ChestPicker / BettingPanel│
        └────────────────────────────┬────────────────────────────┘
                                     │ reads
                              ┌──────▼──────┐
                              │  STRINGS     │  strings.ts (localization seam)
                              └─────────────┘
```

- **Session** (§8) is the composition root: constructs engine, driver, stores; wires event subscriptions once per session; exposes `attachCanvas` and `submit`.
- **Stores** (§9–§12) are plain TypeScript modules — no React — holding all durable UI-layer state. React binds via `useSyncExternalStore`.
- **Components** (§13) are stateless views: subscribe to store slices, render markup, submit commands. The only `useState` that survives is genuinely ephemeral view state (none identified today — even the bet input becomes a store, §9).
- **Strings** (§14) is the single home of user-facing text.

## 6. UI Boundaries

Import rules (enforceable in review, grep-level), extending docs/05 §18 and docs/06 §4:

- `src/ui` imports only: its own modules, the engine facade (`@/engine` — never engine internals), `SceneRenderer` + contract types from `src/rendering/scene-renderer`, `src/game` (config, constants, presentation, types), `src/shared`, and `src/components/ui` (the shadcn primitives) where a primitive genuinely fits.
- Nothing under `src/engine`, `src/rendering`, `src/shared`, or `src/game` ever imports from `src/ui`. The dependency arrow points one way: UI consumes the platform.
- **Money math exists in exactly one file**: the wallet store (§10). No component computes a balance, win, or delta; components render store values. (`potentialWin` display math — locked bet × live multiplier — is a derived read in the round store, §11, sourced from the same locked value settlement uses.)
- **No user-facing string literals in components** after U6 (§14); dev-only console output is exempt.
- Wall-clock use in `src/ui`: notification timing only, inside the notification store (§12) — presentation timing is UI-owned per docs/06 §8. No UI code reads engine internals, clocks, or RNG for anything else.
- The affordability check (docs/06 §3 — the one bet validation that is a wallet question) lives in the wallet store, invoked by the session's `submit` path — not in a component.

## 7. Sanctioned Behavior Deltas

The only intended behavior changes of the entire sprint. Approval of this document ratifies them; each is called out again in the commit that lands it. Everything else — markup, money values, timings, interaction states — moves verbatim.

| # | Delta | Today | After | Why sanctioned |
|---|---|---|---|---|
| V1 | Settlement + wallet become session-scoped | Listeners detach on unmount (missable events); balance/history/lastWin reset on remount | Wallet subscribes for the session lifetime; money display survives remount and can never miss an event | Fixes a wallet-drift defect (§4.1–2); the engine-side twin landed in E6 |
| V2 | Notification timing centralized; rejections surfaced | Flash `setTimeout`s live in listeners and die with the component; `commandRejected` ignored | Notification store owns durations (values unchanged: `CASH_FLASH_MS`, `JACKPOT_FLASH_MS`); rejections logged/shown in dev builds only | Fixes timer leaks; makes the engine's error reporting visible (docs/06 §12) |
| V3 | Per-frame sync targets stores, components subscribe to slices | One component re-renders wholesale each frame | Only components whose slice changed re-render (equal-value bailout preserved) | Pure perf/structure; identical pixels |
| V4 | Bet input sanitation | Empty field → `NaN` propagates; cutoff is a magic `0.2` | Non-numeric input → 0; cutoff named `BET_CUTOFF_SECONDS` with the same value | Fixes a real input bug; no honest-path change |
| V5 | Responsive desktop layout | `max-w-md` phone strip at all widths | ≥ `lg` breakpoint: stage + side panel layout (§15); mobile byte-identical | The Phase 6 "Responsive Layout" objective — the sprint's one visual change |

## 8. The Game Session Module

`src/ui/session.ts` — the composition root; the only place engine construction and event wiring exist.

- Owns, at module scope (preserving today's SSR-safe module-singleton semantics exactly): the `world` Rng, `LocalRoundAuthority`, `GameEngine`, `EngineDriver`, and every store instance.
- Wires, once at construction: the wallet store's settlement subscriptions (§10), the notification store's event subscriptions (§12), the round store as the driver's `sync` sink half (§11). These live for the session — never torn down by React (V1).
- `attachCanvas(canvas: HTMLCanvasElement): () => void` — constructs the `SceneRenderer`, calls `driver.attach` with `frame` = resize + render (verbatim from today's sink) and `sync` = round-store write; returns the detach that disposes the renderer and pauses the driver. The renderer remains per-canvas-mount (it holds the 2D context); everything else survives detach, exactly as the driver already guarantees (docs/06 §13).
- `submit(command: EngineCommand)` — the single command edge for components; routes `placeBet` through the wallet store's affordability check (§6) and everything else straight through. The engine remains the validator of all round-state questions (D4).
- Test seam: the module-scope singleton is assembled by an exported `createGameSession(deps)` factory (engine deps injectable — scripted authority, deterministic Rngs, manual tick driver). Production uses the module singleton; tests construct their own session. This is what makes §21's UI tests deterministic, and it costs nothing at runtime.

## 9. Store Model

Deliberate decision, mirroring the engine's no-ECS and the renderer's no-scene-graph stances: **no state-management dependency.** A minimal hand-rolled external store primitive:

- `createStore<T>(initial)` → `{ get(): T; set(next: T): void; subscribe(fn): () => void }` — synchronous, snapshot-based, ~30 lines, in `src/ui/store/store.ts`. Notification of subscribers only when the snapshot reference changes; writers construct new snapshots (equal-value writes bail, preserving D5's quiet-frame behavior).
- React binding: `useStore(store, selector)` built on `useSyncExternalStore` (React 19, built in) in `src/ui/hooks/use-store.ts`. Selector-level subscription gives V3's re-render granularity.
- Why not zustand/jotai/redux: the need is four small stores with synchronous reads; the settlement store **must** be framework-free for Phase 8 (it becomes the client of the server wallet); a new runtime dependency needs owner approval and buys nothing here but API surface. If the store count or derivation complexity grows materially (Phase 8's live-players lists, Phase 9's admin panel), adopting a library then is a mechanical swap behind `useStore` — recorded as the trigger, not built now.
- Stores never subscribe to stores. Derived values are computed in selectors (cheap, pure) or written by the single owner that already owns the inputs. No derivation graph, no effects system.

The four stores and their single writers:

| Store | Writer | Contents |
|---|---|---|
| `wallet-store` | Engine settlement events only (§10) | `balance`, `roundBet` (locked basis), `participating`, `hasCashed`, `lastWin`, `history`, jackpot base |
| `round-store` | Driver `sync` callback only (§11) | Mirror of `EnginePublicState`: `phase`, `countdownSeconds`, `multiplier`, `boost`, `chests`, `chosenChestId` |
| `notification-store` | Engine events + its own timers (§12) | Active banners/flashes with kind + payload + expiry |
| `bet-input-store` | Betting-panel components only | The bet input value (survives remount like everything else; halve/double/quick-set logic lives here, verbatim) |

## 10. The Wallet Store (Settlement Layer)

`src/ui/store/wallet-store.ts` — the settlement layer of docs/06 §3, extracted whole. The heart of the sprint.

- The seven listener bodies move **verbatim**: `betPlaced` (debit + bet-basis lock — the Commit 8 fix preserved exactly: the lock rides the event payload, never the input), `diveStarted` (per-dive display resets), `cashedOut` (credit + history + flash trigger), `crashed` (loss history), `shipImpact` (jackpot auto-credit + history), `chestsRevealed`, `chestPicked` (delta credit + history). Float math with `toFixed(2)` moves byte-for-byte; flash *triggers* delegate to the notification store (§12) while all money math stays here.
- The state+ref mirrors dissolve: the store's snapshot **is** the synchronous read the refs existed to provide. `participatingRef`/`hasCashedRef`/`roundBetRef`/`jackpotMultRef` all become plain fields with one writer.
- Per-round reset (today's `phase === "idle"` effect) becomes a `bettingOpened` listener — event-driven like everything else, closing the last polling-shaped reset.
- `canAfford(amount)` — the §3 affordability check, consumed by the session's submit path (§8).
- **Phase 8 shape, by construction:** every mutation is a response to an engine event carrying the authoritative values. Swapping to server-authoritative wallets = replacing the listener bodies with server wallet-event application; the store's read surface (and therefore every component) is untouched. Integer-minor-units migration (roadmapped, separate task) now has a one-file blast radius — see §20.
- Testable headless: a scripted event sequence in, a balance ledger out (§21). The Commit 8 replay test generalizes into this store's permanent suite.

## 11. The Round Store (Engine-State Mirror)

`src/ui/store/round-store.ts` — the pull-model boundary (docs/06 §12) with one writer: the driver's `sync` callback.

- Snapshot = `EnginePublicState`, stored as received, once per frame while attached. No transformation, no interpretation — the projection map already speaks the UI's vocabulary (docs/06 §13).
- Derived reads live here as selectors: `potentialWin` (wallet `roundBet` × round `multiplier`, the two locked sources — computed in the screen from both stores, keeping stores independent), `canBet` (phase, countdown vs. `BET_CUTOFF_SECONDS`, participation, affordability — the action-matrix input, §13.3).
- When detached (no canvas), the mirror simply stops updating — identical to today, where the sink is the only writer.

## 12. Notification System

`src/ui/store/notification-store.ts` + banner components — Phase 6's "Notifications" objective, sized to what the game actually shows. Not a toast library: the game's notifications are bespoke full-stage overlays and flashes, already designed; sonner (present in dependencies for shadcn) stays out of the game surface.

- Model: `Notification = { kind: "cashFlash" | "jackpotFlash"; payload; expiresAt }` plus derived banner visibility (`crashBanner` and `chestPicker` remain pure phase deriveds from the round store — they are *state*, not notifications, and get no timers).
- Writers: `cashedOut` → cash flash (duration `CASH_FLASH_MS`), `shipImpact` auto-cash → jackpot flash (`JACKPOT_FLASH_MS`) — timers owned by the store (session lifetime, V2), values unchanged. One `setTimeout` per active flash, cleared on supersede; the wall clock is sanctioned here per §6.
- `commandRejected` → dev-only surface (`import.meta.env.DEV`): console.warn with command + reason, and a small dismissible dev banner. Compiled out of production like the renderer's frame meter (docs/05 R5 precedent). Production-facing rejection UX is deliberately deferred — today's UI disables invalid actions before submit, so a user-visible rejection is a bug indicator, not a UX state.
- Extensible by construction for Phase 7/8 consumers (audio cues, "player X cashed out" feeds) — new kinds, same store; recorded, not built.

## 13. Component Decomposition

All markup moves verbatim (class strings byte-identical, mobile) into `src/ui/components/`. The route mounts `GameScreen`; `AbyssAnchor.tsx` is deleted in the final extraction commit (`src/routes/index.tsx` import updated in the same commit).

### 13.1 Screen and HUD

| Component | Renders | Reads |
|---|---|---|
| `GameScreen` | Layout frame; composes everything; owns `attachCanvas` via ref effect | — |
| `TopBar` | Logo block, balance chip | wallet: `balance` |
| `HistoryStrip` | Round-result chips | wallet: `history` |
| `CanvasStage` | The canvas element + attach lifecycle | session: `attachCanvas` |
| `MultiplierOverlay` | Multiplier readout, potential win, spectating hint, countdown hint, boost badge | round: `phase`, `multiplier`, `countdownSeconds`, `boost`; wallet: `participating`, `roundBet` |

### 13.2 Overlays

| Component | Renders | Reads |
|---|---|---|
| `CrashBanner` | "CHAIN SNAPPED" card | round: `phase`, `multiplier` |
| `WinFlash` | "CASHED OUT +X" card | notifications: active flash; wallet: `lastWin` |
| `ChestPicker` | Chest overlay + pick buttons | round: `phase`, `chests`, `chosenChestId`; submits `pickChest` |

### 13.3 Betting Panel

| Component | Renders | Reads |
|---|---|---|
| `BettingPanel` | Bottom controls frame; composes the three below | — |
| `BetControls` | −/+ steppers, amount field with tier label (sanitation V4 lands here) | bet-input store; round: `phase` |
| `QuickBets` | The `QUICK_BETS` row | bet-input store; round: `phase` |
| `ActionButton` | The five-state action | derived action state (below) |

The five-branch conditional becomes a typed derivation — `actionStateFor(round, wallet, betInput): ActionState` — a pure function in `src/ui/components/action-state.ts` returning a discriminated union (`placeBet | betLocked | cashOut | secured | spectating | waiting`), unit-tested exhaustively (§21). The component maps state → markup; the decision logic leaves JSX.

Icons (`AnchorIcon`, `ChestIcon`) move to `src/ui/components/icons.tsx` unchanged.

### 13.4 What stays out

The shadcn library under `src/components/ui/` remains the app-primitive layer; game components use it only where a primitive genuinely matches (none required by this blueprint — the game's controls are bespoke). No new visual design, no theme changes, no animation rework (§20 non-goals).

## 14. Strings and the Localization Seam

`src/ui/strings.ts` — every user-facing string in one typed module: `STRINGS.hud.multiplierLabel`, `STRINGS.actions.cashOut(amount)`, … (functions where text interpolates values, so word order is never hardcoded at call sites — the i18n-proof shape).

- Landing rule: extracted in the same commit as the component that renders them (U6–U7), byte-identical text.
- Money/multiplier display formatting: components render via `formatMultiplier`/`chainTier` (`src/game/presentation.ts`) as today; the scattered `.toFixed(2)` money displays consolidate into a `formatMoney` in the same presentation module — identical output, one definition (Master Rules: no duplicated logic).
- Actual localization (locale files, selection, pluralization) is a roadmapped later task; this seam is its entire prerequisite. The engine's no-strings rule (docs/06 §3) plus this module means localization will touch exactly one layer.

## 15. Responsive Layout (V5)

The sprint's one visual change, landing in the final commit behind screenshot approval:

- **Mobile (< `lg`): byte-identical.** The current `max-w-md` column is the canonical layout; class strings on this path do not change.
- **Desktop (≥ `lg`, 1024 px):** two-region layout — the canvas stage centered at a fixed portrait aspect (the world is designed portrait; docs/05's camera and layers assume a vertical stage), with the betting panel and history in a right-hand side rail (`TopBar` spanning). No canvas-content change: the stage keeps portrait proportions, so `RenderState` consumption and all docs/05 math are untouched — this is CSS-level composition only.
- Breakpoint mechanics: Tailwind responsive variants on the existing classes; components are layout-agnostic (they fill their grid area), so the screen owns the entire responsive decision — one file to review.
- Verification is visual: the §21 screenshot matrix. jsdom cannot assert layout; this commit's gate is explicitly manual.

## 16. Target Folder Structure

```
src/ui/
  session.ts                    # composition root: engine + driver + stores wiring (§8)
  strings.ts                    # user-facing text (§14)
  hooks/
    use-store.ts                # useSyncExternalStore binding + selector (§9)
  store/
    store.ts                    # createStore primitive (§9)
    wallet-store.ts             # settlement layer — all money math (§10)
    round-store.ts              # EnginePublicState mirror (§11)
    notification-store.ts       # flashes + dev rejection surface (§12)
    bet-input-store.ts          # bet amount + stepper/quick-set logic (§9)
  components/
    GameScreen.tsx              # screen composition + responsive layout (§13, §15)
    CanvasStage.tsx
    TopBar.tsx
    HistoryStrip.tsx
    MultiplierOverlay.tsx
    CrashBanner.tsx
    WinFlash.tsx
    ChestPicker.tsx
    BettingPanel.tsx
    BetControls.tsx
    QuickBets.tsx
    ActionButton.tsx
    action-state.ts             # pure action-matrix derivation (§13.3)
    icons.tsx
```

`src/components/AbyssAnchor.tsx` is deleted when `GameScreen` takes over (U6). `src/game/` keeps its role (config, constants, presentation, types) — it is the UI's tuning/presentation dependency, not part of `src/ui`. A `src/ui/README.md` records the layer contract, as every extracted layer has.

## 17. Extraction Order and Estimated Commits

Same discipline as Sprints 2–3: one step per commit, behavior-preserving (modulo §7 deltas, each landing in exactly one identified commit), game playable after every commit, doc corrected first on any conflict. Order chosen so durable state exists before views move, and so UI test tooling exists before markup moves (the E1 precedent):

| Step | Contents | Deltas landing |
|------|----------|----------------|
| U0 | This document (Sprint 4, Commit 1) | — |
| U1 | Session module: `createGameSession` factory + module singleton in `src/ui/session.ts`; store primitive + `useStore` hook; engine/driver/renderer wiring and `attachCanvas` move out of the component (component consumes the session; listeners still component-side) | — |
| U2 | Wallet store: the seven settlement listeners + all money state move to `wallet-store.ts`, subscribed at session scope; component reads via `useStore`; state+ref mirrors deleted; replay/ledger test suite | V1 |
| U3 | UI test harness: jsdom + Testing Library devDependencies (**needs approval**, §20 risk 4); characterization tests pinning the current DOM per phase/participation state against a scripted session — the pins that protect U4–U7 | — |
| U4 | Notification store: flash timers move (durations verbatim), `commandRejected` dev surface added; round store lands as the driver's sync target (component still renders everything) | V2 |
| U5 | Bet-input store + `action-state.ts` derivation, exhaustively tested; input sanitation + `BET_CUTOFF_SECONDS` | V4 |
| U6 | Componentization: `GameScreen` + all §13 components extracted with byte-identical markup; strings module; `formatMoney` consolidation; route flips to `GameScreen`; `AbyssAnchor.tsx` deleted; per-slice subscriptions land | V3 |
| U7 | Responsive layout: desktop breakpoint composition per §15; screenshot matrix approval | V5 |

U6 is the largest step; if review size demands, it splits mechanically (HUD+overlays, then betting panel+screen flip) — step boundaries may be re-cut when reality demands, recorded in CURRENT_TASK the moment it happens (Sprint 2 precedent, R5).

## 18. Multiplayer and Platform Readiness

What this architecture buys Phase 8+, by construction:

- **Server wallet swap = one module** (§10): the wallet store's listeners become appliers of server wallet events; read surface unchanged; no component touched.
- **Other players are new store data**: live bets/cashouts feeds are new stores + new list components; the session already wires event → store.
- **Reconnect/spectator join**: `restore(snapshot)` (docs/06 §14) + the round store's next sync produces a correct HUD frame with no UI work — the mirror has no history dependence.
- **Auto-cashout** (roadmap): a client-side rule module submitting `cashOut` on a threshold — a session-level concern slotting beside the wallet store, no component change (docs/06 §19 confirmed shape).
- **White-label** (vision): strings (§14) + theme (docs/05) + `EngineConfig` (docs/06 §13) are now the complete skin surface.
- **Admin/analytics** (Phases 8–9): the same event stream the stores consume, consumed elsewhere; nothing UI-side blocks it.

## 19. Validation Strategy

Per-commit validation gate (the UI twin of docs/05 §21 / docs/06 §21):

1. `tsc --noEmit` clean.
2. Lint at the recorded baseline (9 errors + 6 warnings entering the sprint; moved/deleted component code is expected to retire pre-existing findings — the new baseline is recorded in the commit, never worsened).
3. **All tests green** (83 entering the sprint; growing per §21). The engine determinism spot-check stays in force.
4. **Engine/renderer freeze check**: `git diff --stat src/engine src/rendering src/shared` is empty for every Sprint 4 commit. Any needed platform change stops the commit and goes back to the owner (doc corrected first).
5. Production build passes; dev-server SSR smoke test (HTTP 200 with canvas markup — the session module-scope construction must stay SSR-safe).
6. Console hygiene (no new warnings; U4 onward, `commandRejected` dev output only when commands are actually rejected).
7. Manual gameplay pass (docs/18 step 2, developer): full loop — bet → dive → cash out → crash round → jackpot round → chest pick → spectate; plus per-commit focus items named in the commit message (U2: balance ledger through every settlement path incl. remount mid-round; U5: input edge cases; U6: pixel-compare against pre-commit screenshots on mobile width).
8. U7 only: screenshot matrix at 375×667, 390×844, 768×1024, 1280×800, 1440×900 — mobile widths byte-identical to pre-U7 captures; desktop layouts approved by the owner before merge.

Money-path verification is test-driven, not manual-only: the U2 replay suite is the gate that the extracted math is the same math (§21).

## 20. Risks and Non-Goals

Risks:

1. **Settlement drift during extraction** — the top risk: money math moving out of the component. Mitigation: the Commit 8 replay-test pattern generalizes *before* the move (U2 lands store + tests in one commit; golden ledger values pinned from event sequences covering every settlement path: loss, cashout, jackpot auto-cash, chest delta, spectator, remount-mid-round). Float results must be bit-identical — the pins assert exact values including `toFixed` artifacts.
2. **Markup drift during componentization.** Mitigation: U3's DOM characterization pins (asserting rendered text and structure) run before any markup moves; class strings are moved byte-identically (mobile path) and spot-checked by the R1-style literal comparison where practical; U6's manual pass includes screenshot comparison at mobile width.
3. **Two writers mid-migration** (the standing Sprint 2/3 risk): each commit moves a state's ownership *completely* — store becomes the writer and the component mirror is deleted in the same commit; never both.
4. **New devDependencies** (jsdom, @testing-library/react, @testing-library/user-event) need explicit approval — flagged here so U3 isn't blocked silently (vitest/E1 precedent). React 19 requires current Testing Library versions; pinned at install.
5. **Session factory vs. module singleton**: the test seam (§8) must not change production initialization order (module-scope construction is what makes remount-survival work). Mitigation: U1's tests cover construction order and remount semantics explicitly.
6. **Scope creep** — the standing risk, sharpest in a UI sprint: "while we're in there" visual polish, animation changes, new UX states. V5 is the only sanctioned visual change; everything else is byte-identical markup. Redesign is a future approved task.

Non-goals (explicitly out of scope):

- **No integer-minor-units money migration.** It remains a separate roadmapped task — but this sprint reduces it to a one-file change (§10). Recommendation, for owner decision at close-out: schedule it as the task immediately after Sprint 4, while the wallet store is fresh.
- No localization implementation — only the §14 seam.
- No visual redesign, theme change, animation, or sound (audio is Phase 7).
- No auto-cashout, tournaments, achievements, or social features (recorded shapes only, §18).
- No server, transport, or protocol work (Phase 8); no state-management library (§9 records the adoption trigger).
- No engine or renderer change of any kind (§19 gate 4).
- No accessibility overhaul — semantic buttons and disabled states move as-is; a dedicated a11y pass is a recorded future task.

## 21. Testing Strategy

The suite enters at 83 green (node-env vitest) and grows in four tiers:

1. **Wallet ledger tests (U2, node env — no new deps).** The settlement store driven headless by scripted engine event sequences (reusing the `SequenceRng`/scripted-authority harness): golden balance ledgers for every settlement path; the Commit 8 basis-lock replay generalized; remount-mid-round (unsubscribe never happens — assert by construction: one session-scope subscription, events during a simulated detach still applied); float pins exact.
2. **Pure-logic tests (U1, U4, U5 — node env).** Store primitive semantics (set/subscribe/bailout); notification store with fake timers (flash lifetime, supersede, dev-only rejection gating); `actionStateFor` — the full matrix (phase × participating × hasCashed × canBet), exhaustive, replacing eyeballed JSX branches with proven logic; bet-input store (halve floor at 1, double cap at balance, quick-set, V4 sanitation cases).
3. **DOM characterization + component tests (U3 onward, jsdom — needs approval).** U3 pins the *current* monolith's rendered output per state (a scripted session drives ticks; assertions on roles/text, deliberately not on class names, so verbatim moves keep them green); U6 keeps the same pins running against `GameScreen`, proving the decomposition rendered the same UI; smoke tests per extracted component with store fixtures.
4. **What is deliberately not automated:** visual identity (screenshots, §19.8), canvas output (covered by the frozen renderer's own guarantees), and responsive layout (jsdom has no layout engine — U7 is a manual gate by design).

Engine suite: untouched and green throughout — it is the platform's regression net while the UI moves above it.

## 22. Definition of Done

Sprint 4 is done when all of the following hold:

1. `src/ui/` matches §16 exactly; `AbyssAnchor.tsx` is deleted; the route mounts `GameScreen`.
2. All five §7 deltas landed, each in its named commit; no other behavior change occurred (pins green throughout).
3. Money math exists in exactly one module (`wallet-store.ts`), bit-identical results proven by the ledger suite; settlement subscriptions are session-scoped (wallet survives remount, misses no event).
4. Every displayed value has one owner per §9's writer table; zero state+ref mirrors remain; no component computes money.
5. Notifications (flashes + dev rejection surface) run through the notification store; no `setTimeout` in any component.
6. All user-facing strings live in `strings.ts`; no string literals in component bodies.
7. Mobile layout is byte-identical (screenshot-verified); the desktop layout is owner-approved per §19.8.
8. Every commit passed the §19 gate: tsc clean, lint at/below baseline, all tests green, engine/renderer diff empty, prod build + SSR smoke, manual gameplay pass.
9. Test suite covers §21 tiers 1–3; final count and baseline recorded in PROGRESS.
10. Docs current: 04 (Phase 6 status), 14/15/16 tracking, `src/ui/README.md`, this document corrected wherever reality disagreed (corrections in the conflicting commit, per the standing rule).
11. Sprint 4 close-out + retrospective recorded in PROGRESS (Sprint 2/3 pattern), including the recommendation decision on the minor-units follow-on task (§20).

---

*This document is the single source of architectural truth for the UI layer. If a UI commit discovers a conflict between this document and reality, the commit stops and the document is corrected first (Master Rules: never guess).*
