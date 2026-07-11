import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // vitest reads this block; it is ignored by vite itself
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
} as Parameters<typeof defineConfig>[0]);
