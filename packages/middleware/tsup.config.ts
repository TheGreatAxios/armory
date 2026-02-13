import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "esnext",
  clean: true,
  dts: true,
  sourcemap: false,
  splitting: false,
  external: [
    "@armory-sh/middleware-bun",
    "@armory-sh/middleware-express",
    "@armory-sh/middleware-hono",
    "@armory-sh/middleware-elysia",
  ],
});
