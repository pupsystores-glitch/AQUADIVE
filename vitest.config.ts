// Vitest configuration (Sprint 3, Commit E1; docs/06_ENGINE_ARCHITECTURE.md §21).
//
// Deliberately separate from vite.config.ts: the app config wraps
// @lovable.dev/vite-tanstack-config, whose TanStack Start / nitro / SSR
// plugin stack has no place in a unit-test pipeline. Tests only need the
// `@` path alias, resolved natively from tsconfig paths.
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
