import type {
  PaymentPayload,
  PaymentRequirements,
} from "@armory/base";
import {
  NETWORKS,
  getNetworkByChainId,
  isPaymentV1,
} from "@armory/base";
import type { NonceTracker } from "./nonce/types.js";
import type { PaymentQueue, SettleJob, SettleResult } from "./queue/types.js";
import { verifyPayment } from "./verify.js";
import { settlePayment } from "./settle.js";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

type HexString = `0x${string}`;

export interface FacilitatorServerOptions {
  port?: number;
  host?: string;
  nonceTracker: NonceTracker;
  paymentQueue: PaymentQueue;
  rpcUrls?: Record<number | string, string>;
  privateKey?: HexString;
  queuePollInterval?: number;
  maxWorkers?: number;
}

interface HealthResponse {
  status: "ok";
  timestamp: number;
  queue: { pending: number; processing: number; completed: number };
}

interface SupportedNetworksResponse {
  networks: Array<{ name: string; chainId: number; caip2Id: string }>;
}

interface VerifyRequestBody {
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
  skipBalanceCheck?: boolean;
  skipNonceCheck?: boolean;
}

interface VerifyResponseBody {
  success: boolean;
  payerAddress?: string;
  balance?: string;
  requiredAmount?: string;
  error?: string;
}

interface SettleRequestBody {
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
  enqueue?: boolean;
}

interface SettleResponseBody {
  success: boolean;
  jobId?: string;
  txHash?: string;
  error?: string;
  timestamp: number;
}

export interface FacilitatorServer {
  stop(): void;
  url: string;
  port: number;
}

const ALLOWED_HEADERS = [
  "Content-Type",
  "X-PAYMENT",
  "PAYMENT-SIGNATURE",
  "X-PAYMENT-RESPONSE",
  "PAYMENT-RESPONSE",
];

const publicCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": ALLOWED_HEADERS.join(", "),
};

const paymentCorsHeaders = {
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": ALLOWED_HEADERS.join(", "),
};

const jsonResponse = (data: unknown, status = 200, corsHeaders?: Record<string, string>): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });

const getQueueStats = (queue: PaymentQueue) => ({
  pending: queue.size(),
  processing: (queue as { getProcessingCount?: () => number }).getProcessingCount?.() ?? 0,
  completed: (queue as { getCompletedCount?: () => number }).getCompletedCount?.() ?? 0,
});

