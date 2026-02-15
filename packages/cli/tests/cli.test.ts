import { describe, test, expect, mock } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Mock prompts to avoid interactive prompts
mock.module("prompts", () => ({
  default: {
    select: () => "facilitator",
    text: () => "my-project",
  },
}));

describe("[unit|cli]: CLI Tests", () => {
  test("[CLI|shebang] - file has proper shebang", () => {
    const cliPath = join(import.meta.dir, "../src/cli.ts");
    const content = readFileSync(cliPath, "utf-8");

    expect(content.startsWith("#!/usr/bin/env node")).toBe(true);
  });

  test("[CLI|exports] - exports main function and entry point", () => {
    const cliPath = join(import.meta.dir, "../src/cli.ts");
    const content = readFileSync(cliPath, "utf-8");

    // Verify main function exists
    expect(content).toContain("async function main");
    // Verify main is called
    expect(content).toContain("main().catch");
  });

  test("[CLI|templates] - defines all required templates", () => {
    const cliPath = join(import.meta.dir, "../src/cli.ts");
    const content = readFileSync(cliPath, "utf-8");

    const templates = ["facilitator", "server", "client"];
    for (const template of templates) {
      expect(content).toContain(`case "${template}"`);
    }
  });

  test("[CLI|dependencies] - template content includes required dependencies", () => {
    const cliPath = join(import.meta.dir, "../src/cli.ts");
    const content = readFileSync(cliPath, "utf-8");

    // Check facilitator template
    expect(content).toContain("@armory-sh/base");
    expect(content).toContain("@armory-sh/facilitator");
    expect(content).toContain("@armory-sh/tokens");

    // Check server template
    expect(content).toContain("@armory-sh/middleware");

    // Check client template
    expect(content).toContain("@armory-sh/client-viem");
  });

  test("[CLI|help] - includes proper help text", () => {
    const cliPath = join(import.meta.dir, "../src/cli.ts");
    const content = readFileSync(cliPath, "utf-8");

    expect(content).toContain("Usage:");
    expect(content).toContain("Templates:");
    expect(content).toContain("Examples:");
  });

  test("[CLI|gitignore] - includes .gitignore template", () => {
    const cliPath = join(import.meta.dir, "../src/cli.ts");
    const content = readFileSync(cliPath, "utf-8");

    expect(content).toContain("node_modules");
    expect(content).toContain("dist");
    expect(content).toContain(".env");
  });

  test("[CLI|esm] - package.json templates use ES modules", () => {
    const cliPath = join(import.meta.dir, "../src/cli.ts");
    const content = readFileSync(cliPath, "utf-8");

    // All package.json should have "type": "module"
    const matches = content.match(/"type": "module"/g);
    expect(matches?.length).toBeGreaterThanOrEqual(3);
  });

  test("[CLI|facilitator-imports] - facilitator template includes proper imports", () => {
    const cliPath = join(import.meta.dir, "../src/cli.ts");
    const content = readFileSync(cliPath, "utf-8");

    expect(content).toContain("createFacilitatorServer");
    expect(content).toContain("createMemoryQueue");
    expect(content).toContain("MemoryNonceTracker");
  });

  test("[CLI|server-middleware] - server template includes payment middleware", () => {
    const cliPath = join(import.meta.dir, "../src/cli.ts");
    const content = readFileSync(cliPath, "utf-8");

    expect(content).toContain("paymentMiddleware");
    expect(content).toContain("USDC_BASE");
    expect(content).toContain("Bun.serve");
  });

  test("[CLI|client-integration] - client template includes viem integration", () => {
    const cliPath = join(import.meta.dir, "../src/cli.ts");
    const content = readFileSync(cliPath, "utf-8");

    expect(content).toContain("createX402Client");
    expect(content).toContain("privateKeyToAccount");
  });
});
