import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/routes.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "esnext",
  external: ["@armory-sh/base", "@armory-sh/extensions", "express"],
});
