import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  envDir: process.cwd(),

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  test: {
    environment: "node",
  },
});