import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "esnext",
  clean: false,
  sourcemap: false,
  splitting: true,
  treeshake: true,
  dts: false,
})
