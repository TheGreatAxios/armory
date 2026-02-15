/**
 * x402 Express E2E Tests
 *
 * Tests x402 SDK compatibility with Express middleware
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";
import { createExpressServer } from "../general/servers";
import {
  TEST_PRIVATE_KEY,
  TEST_PAY_TO_ADDRESS,
  TEST_AMOUNT,
  TEST_NETWORK,
  TEST_CHAIN_ID,
} from "../general/config";

describe("[e2e-express]: x402 SDK Compatibility", () => {
  let server: Awaited<ReturnType<typeof createExpressServer>> | null = null;

  test("creates and starts Express server", async () => {
    server = await createExpressServer({
      payTo: TEST_PAY_TO_ADDRESS,
      amount: TEST_AMOUNT,
      network: TEST_NETWORK,
    });

    expect(server.url).toBeTruthy();
  });

  test("accepts x402 V2 payment", async () => {
    if (!server) throw new Error("Server not started");

    const account = privateKeyToAccount(TEST_PRIVATE_KEY);
    const client = new x402Client()
      .register(`eip155:${TEST_CHAIN_ID}`, new ExactEvmScheme(account), 2);
    const fetchWithPayment = wrapFetchWithPayment(fetch, client);

    const response = await fetchWithPayment(`${server.url}/api/test`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.middleware).toBe("express");
  });
});
