#!/usr/bin/env node
import { join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import prompts from "prompts";
import {
  getMainnets,
  getTestnets,
  getAllTokens,
  getTokensByChain,
  resolveNetwork,
  resolveToken,
  isResolvedNetwork,
  isResolvedToken,
  type NetworkConfig,
  type CustomToken,
} from "@armory-sh/base";
const GITIGNORE = `node_modules
dist
.env
.env.local
*.log
.DS_Store
`;

const EXTENSIONS_INFO = [
  {
    name: "bazaar",
    description: "Resource discovery - let clients discover your API resources",
    package: "@armory-sh/extensions",
    hooks: ["declareDiscoveryExtension", "extractDiscoveryInfo", "validateDiscoveryExtension"],
  },
  {
    name: "siwx",
    description: "Sign-In-With-X - wallet-based authentication",
    package: "@armory-sh/extensions",
    hooks: ["createSIWxHook", "createSIWxPayload", "verifySIWxSignature"],
  },
  {
    name: "payment-id",
    description: "Payment Identifier - idempotency for payment requests",
    package: "@armory-sh/extensions",
    hooks: ["createPaymentIdHook", "declarePaymentIdentifierExtension"],
  },
];

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
    case "bun-server":
      return {
        "package.json": SERVER_PACKAGE(projectName, "bun"),
        "src/index.ts": SERVER_INDEX_BUN,
        "README.md": SERVER_README(projectName, "Bun"),
        ".gitignore": GITIGNORE,
      };

    case "express-server":
      return {
        "package.json": SERVER_PACKAGE(projectName, "express"),
        "src/index.ts": SERVER_INDEX_EXPRESS,
        "README.md": SERVER_README(projectName, "Express"),
        ".gitignore": GITIGNORE,
      };

    case "hono-server":
      return {
        "package.json": SERVER_PACKAGE(projectName, "hono"),
        "src/index.ts": SERVER_INDEX_HONO,
        "README.md": SERVER_README(projectName, "Hono"),
        ".gitignore": GITIGNORE,
      };

    case "elysia-server":
      return {
        "package.json": SERVER_PACKAGE(projectName, "elysia"),
        "src/index.ts": SERVER_INDEX_ELYSIA,
        "README.md": SERVER_README(projectName, "Elysia"),
        ".gitignore": GITIGNORE,
      };

    case "next-server":
      return {
        "package.json": SERVER_PACKAGE(projectName, "next"),
        "src/middleware.ts": SERVER_INDEX_NEXT,
        "README.md": SERVER_README(projectName, "Next.js"),
        ".gitignore": GITIGNORE,
      };

    case "client":
    case "viem-client":
      return {
        "package.json": CLIENT_PACKAGE(projectName, "viem"),
        "src/index.ts": CLIENT_INDEX_VIEM,
        "src/client.ts": CLIENT_IMPL_VIEM,
        "README.md": CLIENT_README(projectName, "Viem"),
        ".gitignore": GITIGNORE,
      };

    case "ethers-client":
      return {
        "package.json": CLIENT_PACKAGE(projectName, "ethers"),
        "src/index.ts": CLIENT_INDEX_ETHERS,
        "README.md": CLIENT_README(projectName, "Ethers"),
        ".gitignore": GITIGNORE,
      };

    case "web3-client":
      return {
        "package.json": CLIENT_PACKAGE(projectName, "web3"),
        "src/index.ts": CLIENT_INDEX_WEB3,
        "README.md": CLIENT_README(projectName, "Web3.js"),
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

const SERVER_PACKAGE = (name: string, framework: string) => {
  const deps: Record<string, string> = {
    bun: `"@armory-sh/base": "latest",
    "@armory-sh/middleware-bun": "latest"`,
    express: `"@armory-sh/base": "latest",
    "@armory-sh/middleware-express": "latest",
    "express": "^5.0.0"`,
    hono: `"@armory-sh/base": "latest",
    "@armory-sh/middleware-hono": "latest",
    "hono": "^4.0.0"`,
    elysia: `"@armory-sh/base": "latest",
    "@armory-sh/middleware-elysia": "latest",
    "elysia": "^1.0.0"`,
    next: `"@armory-sh/base": "latest",
    "@armory-sh/middleware-next": "latest",
    "next": "^15.0.0"`,
  };

  const scripts: Record<string, string> = {
    bun: `"dev": "bun run src/index.ts"`,
    express: `"dev": "bun run --bun src/index.ts"`,
    hono: `"dev": "bun run --bun src/index.ts"`,
    elysia: `"dev": "bun run --bun src/index.ts"`,
    next: `"dev": "bun run --bun src/middleware.ts"`,
  };

  return `{
  "name": "${name}",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    ${scripts[framework]}
  },
  "dependencies": {
    ${deps[framework]}
  }
}`;
};

const SERVER_INDEX_BUN = `import { Bun } from "bun";
import { paymentMiddleware } from "@armory-sh/middleware-bun";
import { USDC_BASE } from "@armory-sh/base";

const app = Bun.serve({
  port: 3000,
  fetch: paymentMiddleware({
    payTo: "0x" + "0".repeat(40),
    network: "base",
    token: USDC_BASE,
    price: () => "2000000",
  }),
});

console.log("Server running on http://localhost:3000");
`;

const SERVER_INDEX_EXPRESS = `import express from "express";
import { paymentMiddleware } from "@armory-sh/middleware-express";
import { USDC_BASE } from "@armory-sh/base";

const app = express();

app.use(
  "/api",
  paymentMiddleware({
    requirements: {
      scheme: "exact",
      network: "base",
      maxAmountRequired: "2000000",
      resource: "https://example.com/api",
      description: "API access",
      mimeType: "application/json",
      payTo: "0x" + "0".repeat(40),
      assetId: USDC_BASE.contractAddress,
    },
  })
);

app.get("/api/data", (req, res) => {
  res.json({ message: "Hello, paid user!", payment: req.payment });
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
`;

const SERVER_INDEX_HONO = `import { Hono } from "hono";
import { paymentMiddleware, createPaymentRequirements } from "@armory-sh/middleware-hono";
import { USDC_BASE } from "@armory-sh/base";

const app = new Hono();

const requirements = createPaymentRequirements({
  payTo: "0x" + "0".repeat(40),
  network: "base",
  assetId: USDC_BASE.contractAddress,
  amount: "2000000",
});

app.use("/api/*", paymentMiddleware({ requirements }));

app.get("/api/data", (c) => {
  const payment = c.get("payment");
  return c.json({ message: "Hello, paid user!", payment });
});

export default app;

// Start server
Bun.serve({
  port: 3000,
  fetch: app.fetch,
});

console.log("Server running on http://localhost:3000");
`;

const SERVER_INDEX_ELYSIA = `import { Elysia } from "elysia";
import { paymentMiddleware } from "@armory-sh/middleware-elysia";
import { USDC_BASE } from "@armory-sh/base";

const app = new Elysia()
  .use(
    paymentMiddleware({
      payTo: "0x" + "0".repeat(40),
      network: "base",
      token: USDC_BASE,
      price: () => "2000000",
    })
  )
  .get("/api/data", () => ({ message: "Hello, paid user!" }))
  .listen(3000);

console.log("Server running on http://localhost:3000");
`;

const SERVER_INDEX_NEXT = `import { createMiddleware } from "@armory-sh/middleware-next";
import { USDC_BASE } from "@armory-sh/base";
import { NextResponse } from "next/server";

const paymentMiddleware = createMiddleware({
  payTo: process.env.PAY_TO_ADDRESS ?? "0x" + "0".repeat(40),
  network: "base",
  token: USDC_BASE,
  price: () => "2000000",
});

export function middleware(request: NextRequest) {
  const response = paymentMiddleware(request);
  if (response) return response;
  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
`;

const SERVER_README = (name: string, framework: string) => `# ${name}

x402 Payment Protected Server (${framework})

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

const CLIENT_PACKAGE = (name: string, library: string) => {
  const deps: Record<string, string> = {
    viem: `"@armory-sh/client-viem": "latest",
    "@armory-sh/base": "latest",
    "viem": "^2.0.0"`,
    ethers: `"@armory-sh/client-ethers": "latest",
    "@armory-sh/base": "latest",
    "ethers": "^6.0.0"`,
    web3: `"@armory-sh/client-web3": "latest",
    "@armory-sh/base": "latest",
    "web3": "^4.0.0"`,
  };

  return `{
  "name": "${name}",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "bun run src/index.ts"
  },
  "dependencies": {
    ${deps[library]}
  }
}`;
};

const CLIENT_INDEX_VIEM = `import { createX402Client } from "@armory-sh/client-viem";
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

const CLIENT_IMPL_VIEM = `import type { X402Client } from "@armory-sh/client-viem";

export async function fetchData(client: X402Client) {
  const response = await client.fetch("http://localhost:3000/api/data");
  return response.json();
}

export const client = { fetchData };
`;

const CLIENT_INDEX_ETHERS = `import { createX402Client } from "@armory-sh/client-ethers";
import { Wallet } from "ethers";
import { USDC_BASE } from "@armory-sh/base";

const wallet = new Wallet(process.env.PRIVATE_KEY ?? "0x" + "1".repeat(64));

const x402Client = createX402Client({
  wallet: { type: "wallet", wallet },
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

const CLIENT_INDEX_WEB3 = `import { createX402Client } from "@armory-sh/client-web3";
import { USDC_BASE } from "@armory-sh/base";

const x402Client = createX402Client({
  wallet: { type: "privateKey", privateKey: process.env.PRIVATE_KEY ?? "0x" + "1".repeat(64) },
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

const CLIENT_README = (name: string, library: string) => `# ${name}

x402-Enabled API Client (${library})

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

function printHelp() {
  console.log("Usage:");
  console.log("  armory <command> [options]");
  console.log("Templates:");
  console.log("  bun-server, express-server, hono-server, elysia-server, next-server");
  console.log("  viem-client, ethers-client, web3-client, facilitator");
  console.log("Examples:");
  console.log("  armory create bun-server my-api");
  console.log("  armory networks");
  console.log("  armory tokens base");

  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                      Armory x402 CLI                             ║
╠══════════════════════════════════════════════════════════════════╣
║  Create payment-enabled apps with the x402 protocol              ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  COMMANDS                                                        ║
║                                                                  ║
║  create <template> [name]    Scaffold a new project              ║
║  networks                     List supported networks             ║
║  tokens [network]             List tokens (optionally by network) ║
║  validate network <value>     Validate a network identifier       ║
║  validate token <value>       Validate a token identifier         ║
║  extensions                   List available extensions           ║
║  verify <url>                 Check x402 headers on an endpoint   ║
║                                                                  ║
╠══════════════════════════════════════════════════════════════════╣
║  TEMPLATES                                                       ║
║                                                                  ║
║  Servers:                                                        ║
║    bun-server          Bun server with middleware                ║
║    express-server      Express v5 server                         ║
║    hono-server         Hono server (with extensions)             ║
║    elysia-server       Elysia server                             ║
║    next-server         Next.js middleware                        ║
║                                                                  ║
║  Clients:                                                        ║
║    viem-client         Viem x402 client                          ║
║    ethers-client       Ethers.js v6 client                       ║
║    web3-client         Web3.js client                            ║
║                                                                  ║
║  Facilitators:                                                   ║
║    facilitator         Payment verification server               ║
║                                                                  ║
╠══════════════════════════════════════════════════════════════════╣
║  EXAMPLES                                                        ║
║                                                                  ║
║  armory create bun-server my-api                                 ║
║  armory create hono-server my-hono-api                           ║
║  armory create viem-client my-client                             ║
║  armory networks                                                 ║
║  armory tokens base                                              ║
║  armory validate network 8453                                    ║
║  armory validate token usdc                                      ║
║  armory verify https://api.example.com/data                      ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
`);
}

function formatNetworkTable(networks: NetworkConfig[]): void {
  console.log("\n┌─────────────────────┬──────────┬────────────────────────────────────┐");
  console.log("│ Name                │ Chain ID │ RPC URL                            │");
  console.log("├─────────────────────┼──────────┼────────────────────────────────────┤");
  for (const network of networks) {
    const name = network.name.padEnd(19);
    const chainId = String(network.chainId).padEnd(8);
    const rpc = network.rpcUrl.substring(0, 34).padEnd(34);
    console.log(`│ ${name} │ ${chainId} │ ${rpc} │`);
  }
  console.log("└─────────────────────┴──────────┴────────────────────────────────────┘\n");
}

function formatTokenTable(tokens: CustomToken[]): void {
  console.log("\n┌─────────┬─────────────────┬──────────┬──────────────────────────────────────────┐");
  console.log("│ Symbol  │ Name            │ Chain ID │ Address                                  │");
  console.log("├─────────┼─────────────────┼──────────┼──────────────────────────────────────────┤");
  for (const token of tokens) {
    const symbol = token.symbol.padEnd(7);
    const name = token.name.substring(0, 15).padEnd(15);
    const chainId = String(token.chainId).padEnd(8);
    const address = token.contractAddress.padEnd(40);
    console.log(`│ ${symbol} │ ${name} │ ${chainId} │ ${address} │`);
  }
  console.log("└─────────┴─────────────────┴──────────┴──────────────────────────────────────────┘\n");
}

function networksCommand(args: string[]): void {
  const showTestnets = args.includes("--testnet") || args.includes("-t");
  const showMainnets = args.includes("--mainnet") || args.includes("-m");

  if (showTestnets) {
    console.log("\n📦 Testnet Networks:\n");
    formatNetworkTable(getTestnets());
  } else if (showMainnets) {
    console.log("\n🌐 Mainnet Networks:\n");
    formatNetworkTable(getMainnets());
  } else {
    console.log("\n🌐 Mainnet Networks:\n");
    formatNetworkTable(getMainnets());
    console.log("📦 Testnet Networks:\n");
    formatNetworkTable(getTestnets());
  }
}

function tokensCommand(args: string[]): void {
  const networkFilter = args.find((a) => !a.startsWith("-"));

  if (networkFilter) {
    const resolved = resolveNetwork(networkFilter);
    if (!isResolvedNetwork(resolved)) {
      console.error(`Unknown network: ${networkFilter}`);
      console.log("Run 'armory networks' to see available networks");
      process.exit(1);
    }

    const tokens = getTokensByChain(resolved.chainId);
    if (tokens.length === 0) {
      console.log(`No tokens configured for ${resolved.name}`);
    } else {
      console.log(`\n💰 Tokens on ${resolved.name} (Chain ID: ${resolved.chainId}):\n`);
      formatTokenTable(tokens);
    }
  } else {
    const tokens = getAllTokens();
    console.log("\n💰 All Configured Tokens:\n");
    formatTokenTable(tokens);
  }
}

function validateCommand(args: string[]): void {
  const [type, value] = args;

  if (!type || !value) {
    console.error("Usage: armory validate <network|token> <value>");
    process.exit(1);
  }

  if (type === "network") {
    const resolved = resolveNetwork(value);
    if (isResolvedNetwork(resolved)) {
      console.log(`\n✅ Valid network: ${resolved.name}`);
      console.log(`   Chain ID: ${resolved.chainId}`);
      console.log(`   CAIP-2: ${resolved.caip2Id}`);
      console.log(`   RPC: ${resolved.rpcUrl}\n`);
    } else {
      console.error(`\n❌ Invalid network: ${value}`);
      console.log("Run 'armory networks' to see available networks\n");
      process.exit(1);
    }
  } else if (type === "token") {
    const resolved = resolveToken(value);
    if (isResolvedToken(resolved)) {
      console.log(`\n✅ Valid token: ${resolved.symbol}`);
      console.log(`   Name: ${resolved.name}`);
      console.log(`   Chain ID: ${resolved.chainId}`);
      console.log(`   Address: ${resolved.contractAddress}`);
      console.log(`   Decimals: ${resolved.decimals ?? 18}\n`);
    } else {
      console.error(`\n❌ Invalid token: ${value}`);
      console.log("Run 'armory tokens' to see available tokens\n");
      process.exit(1);
    }
  } else {
    console.error(`Unknown validation type: ${type}`);
    console.log("Valid types: network, token");
    process.exit(1);
  }
}

function extensionsCommand(): void {
  console.log("\n🔌 Available x402 Extensions:\n");
  console.log("┌───────────────┬─────────────────────────────────────────────────────┐");
  console.log("│ Extension     │ Description                                         │");
  console.log("├───────────────┼─────────────────────────────────────────────────────┤");

  for (const ext of EXTENSIONS_INFO) {
    const name = ext.name.padEnd(13);
    const desc = ext.description.substring(0, 51).padEnd(51);
    console.log(`│ ${name} │ ${desc} │`);
  }

  console.log("└───────────────┴─────────────────────────────────────────────────────┘\n");

  console.log("Usage:");
  console.log("  import { createSIWxHook, createPaymentIdHook } from '@armory-sh/extensions';\n");

  console.log("Extension Hooks:");
  for (const ext of EXTENSIONS_INFO) {
    console.log(`  ${ext.name}: ${ext.hooks.slice(0, 2).join(", ")}`);
  }
  console.log("");
}

async function verifyCommand(args: string[]): Promise<void> {
  const url = args[0];

  if (!url) {
    console.error("Usage: armory verify <url>");
    process.exit(1);
  }

  console.log(`\n🔍 Checking x402 headers on: ${url}\n`);

  try {
    const response = await fetch(url);
    const paymentRequired = response.headers.get("x-payment-required");
    const paymentResponse = response.headers.get("x-payment-response");

    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`x-payment-required: ${paymentRequired ?? "not set"}`);
    console.log(`x-payment-response: ${paymentResponse ?? "not set"}`);

    if (response.status === 402) {
      console.log("\n✅ Endpoint requires payment (402)");
    } else if (paymentRequired) {
      console.log("\n⚠️ Payment header present but status is not 402");
    } else {
      console.log("\nℹ️ No payment required for this endpoint");
    }
  } catch (error) {
    console.error(`\n❌ Failed to fetch: ${error instanceof Error ? error.message : "Unknown error"}`);
    process.exit(1);
  }
}