const processJob = async (
  job: SettleJob,
  rpcUrls: Record<number | string, string>,
  privateKey?: HexString
): Promise<SettleResult> => {
  const { paymentPayload, paymentRequirements } = job;

  let walletClient;
  if (privateKey) {
    const account = privateKeyToAccount(privateKey);
    const chainId = isPaymentV1(paymentPayload)
      ? paymentPayload.chainId
      : Number.parseInt(paymentPayload.chainId.split(":")[1], 10);

    const rpcUrl =
      rpcUrls[chainId] ??
      rpcUrls[(paymentPayload as { network?: string }).network ?? ""] ??
      Object.values(rpcUrls)[0];
    const network =
      getNetworkByChainId(chainId) ?? {
        chainId,
        name: "Unknown",
        rpcUrl: rpcUrl ?? "https://eth.llamarpc.com",
        usdcAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const,
        caip2Id: `eip155:${chainId}`,
        caipAssetId: "",
      };

    walletClient = createWalletClient({
      account,
      transport: http(rpcUrl ?? network.rpcUrl),
      chain: {
        id: chainId,
        name: network.name,
        nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
        rpcUrls: {
          default: { http: [rpcUrl ?? network.rpcUrl] },
          public: { http: [rpcUrl ?? network.rpcUrl] },
        },
      } as const,
    });
  }

  try {
    const verifyResult = await verifyPayment(paymentPayload, paymentRequirements, {
      skipBalanceCheck: false,
      skipNonceCheck: false,
    });

    if (!verifyResult.success) {
      return { success: false, errorReason: verifyResult.error.message };
    }

    if (walletClient) {
      const result = await settlePayment({ paymentPayload, walletClient });
      return { success: true, transaction: result.txHash };
    }

    return { success: true, transaction: `0x${crypto.randomUUID().replace(/-/g, "")}` };
  } catch (error) {
    return {
      success: false,
      errorReason: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

const startQueueWorker = (
  queue: PaymentQueue,
  rpcUrls: Record<number | string, string>,
  privateKey?: `0x${string}`,
  pollInterval = 1000
): (() => void) => {
  const intervalId = setInterval(async () => {
    const job = queue.dequeue();
    if (job) {
      const result = await processJob(job, rpcUrls, privateKey);
      queue.complete(job.id, result);
    }
  }, pollInterval);

  return () => clearInterval(intervalId);
};

export const createFacilitatorServer = (options: FacilitatorServerOptions): FacilitatorServer => {
  const {
    port = 3000,
    host = "0.0.0.0",
    nonceTracker,
    paymentQueue,
    rpcUrls = {},
    privateKey,
    queuePollInterval = 1000,
  } = options;

  const stopWorker = startQueueWorker(paymentQueue, rpcUrls, privateKey, queuePollInterval);

  const server = Bun.serve({
    port,
    hostname: host,
    fetch: async (req) => {
      const url = new URL(req.url);

      if (req.method === "OPTIONS") {
        const pathname = url.pathname;

        if (pathname === "/" || pathname === "/supported") {
          return new Response(null, { status: 204, headers: publicCorsHeaders });
        }

        return new Response(null, { status: 204, headers: paymentCorsHeaders });
      }

      if (url.pathname === "/" && req.method === "GET") {
        const health: HealthResponse = {
          status: "ok",
          timestamp: Date.now(),
          queue: getQueueStats(paymentQueue),
        };
        return jsonResponse(health, 200, publicCorsHeaders);
      }

      // GET /supported - List supported networks
      if (url.pathname === "/supported" && req.method === "GET") {
        const networks: SupportedNetworksResponse = {
          networks: Object.values(NETWORKS).map((n) => ({
            name: n.name,
            chainId: n.chainId,
            caip2Id: n.caip2Id,
          })),
        };
        return jsonResponse(networks, 200, publicCorsHeaders);
      }

      if (url.pathname === "/verify" && req.method === "POST") {
        try {
          const body = (await req.json()) as VerifyRequestBody;

          const verifyResult = await verifyPayment(
            body.paymentPayload,
            body.paymentRequirements,
            {
              nonceTracker,
              skipBalanceCheck: body.skipBalanceCheck,
              skipNonceCheck: body.skipNonceCheck,
            }
          );

          if (verifyResult.success) {
            const resp: VerifyResponseBody = {
              success: true,
              payerAddress: verifyResult.payerAddress,
              balance: verifyResult.balance.toString(),
              requiredAmount: verifyResult.requiredAmount.toString(),
            };
            return jsonResponse(resp);
          }

          return jsonResponse(
            { success: false, error: verifyResult.error.message } as VerifyResponseBody,
            400
          );
        } catch (error) {
          return jsonResponse(
            {
              success: false,
              error: error instanceof Error ? error.message : "Invalid request",
            } as VerifyResponseBody,
            400
          );
        }
      }

      if (url.pathname === "/settle" && req.method === "POST") {
        try {
          const body = (await req.json()) as SettleRequestBody;
          const shouldEnqueue = body.enqueue !== false;

          if (shouldEnqueue) {
            paymentQueue.enqueue({
              id: crypto.randomUUID(),
              paymentPayload: body.paymentPayload,
              paymentRequirements: body.paymentRequirements,
              createdAt: Date.now(),
              retries: 0,
            });

            const jobId = (
              paymentQueue as {
                state?: { pending: SettleJob[] };
              }
            ).state?.pending?.[0]?.id;

            const resp: SettleResponseBody = {
              success: true,
              jobId,
              timestamp: Date.now(),
            };
            return jsonResponse(resp, 202);
          }

          const job: SettleJob = {
            id: `direct_${Date.now()}`,
            paymentPayload: body.paymentPayload,
            paymentRequirements: body.paymentRequirements,
            createdAt: Date.now(),
            retries: 0,
          };

          const result = await processJob(job, rpcUrls, privateKey);

          if (result.success) {
            const resp: SettleResponseBody = {
              success: true,
              txHash: result.transaction,
              timestamp: Date.now(),
            };
            return jsonResponse(resp);
          }

          return jsonResponse(
            {
              success: false,
              error: result.errorReason,
              timestamp: Date.now(),
            } as SettleResponseBody,
            400
          );
        } catch (error) {
          return jsonResponse(
            {
              success: false,
              error: error instanceof Error ? error.message : "Invalid request",
              timestamp: Date.now(),
            } as SettleResponseBody,
            400
          );
        }
      }

      return jsonResponse({ error: "Not found" }, 404);
    },
  });

  return {
    stop: () => {
      stopWorker();
      server.stop();
    },
    url: server.url.toString(),
    port: server.port ?? 3000,
  };
};
