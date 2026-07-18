// EngineCommand — the engine's input edge (docs/06_ENGINE_ARCHITECTURE.md
// §13). These shapes ARE the future protocol messages (client → server,
// Phase 8). Defined in E3 so the event map's `commandRejected` payload is
// finalized together with the bus (§12: "shapes finalized in the extraction
// commit that lands the bus"); the command QUEUE that consumes these lands
// in E5.

export type EngineCommand =
  | { type: "placeBet"; amount: number }
  | { type: "cashOut" }
  | { type: "pickChest"; chestId: 0 | 1 | 2 };