async function createCommand(args: string[]): Promise<void> {
  const p = prompts;

  let template = args[0];
  let projectName = args[1];

  const templates = [
    "bun-server",
    "express-server",
    "hono-server",
    "elysia-server",
    "next-server",
    "viem-client",
    "ethers-client",
    "web3-client",
    "facilitator",
    "server",
    "client",
  ];

  if (!template) {
    const result = await p.select({
      message: "What do you want to create?",
      choices: [
        { title: "Bun Server - Simple x402 payment server", value: "bun-server" },
        { title: "Express Server - Express v5 with x402 middleware", value: "express-server" },
        { title: "Hono Server - Hono with extensions support", value: "hono-server" },
        { title: "Elysia Server - Elysia/Bun x402 server", value: "elysia-server" },
        { title: "Next.js Middleware - Next.js payment middleware", value: "next-server" },
        { title: "Viem Client - x402 client with Viem", value: "viem-client" },
        { title: "Ethers Client - x402 client with Ethers.js", value: "ethers-client" },
        { title: "Web3 Client - x402 client with Web3.js", value: "web3-client" },
      ],
    });
    template = result;
  }

  if (!templates.includes(template)) {
    console.error(`Unknown template: ${template}`);
    console.log(`Available: ${templates.join(", ")}`);
    process.exit(1);
  }

  if (!projectName) {
    projectName = await p.text({
      message: "Project name?",
      default: `my-${template.replace("-server", "").replace("-client", "")}`,
      validate: (n: string) => /^[a-z0-9-]+$/.test(n) || "Use lowercase, numbers, dashes only",
    });
  }

  const projectPath = join(process.cwd(), projectName);
  console.log(`\nCreating ${template} in ${projectPath}...\n`);

  await mkdir(projectPath, { recursive: true });

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

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printHelp();
    process.exit(0);
  }

  const [command, ...rest] = args;

  switch (command) {
    case "create":
      await createCommand(rest);
      break;

    case "networks":
    case "network":
      networksCommand(rest);
      break;

    case "tokens":
    case "token":
      tokensCommand(rest);
      break;

    case "validate":
      validateCommand(rest);
      break;

    case "extensions":
    case "ext":
      extensionsCommand();
      break;

    case "verify":
    case "inspect":
      await verifyCommand(rest);
      break;

    default:
      console.error(`Unknown command: ${command}`);
      console.log("Run 'armory --help' for usage");
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
