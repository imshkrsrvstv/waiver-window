import { defineConfig } from "vite";
export default defineConfig(({ mode }) => ({
  base: "./",
  define: { __LOCAL_DEMO__: JSON.stringify(mode === "demo") },
  build: { target: "es2022", sourcemap: false },
  server: { strictPort: true },
}));
