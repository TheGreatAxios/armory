/**
 * X402 Client for Viem - V2 Only
 */

import type { Address } from "viem";
import type {
  PaymentPayloadV2,
  PaymentRequirementsV2,
  SettlementResponseV2,
} from "@armory-sh/base";
import {
  V2_HEADERS,
  encodePaymentV2,
  decodeSettlementV2,
  getNetworkByChainId,
} from "@armory-sh/base";

import type {
  X402Client,
  X402ClientConfig,
  X402Wallet,
  X402TransportConfig,
  PaymentResult,
  UnsignedPaymentPayload,
} from "./types";
import { PaymentError } from "./errors";
import {
  detectX402Version,
  parsePaymentRequired,
  createX402Payment,
  getWalletAddress,
  encodeX402Payment,
  getPaymentHeaderName,
  type ParsedPaymentRequirements,
  type X402Wallet as ProtocolWallet,
} from "./protocol";
import type { ViemHookRegistry, PaymentRequiredContext, PaymentPayloadContext } from "./hooks";
import { executeHooks } from "./hooks-engine";

const DEFAULT_EXPIRY = 3600;
const DEFAULT_NONCE = (): `0x${string}` => `0x${Date.now().toString(16).padStart(64, "0")}`;

const toCaip2Id = (chainId: number): `eip155:${string}` =>
  `eip155:${chainId}`;

const toProtocolWallet = (wallet: X402Wallet): ProtocolWallet =>
  wallet.type === "account"
    ? { type: "account", account: wallet.account }
    : { type: "walletClient", walletClient: wallet.walletClient };

const generateNonce = (nonceGenerator?: () => string): `0x${string}` => {
  const nonce = nonceGenerator?.() ?? Date.now().toString();
  if (nonce.startsWith("0x")) {
    return nonce as `0x${string}`;
  }
  const numValue = parseInt(nonce, 10);
  if (isNaN(numValue)) {
    return `0x${nonce.padStart(64, "0")}`;
  }
  return `0x${numValue.toString(16).padStart(64, "0")}`;
};

const extractDomainConfig = (config: X402ClientConfig): { domainName?: string; domainVersion?: string } =>
  config.token
    ? { domainName: config.token.name, domainVersion: config.token.version }
    : { domainName: config.domainName, domainVersion: config.domainVersion };

const addPaymentHeader = (headers: Headers, payment: PaymentPayloadV2): void => {
  const encoded = encodeX402Payment(payment);
  headers.set(V2_HEADERS.PAYMENT_SIGNATURE, encoded);
};

const checkSettlement = (response: Response): SettlementResponseV2 => {
  const settlementHeader = response.headers.get(V2_HEADERS.PAYMENT_RESPONSE);
  if (!settlementHeader) {
    throw new PaymentError("No PAYMENT-RESPONSE header found");
  }
  try {
    return decodeSettlementV2(settlementHeader);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new PaymentError(`Failed to decode settlement: ${error.message}`);
    }
    throw error;
  }
};

