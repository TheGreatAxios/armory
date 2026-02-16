import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  target: "esnext",
  clean: true,
  dts: false,
  sourcemap: false,
  splitting: true,
  treeshake: true,
})
