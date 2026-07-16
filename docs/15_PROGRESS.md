# PROJECT PROGRESS

This document tracks the evolution of the AQUADIVE project.

Rules:

- Update this document only after completing a task.
- Never mark unfinished work as completed.
- Every completed task must include:
  - Task ID
  - Date
  - Summary
  - Files modified
  - Architectural decisions
  - Risks (if any)

Current Status:

Phase 3 (Core Refactor) in progress — TASK 004 Commit 1 complete

Completed Tasks:

---

## TASK 001 — Project Audit

- Date: 2026-07-16
- Summary: Full technical audit of the prototype. Key findings: client-authoritative RNG/economy, jackpot economics far above intended RTP (~1 in 6 rounds reaches the sea floor), 1,400-line game component mixing simulation/rendering/UI, float-based money math, no tests.
- Files modified: none (read-only task).
- Architectural decisions: none (analysis only).
- Risks: jackpot RTP flaw documented; must be preserved during refactor and rebalanced in a separate approved task.

---

## TASK 002 — Architecture Review

- Date: 2026-07-16
- Summary: Complete Architecture Blueprint delivered (Phase 2 deliverable): monorepo layout, framework-agnostic client engine, layered Canvas 2D renderer, event bus, store bridge, protocol-first server boundary with provably-fair RNG, and an 8-milestone strangler-fig migration strategy.
- Files modified: none (design only; blueprint delivered in chat, not yet persisted to /docs).
- Architectural decisions: server-authoritative design; engine outside React; Canvas 2D retained; shared protocol package; money as integer minor units (future step).
- Risks: AQUADIVE_BIBLE.md exists but is empty — content may be missing.

---

## TASK 003 — Project Refactoring Plan

- Date: 2026-07-16
- Summary: Approved 15-step frontend-only refactoring plan (Stages 0–5), each step behavior-preserving and individually revertible; game must remain playable after every step.
- Files modified: none (plan delivered in chat).
- Architectural decisions: verbatim moves over rewrites; characterization tests pin current behavior including known economics bug.
- Risks: two approved corrective micro-deltas deferred to Steps 3.3 and 4.2.

---

## TASK 004 — Foundation Improvements (In Progress)

### Commit 4 — Architectural folder structure

- Date: 2026-07-16
- Summary: Long-term frontend structure prepared: `src/engine`, `src/rendering`, `src/network`, `src/audio`, `src/shared` created, each with a README defining its responsibility, boundaries, and which approved plan steps will populate it. No code moved, no implementations, zero runtime change (documentation files only).
- Files modified: five new `README.md` files (one per folder).
- Architectural decisions: no empty `index.ts` barrels — the project convention (src/lib, src/game) uses direct module imports, and empty barrels would be placeholder code, which the Master Rules forbid; barrels can be added when a folder first exports something. `src/shared` declared the dependency floor (imports from no other layer).
- Risks: none.

### Commit 3 — Static constants extraction

- Date: 2026-07-16
- Summary: Remaining static constants centralized into `src/game/constants.ts` (21 values): player defaults, game-loop/physics limits, golden-boost tuning, countdown tick, rendering/camera constants, ship-impact FX lifetime, and the four background-gradient RGB colors. Byte-identical values; deliberately deduplicated three shared magic numbers (`220` world offset ×3 sites, `1.4`s FX lifetime ×2 sites, bet default ×2 sites). Colors/literals inside standalone draw helpers intentionally deferred to the rendering extraction step; JSX labels deferred to the UI/i18n step.
- Files modified: `src/game/constants.ts` (new), `src/components/AbyssAnchor.tsx` (19 literal sites now reference named constants).
- Architectural decisions: taxonomy split — `config.ts` = gameplay tuning (economics, timings, bets); `constants.ts` = presentation/physics/default constants.
- Risks: none; tsc clean, lint at baseline (47 pre-existing prettier errors + 1 pre-existing hook warning).

### Commit 2 — Type system extraction

- Date: 2026-07-16
- Summary: TypeScript type definitions extracted from the game component into `src/game/types.ts`: `RunState` (moved verbatim) plus `HistoryEntry` and `LastWin` (named versions of previously-inline anonymous `useState` object types). Type-level change only; zero runtime impact.
- Files modified: `src/game/types.ts` (new), `src/components/AbyssAnchor.tsx` (imports the types instead of declaring them).
- Architectural decisions: component-level types live in `src/game/types.ts`; core domain types (`Phase`, `Creature`, `CreatureKind`, `BonusChest`) intentionally remain in `src/lib/abyss-game.ts` until the module reorganization step — no duplicate type sources.
- Risks: none; `tsc --noEmit` clean, lint at baseline. Note: the Write tool silently lost the new file once (suspected antivirus); it was recreated via shell and verified on disk.

### Commit 1 — Step 1.1: Gameplay constants extracted

- Date: 2026-07-16
- Summary: All gameplay tuning constants centralized into a dedicated configuration module. Pure extraction; values byte-identical; no behavior, visual, or rendering change.
- Files modified: `src/game/config.ts` (new), `src/components/AbyssAnchor.tsx` (imports constants instead of hardcoding them).
- Architectural decisions: `src/game/` established as the home of framework-agnostic game modules per the blueprint.
- Risks: none identified; typecheck clean; lint unchanged from baseline (47 pre-existing prettier errors + 1 pre-existing hook warning, both untouched by design).