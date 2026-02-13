/**
 * X402 Client for Viem - Full V1 and V2 Support
 *
 * Handles x402 V1 (Base64 encoded) and V2 (JSON) protocols.
 * Uses protocol.ts for parsing and creating payment payloads.
 */

import type { Address, Hash } from "viem";
import type {
  X402PaymentPayloadV1,
  X402PaymentRequirementsV1,
  PaymentPayloadV2,
  PaymentRequirementsV2,
} from "@armory-sh/base";
import {
  V1_HEADERS,
  V2_HEADERS,
  encodePaymentV1,
  encodePaymentV2,
  decodeSettlementV1,
  decodeSettlementV2,
  isX402V1Payload,
  isX402V2Payload,
  isX402V1Settlement,
  isX402V2Settlement,
  getNetworkByChainId,
  normalizeNetworkName,
} from "@armory-sh/base";

import type {
  X402Client,
  X402ClientConfig,
  X402Wallet,
  X402TransportConfig,
  PaymentResult,
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

const DEFAULT_EXPIRY = 3600;
const DEFAULT_NONCE = (): `0x${string}` => `0x${Date.now().toString(16).padStart(64, "0")}`;

// Convert X402Wallet to protocol's X402Wallet format
const toProtocolWallet = (wallet: X402Wallet): ProtocolWallet =>
  wallet.type === "account"
    ? { type: "account", account: wallet.account }
    : { type: "walletClient", walletClient: wallet.walletClient };

// Generate random nonce
const generateNonce = (nonceGenerator?: () => string): `0x${string}` => {
  const nonce = nonceGenerator?.() ?? Date.now().toString();
  return nonce.startsWith("0x") ? (nonce as `0x${string}`) : `0x${nonce.padStart(64, "0")}`;
};

// Check settlement response
const checkSettlement = (response: Response, version: 1 | 2): void => {
  const v1Header = response.headers.get(V1_HEADERS.PAYMENT_RESPONSE);
  const v2Header = response.headers.get(V2_HEADERS.PAYMENT_RESPONSE);

  if (version === 1 && v1Header) {
    try {
      const settlement = decodeSettlementV1(v1Header);
      if (isX402V1Settlement(settlement) && !settlement.success) {
        throw new PaymentError(settlement.errorReason ?? "Payment settlement failed");
      }
    } catch (error) {
      if (error instanceof PaymentError) throw error;
      // Ignore invalid settlement headers
    }
  } else if (version === 2 && v2Header) {
    try {
      const settlement = decodeSettlementV2(v2Header);
      if (isX402V2Settlement(settlement) && !settlement.success) {
        throw new PaymentError(settlement.errorReason ?? "Payment settlement failed");
      }
    } catch (error) {
      if (error instanceof PaymentError) throw error;
      // Ignore invalid settlement headers
    }
  }
};

// Add payment header to request
const addPaymentHeader = (
  headers: Headers,
  payment: X402PaymentPayloadV1 | PaymentPayloadV2,
  version: 1 | 2
): void => {
  if (version === 1) {
    headers.set(V1_HEADERS.PAYMENT, encodeX402Payment(payment));
  } else {
    headers.set(V2_HEADERS.PAYMENT_SIGNATURE, JSON.stringify(payment));
  }
};

// Create fetch function with payment handling
const createFetch = (
  wallet: X402Wallet,
  config: Omit<X402ClientConfig, "wallet">
): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> => {
  const { version = "auto", nonceGenerator, debug = false, domainName, domainVersion } = config;
  const protocolWallet = toProtocolWallet(wallet);
  const getAddress = () => getWalletAddress(protocolWallet);

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

    if (debug) {
      console.log(`[X402] Fetching: ${url}`);
    }

    let response = await fetch(input, init);

    if (response.status === 402) {
      if (debug) {
        console.log(`[X402] Payment required for: ${url}`);
      }

      // Detect protocol version
      let detectedVersion: 1 | 2;
      if (version === "auto") {
        detectedVersion = detectX402Version(response);
      } else {
        detectedVersion = version;
      }

      if (debug) {
        console.log(`[X402] Detected protocol v${detectedVersion}`);
      }

      // Parse payment requirements
      const parsed = parsePaymentRequired(response);

      if (debug) {
        console.log(`[X402] Payment requirements:`, parsed.requirements);
      }

      // Create payment payload
      const fromAddress = getAddress();
      const nonce = generateNonce(nonceGenerator);
      const validBefore = Math.floor(Date.now() / 1000) + (config.defaultExpiry ?? DEFAULT_EXPIRY);

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
        console.log(`[X402] Created payment payload`);
      }

      // Retry request with payment header
      const headers = new Headers(init?.headers);
      addPaymentHeader(headers, payment, parsed.version);

      response = await fetch(input, { ...init, headers });

      if (debug) {
        console.log(`[X402] Payment response status: ${response.status}`);
      }

      checkSettlement(response, parsed.version);
    }

    return response;
  };
};

// Extract domain config from token or individual fields
const extractDomainConfig = (config: X402ClientConfig): { domainName?: string; domainVersion?: string } =>
  config.token
    ? { domainName: config.token.name, domainVersion: config.token.version }
    : { domainName: config.domainName, domainVersion: config.domainVersion };

