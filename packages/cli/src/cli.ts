#!/usr/bin/env node
import { join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import prompts from "prompts";

const GITIGNORE = `node_modules
dist
.env
.env.local
*.log
.DS_Store
`;

function getTemplateFiles(template: string, projectName: string): Record<string, string> {
  switch (template) {
    case "facilitator":
      return {
        "package.json": FACILITATOR_PACKAGE(projectName),
        "src/index.ts": FACILITATOR_INDEX,
        "README.md": FACILITATOR_README(projectName),
        ".gitignore": GITIGNORE,
      };

    case "server":
      return {
        "package.json": SERVER_PACKAGE(projectName),
        "src/index.ts": SERVER_INDEX,
        "README.md": SERVER_README(projectName),
        ".gitignore": GITIGNORE,
      };

    case "client":
      return {
        "package.json": CLIENT_PACKAGE(projectName),
        "src/index.ts": CLIENT_INDEX,
        "src/client.ts": CLIENT_IMPL,
        "README.md": CLIENT_README(projectName),
        ".gitignore": GITIGNORE,
      };

    default:
      return {};
  }
}

const FACILITATOR_PACKAGE = (name: string) => `{
  "name": "${name}",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "bun run src/index.ts",
    "start": "bun run src/index.ts"
  },
  "dependencies": {
    "@armory-sh/base": "latest",
    "@armory-sh/middleware": "latest"
  }
}`;

const FACILITATOR_INDEX = `// Note: The facilitator pattern has changed.
// See @armory-sh/middleware packages for current implementation.
// This is a basic placeholder.

console.log("Facilitator pattern has changed. See @armory-sh/middleware packages.");
`;

const FACILITATOR_README = (name: string) => `# ${name}

x402 Payment Facilitator Server

## Environment

\`\`\`bash
# Required
PRIVATE_KEY=0x...your_private_key

# Optional
PORT=3000
HOST=0.0.0.0
BASE_RPC_URL=https://mainnet.base.org
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
\`\`\`

## Endpoints

- \`GET /\` - Health check
- \`GET /supported\` - List supported networks
- \`POST /verify\` - Verify payment
- \`POST /settle\` - Settle payment

## Development

\`\`\`bash
bun install
bun run dev
\`\`\`
`;

const SERVER_PACKAGE = (name: string) => `{
  "name": "${name}",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "bun run src/index.ts"
  },
  "dependencies": {
    "@armory-sh/base": "latest",
    "@armory-sh/middleware": "latest"
  }
}`;

const SERVER_INDEX = `import { Bun } from "bun";
import { paymentMiddleware } from "@armory-sh/middleware-bun";
import { USDC_BASE } from "@armory-sh/base";

const app = Bun.serve({
  port: 3000,
  fetch: paymentMiddleware({
    payTo: "0x" + "0".repeat(40), // TODO: Replace with your address
    network: "base",
    token: USDC_BASE,
    price: () => "2000000", // 2 USDC
  }),
});

console.log("Server running on http://localhost:3000");
`;

const SERVER_README = (name: string) => `# ${name}

x402 Payment Protected Server

## Development

\`\`\`bash
bun install
bun run dev
\`\`\`

## Testing

\`\`\`bash
curl http://localhost:3000/api/data
\`\`\`
`;

const CLIENT_PACKAGE = (name: string) => `{
  "name": "${name}",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "bun run src/index.ts"
  },
  "dependencies": {
    "@armory-sh/client-viem": "latest",
    "@armory-sh/base": "latest"
  }
}`;

const CLIENT_INDEX = `import { createX402Client } from "@armory-sh/client-viem";
import { privateKeyToAccount } from "viem/accounts";
import { USDC_BASE } from "@armory-sh/base";
import { client } from "./client.js";

const account = privateKeyToAccount(process.env.PRIVATE_KEY ?? "0x" + "1".repeat(64));

const x402Client = createX402Client({
  wallet: { type: "account", account },
  token: USDC_BASE,
  version: 2,
});

async function main() {
  const response = await x402Client.fetch("http://localhost:3000/api/data");
  const data = await response.json();
  console.log("Response:", data);
}

main().catch(console.error);
`;

const CLIENT_IMPL = `import type { X402Client } from "@armory-sh/client-viem";

export async function fetchData(client: X402Client) {
  const response = await client.fetch("http://localhost:3000/api/data");
  return response.json();
}

export const client = { fetchData };
`;

const CLIENT_README = (name: string) => `# ${name}

x402-Enabled API Client

## Environment

\`\`\`bash
PRIVATE_KEY=0x...your_private_key
\`\`\`

## Development

\`\`\`bash
bun install
bun run dev
\`\`\`
`;

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║                  Armory x402 CLI                               ║
║                                                              ║
║  Create payment-enabled apps with x402 protocol               ║
║                                                              ║
║  Usage:                                                      ║
║    npx armory-cli create <template> [project-name]           ║
║                                                              ║
║  Templates:                                                  ║
║    facilitator  - Payment verification & settlement server    ║
║    server       - Simple x402 server                         ║
║    client       - x402 client wrapper                        ║
║                                                              ║
║  Examples:                                                    ║
║    npx armory-cli create facilitator my-facilitator          ║
║    npx armory-cli create server my-api                       ║
║    npx armory-cli create client my-app                       ║
║                                                              ║
╚════════════════════════════════════════════════════════════════╝
    `);
    process.exit(0);
  }

  const [command, ...rest] = args;

  if (command !== "create") {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
  }

  const p = prompts;

  let template = rest[0];
  let projectName = rest[1];

  // Interactive mode
  if (!template) {
    const result = await p.select({
      message: "What do you want to create?",
      choices: [
        { title: "Facilitator - Payment verification & settlement server", value: "facilitator" },
        { title: "Server - Simple x402 server", value: "server" },
        { title: "Client - x402-enabled fetch wrapper", value: "client" },
      ],
    });
    template = result;
  }

  const templates = ["facilitator", "server", "client"];
  if (!templates.includes(template)) {
    console.error(`Unknown template: ${template}`);
    console.log(`Available: ${templates.join(", ")}`);
    process.exit(1);
  }

  if (!projectName) {
    projectName = await p.text({
      message: "Project name?",
      default: `my-${template}`,
      validate: (n: string) => /^[a-z0-9-]+$/.test(n) || "Use lowercase, numbers, dashes only",
    });
  }

  const projectPath = join(process.cwd(), projectName);
  console.log(`\nCreating ${template} in ${projectPath}...\n`);

  await mkdir(projectPath, { recursive: true });

  // Write files based on template
  const files = getTemplateFiles(template, projectName);
  for (const [path, content] of Object.entries(files)) {
    const fullPath = join(projectPath, path);
    const dir = join(projectPath, path.split("/").slice(0, -1).join("/"));
    await mkdir(dir, { recursive: true });
    await writeFile(fullPath, content);
    console.log(`  ✓ ${path}`);
  }

  console.log(`\n✓ Project created!\n`);
  console.log(`Next steps:`);
  console.log(`  cd ${projectName}`);
  console.log(`  bun install`);
  console.log(`  bun run dev\n`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
