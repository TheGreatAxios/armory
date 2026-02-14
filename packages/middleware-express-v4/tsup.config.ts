import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "esnext",
  clean: true,
  dts: true,
  sourcemap: false,
  splitting: false,
  external: ["@armory-sh/base", "@armory-sh/facilitator", "express"],
});