// Client factory
export const createX402Client = (config: X402ClientConfig): X402Client => {
  const { wallet, version = "auto", defaultExpiry = DEFAULT_EXPIRY, nonceGenerator } = config;
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
  });

  return {
    fetch: fetchFn,
    getAddress,

    async createPayment(amount, to, contractAddress, chainId, expiry) {
      const from = getAddress();
      const nonce = generateNonce(nonceGenerator);
      const validBefore = expiry ?? Math.floor(Date.now() / 1000) + defaultExpiry;

      // Determine target version
      const targetVersion = version === "auto" ? 1 : version;

      // Get network info
      const networkConfig = getNetworkByChainId(chainId);
      const networkSlug = networkConfig ? normalizeNetworkName(networkConfig.name) : `eip155:${chainId}`;

      if (targetVersion === 1) {
        // Create V1 requirements
        const requirements: X402PaymentRequirementsV1 = {
          scheme: "exact",
          network: networkSlug,
          maxAmountRequired: amount,
          asset: contractAddress,
          payTo: to,
          resource: "",
          description: "",
          maxTimeoutSeconds: defaultExpiry,
        };

        const parsed: ParsedPaymentRequirements = { version: 1, requirements };
        return createX402Payment(protocolWallet, parsed, from, nonce, validBefore, domainName, domainVersion);
      }

      // Create V2 requirements
      const requirements: PaymentRequirementsV2 = {
        scheme: "exact",
        network: `eip155:${chainId}` as const,
        amount: amount,
        asset: contractAddress,
        payTo: to,
        maxTimeoutSeconds: defaultExpiry,
      };

      const parsed: ParsedPaymentRequirements = { version: 2, requirements };
      return createX402Payment(protocolWallet, parsed, from, nonce, validBefore, domainName, domainVersion);
    },

    async signPayment(payload) {
      const from = getAddress();
      const nonce = generateNonce(nonceGenerator);

      // Type guard to check if payload has legacy V1 structure
      const hasContractAddress = (p: unknown): p is { contractAddress: Address; amount: string; expiry: number } =>
        typeof p === "object" && p !== null && "contractAddress" in p;

      if (hasContractAddress(payload)) {
        // V1 payload
        const networkConfig = getNetworkByChainId(
          "chainId" in payload && typeof payload.chainId === "number"
            ? payload.chainId
            : 84532
        );
        const networkSlug = networkConfig ? normalizeNetworkName(networkConfig.name) : "base";
        const to = ("to" in payload && typeof payload.to === "string") ? payload.to as Address : "0x0000000000000000000000000000000000000000" as Address;

        const requirements: X402PaymentRequirementsV1 = {
          scheme: "exact",
          network: networkSlug,
          maxAmountRequired: payload.amount,
          asset: payload.contractAddress,
          payTo: to,
          resource: "",
          description: "",
          maxTimeoutSeconds: defaultExpiry,
        };

        const parsed: ParsedPaymentRequirements = { version: 1, requirements };
        const validBefore = payload.expiry ?? Math.floor(Date.now() / 1000) + defaultExpiry;
        return createX402Payment(protocolWallet, parsed, from, nonce, validBefore, domainName, domainVersion) as Promise<
          X402PaymentPayloadV1 | PaymentPayloadV2
        >;
      }

      // V2 payload
      const to = ("payTo" in payload && typeof payload.payTo === "string") ? (payload.payTo as `0x${string}`) : "0x0000000000000000000000000000000000000000" as `0x${string}`;
      const amount = ("amount" in payload && typeof payload.amount === "string") ? payload.amount : "1000000";
      const network = ("network" in payload && typeof payload.network === "string") ? payload.network : "eip155:8453";
      const chainId = parseInt(network.split(":")[1], 10);
      const defaultAsset = getNetworkByChainId(chainId)?.usdcAddress ?? "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
      const asset = ("asset" in payload && typeof payload.asset === "string") ? (payload.asset as `0x${string}`) : (defaultAsset as `0x${string}`);

      const requirements: PaymentRequirementsV2 = {
        scheme: "exact",
        network: network as `eip155:${string}`,
        amount,
        asset,
        payTo: to,
        maxTimeoutSeconds: defaultExpiry,
      };

      const parsed: ParsedPaymentRequirements = { version: 2, requirements };
      const validBefore = ("expiry" in payload && typeof payload.expiry === "number") ? payload.expiry : Math.floor(Date.now() / 1000) + defaultExpiry;
      return createX402Payment(protocolWallet, parsed, from, nonce, validBefore, domainName, domainVersion) as Promise<
        X402PaymentPayloadV1 | PaymentPayloadV2
      >;
    },
  };
};

export const createX402Transport = (config: X402TransportConfig): ReturnType<typeof createFetch> => {
  const { wallet, version, defaultExpiry, nonceGenerator, debug, token, domainName, domainVersion } = config;
  return createFetch(wallet, {
    version,
    defaultExpiry,
    nonceGenerator,
    debug,
    domainName: domainName ?? token?.name,
    domainVersion: domainVersion ?? token?.version,
  });
};
