import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      reporter: ["text", "lcov"],
      include: ["src/compliance/**", "src/workflows/**", "src/audit/**"],
    },
  },
  resolve: {
    alias: {
      "@types": resolve(__dirname, "src/types"),
      "@agents": resolve(__dirname, "src/agents"),
      "@workflows": resolve(__dirname, "src/workflows"),
      "@compliance": resolve(__dirname, "src/compliance"),
      "@data": resolve(__dirname, "src/data"),
      "@audit": resolve(__dirname, "src/audit"),
      "@utils": resolve(__dirname, "src/utils"),
    },
  },
});
