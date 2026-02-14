/**
 * Mock Facilitator for Testing
 *
 * Provides a mock facilitator server that can verify/settle payments
 * without requiring actual blockchain interactions.
 */

import { serve } from "bun";

export interface FacilitatorVerifyRequest {
  payload: unknown;
  requirements: Record<string, unknown>;
  options?: Record<string, unknown>;
}

export interface FacilitatorVerifyResponse {
  success: boolean;
  payerAddress?: string;
  balance?: string;
  requiredAmount?: string;
  error?: string;
}

export interface FacilitatorSettleRequest {
  payload: unknown;
  requirements: Record<string, unknown>;
}

export interface FacilitatorSettleResponse {
  success: boolean;
  txHash?: string;
  error?: string;
}

export interface MockFacilitatorOptions {
  port?: number;
  alwaysVerify?: boolean;
  alwaysSettle?: boolean;
  verifyDelay?: number;
  settleDelay?: number;
}

let nextPort = 9100;

export const createMockFacilitator = async (
  options: MockFacilitatorOptions = {}
): Promise<{ url: string; close: () => Promise<void> }> => {
  const {
    port = nextPort++,
    alwaysVerify = true,
    alwaysSettle = true,
    verifyDelay = 0,
    settleDelay = 0,
  } = options;

  const server = serve({
    port,
    hostname: "127.0.0.1",
    async fetch(req) {
      const url = new URL(req.url);
      const path = url.pathname;

      const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      };

      if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
      }

      if (req.method !== "POST") {
        return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
      }

      if (path === "/verify") {
        const body = (await req.json()) as FacilitatorVerifyRequest;

        if (verifyDelay > 0) {
          await new Promise((resolve) => setTimeout(resolve, verifyDelay));
        }

        const result: FacilitatorVerifyResponse = alwaysVerify
          ? {
              success: true,
              payerAddress: extractPayerAddress(body.payload),
              balance: "10000000",
              requiredAmount: "1000000",
            }
          : {
              success: false,
              error: "Verification failed (mock error)",
            };

        return Response.json(result, { headers: corsHeaders });
      }

      if (path === "/settle") {
        const body = (await req.json()) as FacilitatorSettleRequest;

        if (settleDelay > 0) {
          await new Promise((resolve) => setTimeout(resolve, settleDelay));
        }

        const result: FacilitatorSettleResponse = alwaysSettle
          ? {
              success: true,
              txHash: "0x" + "a".repeat(64),
            }
          : {
              success: false,
              error: "Settlement failed (mock error)",
            };

        return Response.json(result, { headers: corsHeaders });
      }

      return Response.json({ error: "Not found" }, { status: 404, headers: corsHeaders });
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 50));

  return {
    url: `http://127.0.0.1:${port}`,
    close: async () => {
      server.stop();
      await new Promise((resolve) => setTimeout(resolve, 50));
    },
  };
};

function extractPayerAddress(payload: unknown): string {
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      return "0x0000000000000000000000000000000000000000000000";
    }
  }

  if (typeof payload === "object" && payload !== null && "x402Version" in payload) {
    const p = payload as Record<string, unknown>;
    if ("payload" in p && typeof p.payload === "object" && p.payload !== null) {
      const schemePayload = p.payload as Record<string, unknown>;
      if ("authorization" in schemePayload && typeof schemePayload.authorization === "object") {
        const auth = schemePayload.authorization as Record<string, unknown>;
        if ("from" in auth && typeof auth.from === "string") {
          return auth.from;
        }
      }
    }
  }

  if (typeof payload === "object" && payload !== null && "from" in payload) {
    const p = payload as Record<string, unknown>;
    if (typeof p.from === "string") {
      return p.from;
    }
  }

  return "0x0000000000000000000000000000000000000000000000";
}
