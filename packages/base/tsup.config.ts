import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/client-hooks-runtime.ts", "src/types/hooks.ts"],
  format: ["esm"],
  target: "esnext",
  clean: false,
  sourcemap: false,
  splitting: true,
  treeshake: true,
  dts: false,
});
