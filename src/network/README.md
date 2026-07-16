# src/network

Round service boundary (frontend side).

## Responsibility

Defines how the game receives authoritative round events and sends player
commands: the `RoundService` interface, a local offline implementation
(today's client-side rounds behind tomorrow's server API), and — in a later
phase — the WebSocket client that talks to the real backend.

## Boundaries

- Protocol-shaped events in, player commands out; no game logic.
- No React; consumers subscribe through the engine's event bus/stores.
- Server code never lives here — this is the client edge only.

## Planned contents (per the approved architecture blueprint)

`RoundService` interface and `LocalRoundService` (blueprint milestone M2);
`WsRoundService`, reconnect/resync, protocol validation (milestone M5).
