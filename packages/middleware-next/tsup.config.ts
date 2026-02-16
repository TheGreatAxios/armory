import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "esnext",
  clean: true,
  dts: false,
  sourcemap: false,
  splitting: true,
  treeshake: true,
  external: ["@armory-sh/base", "@armory-sh/facilitator", "next"],
});
