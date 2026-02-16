import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/routes.ts"],
  format: ["esm"],
  target: "esnext",
  clean: true,
  dts: true,
  sourcemap: false,
  splitting: true,
  treeshake: true,
  external: ["@armory-sh/base", "@armory-sh/extensions", "elysia"],
});
