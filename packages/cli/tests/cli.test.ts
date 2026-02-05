import { test, expect, mock } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Mock prompts to avoid interactive prompts
mock.module("prompts", () => ({
  default: {
    select: () => "facilitator",
    text: () => "my-project",
  },
}));

test("CLI file has proper shebang", () => {
  const cliPath = join(import.meta.dir, "../src/cli.ts");
  const content = readFileSync(cliPath, "utf-8");

  expect(content.startsWith("#!/usr/bin/env node")).toBe(true);
});

test("CLI exports main function and entry point", () => {
  const cliPath = join(import.meta.dir, "../src/cli.ts");
  const content = readFileSync(cliPath, "utf-8");

  // Verify main function exists
  expect(content).toContain("async function main");
  // Verify main is called
  expect(content).toContain("main().catch");
});

test("CLI defines all required templates", () => {
  const cliPath = join(import.meta.dir, "../src/cli.ts");
  const content = readFileSync(cliPath, "utf-8");

  const templates = ["facilitator", "server", "client"];
  for (const template of templates) {
    expect(content).toContain(`case "${template}"`);
  }
});

test("CLI template content includes required dependencies", () => {
  const cliPath = join(import.meta.dir, "../src/cli.ts");
  const content = readFileSync(cliPath, "utf-8");

  // Check facilitator template
  expect(content).toContain("@armory/core");
  expect(content).toContain("@armory/facilitator");
  expect(content).toContain("@armory/tokens");

  // Check server template
  expect(content).toContain("@armory/middleware");

  // Check client template
  expect(content).toContain("@armory/client-viem");
});

test("CLI includes proper help text", () => {
  const cliPath = join(import.meta.dir, "../src/cli.ts");
  const content = readFileSync(cliPath, "utf-8");

  expect(content).toContain("Usage:");
  expect(content).toContain("Templates:");
  expect(content).toContain("Examples:");
});

test("CLI includes .gitignore template", () => {
  const cliPath = join(import.meta.dir, "../src/cli.ts");
  const content = readFileSync(cliPath, "utf-8");

  expect(content).toContain("node_modules");
  expect(content).toContain("dist");
  expect(content).toContain(".env");
});

test("CLI package.json templates use ES modules", () => {
  const cliPath = join(import.meta.dir, "../src/cli.ts");
  const content = readFileSync(cliPath, "utf-8");

  // All package.json should have "type": "module"
  const matches = content.match(/"type": "module"/g);
  expect(matches?.length).toBeGreaterThanOrEqual(3);
});

test("CLI facilitator template includes proper imports", () => {
  const cliPath = join(import.meta.dir, "../src/cli.ts");
  const content = readFileSync(cliPath, "utf-8");

  expect(content).toContain("createFacilitatorServer");
  expect(content).toContain("createMemoryQueue");
  expect(content).toContain("MemoryNonceTracker");
});

test("CLI server template includes payment middleware", () => {
  const cliPath = join(import.meta.dir, "../src/cli.ts");
  const content = readFileSync(cliPath, "utf-8");

  expect(content).toContain("paymentMiddleware");
  expect(content).toContain("USDC_BASE");
  expect(content).toContain("Bun.serve");
});

test("CLI client template includes viem integration", () => {
  const cliPath = join(import.meta.dir, "../src/cli.ts");
  const content = readFileSync(cliPath, "utf-8");

  expect(content).toContain("createX402Client");
  expect(content).toContain("privateKeyToAccount");
});