const createFetch = (
  wallet: X402Wallet,
  config: {
    version: 2;
    defaultExpiry: number;
    nonceGenerator?: () => string;
    debug?: boolean;
    domainName?: string;
    domainVersion?: string;
    hooks?: ViemHookRegistry;
  }
) => {
  const protocolWallet = toProtocolWallet(wallet);
  const getAddress = () => getWalletAddress(protocolWallet);
  const { defaultExpiry, nonceGenerator, debug, domainName, domainVersion, hooks } = config;

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let response = await fetch(input, init);

    if (response.status === 402) {
      if (debug) {
        console.log("[X402] Payment required");
      }

      const parsed = parsePaymentRequired(response);

      if (debug) {
        console.log("[X402] Payment requirements:", parsed);
      }

      const fromAddress = getAddress();
      const nonce = generateNonce(nonceGenerator);
      const validBefore = Math.floor(Date.now() / 1000) + defaultExpiry;

      const paymentRequiredContext: PaymentRequiredContext = {
        url: input,
        requestInit: init,
        requirements: parsed,
        serverExtensions: parsed.extra,
        fromAddress,
        nonce,
        validBefore,
      };

      if (hooks) {
        await executeHooks(hooks, paymentRequiredContext);
      }

      const payment = await createX402Payment(
        protocolWallet,
        parsed,
        fromAddress,
        nonce,
        validBefore,
        domainName,
        domainVersion
      );

      if (debug) {
        console.log("[X402] Created payment payload");
      }

      if (hooks) {
        const paymentPayloadContext: PaymentPayloadContext = {
          payload: payment,
          requirements: parsed,
          wallet: protocolWallet,
          paymentContext: paymentRequiredContext,
        };
        await executeHooks(hooks, paymentPayloadContext);
      }

      const headers = new Headers(init?.headers);
      addPaymentHeader(headers, payment);

      response = await fetch(input, { ...init, headers });

      if (debug) {
        console.log(`[X402] Payment response status: ${response.status}`);
      }

      checkSettlement(response);
    }

    return response;
  };
};

export const createX402Client = (config: X402ClientConfig): X402Client => {
  const { wallet, version = 2, defaultExpiry = DEFAULT_EXPIRY, nonceGenerator, hooks } = config;
  const { domainName, domainVersion } = extractDomainConfig(config);
  const protocolWallet = toProtocolWallet(wallet);
  const getAddress = () => getWalletAddress(protocolWallet);
  const fetchFn = createFetch(wallet, {
    version,
    defaultExpiry,
    nonceGenerator,
    debug: config.debug,
    domainName,
    domainVersion,
    hooks,
  });

  return {
    fetch: fetchFn,
    getAddress,

    async createPayment(amount, to, contractAddress, chainId, expiry) {
      const from = getAddress();
      const nonce = generateNonce(nonceGenerator);
      const validBefore = expiry ?? Math.floor(Date.now() / 1000) + defaultExpiry;

      const networkConfig = getNetworkByChainId(chainId);
      const caip2Network = (networkConfig?.caip2Id ?? toCaip2Id(chainId)) as `eip155:${string}`;

      const requirements: PaymentRequirementsV2 = {
        scheme: "exact",
        network: caip2Network,
        maxAmountRequired: amount,
        asset: contractAddress as `0x${string}`,
        payTo: to,
        maxTimeoutSeconds: validBefore - Math.floor(Date.now() / 1000),
      };

      return createX402Payment(protocolWallet, requirements, from, nonce, validBefore, domainName, domainVersion);
    },

    async signPayment(payload) {
      const from = getAddress();
      const nonce = payload.nonce.startsWith("0x")
        ? (payload.nonce as `0x${string}`)
        : `0x${parseInt(payload.nonce, 10).toString(16).padStart(64, "0")}` as `0x${string}`;
      const validBefore = payload.expiry;

      const networkConfig = getNetworkByChainId(payload.chainId);
      const caip2Network = (networkConfig?.caip2Id ?? toCaip2Id(payload.chainId)) as `eip155:${string}`;

      const requirements: PaymentRequirementsV2 = {
        scheme: "exact",
        network: caip2Network,
        maxAmountRequired: payload.amount,
        asset: payload.contractAddress as `0x${string}`,
        payTo: payload.to,
        maxTimeoutSeconds: validBefore - Math.floor(Date.now() / 1000),
      };

      return createX402Payment(protocolWallet, requirements, from, nonce, validBefore, domainName, domainVersion);
    },
  };
};

export const createX402Transport = (config: X402TransportConfig): ((input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) => {
  const client = createX402Client({
    wallet: config.wallet,
    version: config.version ?? 2,
    defaultExpiry: config.defaultExpiry,
    nonceGenerator: config.nonceGenerator,
    debug: config.debug,
    token: config.token,
    domainName: config.domainName,
    domainVersion: config.domainVersion,
    hooks: config.hooks,
  });
  return client.fetch;
};
