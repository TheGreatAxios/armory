import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/bazaar.ts",
    "src/sign-in-with-x.ts",
    "src/payment-identifier.ts",
  ],
  format: ["esm"],
  target: "esnext",
  clean: true,
  sourcemap: false,
  splitting: false,
  dts: false,
});
