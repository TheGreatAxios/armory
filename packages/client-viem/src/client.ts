/**
 * X402 Client for Viem - V2 Only
 */

import type {
  PaymentPayloadV2,
  PaymentRequirementsV2,
  SettlementResponseV2,
} from "@armory-sh/base";
import {
  decodeSettlementV2,
  encodePaymentV2,
  getNetworkByChainId,
  PaymentException as PaymentError,
  V2_HEADERS,
} from "@armory-sh/base";
import {
  getRequirementAttemptOrderWithHooks,
  runAfterPaymentResponseHooks,
  runBeforeSignPaymentHooks,
  runOnPaymentRequiredHooks,
} from "@armory-sh/base/client-hooks-runtime";
import type {
  ClientHook,
  PaymentRequiredContext,
} from "@armory-sh/base/types/hooks";
import {
  createX402Payment,
  getWalletAddress,
  type X402Wallet as ProtocolWallet,
  parsePaymentRequired,
} from "./protocol";
import type {
  X402Client,
  X402ClientConfig,
  X402TransportConfig,
  X402Wallet,
} from "./types";

const DEFAULT_EXPIRY = 3600;
const DEFAULT_NONCE = (): `0x${string}` =>
  `0x${Date.now().toString(16).padStart(64, "0")}`;

const toCaip2Id = (chainId: number): `eip155:${string}` => `eip155:${chainId}`;

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
  if (Number.isNaN(numValue)) {
    return `0x${nonce.padStart(64, "0")}`;
  }
  return `0x${numValue.toString(16).padStart(64, "0")}`;
};

const extractDomainConfig = (
  config: X402ClientConfig,
): { domainName?: string; domainVersion?: string } =>
  config.token
    ? { domainName: config.token.name, domainVersion: config.token.version }
    : { domainName: config.domainName, domainVersion: config.domainVersion };

const addPaymentHeader = (
  headers: Headers,
  payment: PaymentPayloadV2,
): void => {
  const encoded = encodePaymentV2(payment);
  headers.set(V2_HEADERS.PAYMENT_SIGNATURE, encoded);
};

const getRequirementDomainOverrides = (
  requirements: PaymentRequirementsV2,
): { domainName?: string; domainVersion?: string } => {
  const extra = requirements.extra;
  const extraName =
    extra && typeof extra === "object" && typeof extra.name === "string"
      ? extra.name
      : undefined;
  const extraVersion =
    extra && typeof extra === "object" && typeof extra.version === "string"
      ? extra.version
      : undefined;

  return {
    domainName: requirements.name ?? extraName,
    domainVersion: requirements.version ?? extraVersion,
  };
};

const checkSettlement = (response: Response): SettlementResponseV2 => {
  const settlementHeader = response.headers.get(V2_HEADERS.PAYMENT_RESPONSE);
  if (!settlementHeader) {
    throw new PaymentError("No PAYMENT-RESPONSE header found");
  }
  try {
    return decodeSettlementV2(settlementHeader);
  } catch (error) {
    if (error instanceof Error) {
      throw new PaymentError(`Failed to decode settlement: ${error.message}`);
    }
    throw new PaymentError("Failed to decode settlement");
  }
};

const getPaymentFailureDetail = async (
  response: Response,
): Promise<string | undefined> => {
  const text = (await response.clone().text()).trim();
  if (!text) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    if (typeof parsed.message === "string" && parsed.message.trim()) {
      return parsed.message.trim();
    }
    if (typeof parsed.error === "string" && parsed.error.trim()) {
      return parsed.error.trim();
    }
  } catch {}

  return text;
};

const createPaymentVerificationError = async (
  response: Response,
): Promise<PaymentError> => {
  const detail = await getPaymentFailureDetail(response);
  return new PaymentError(
    detail
      ? `Payment verification failed: ${detail}`
      : "Payment verification failed",
  );
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
    hooks?: ClientHook<X402Wallet>[];
  },
) => {
  const protocolWallet = toProtocolWallet(wallet);
  const getAddress = () => getWalletAddress(protocolWallet);
  const {
    defaultExpiry,
    nonceGenerator,
    debug,
    domainName,
    domainVersion,
    hooks,
  } = config;

  return async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
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
      const requirements = parsed.accepts;
      const selectedRequirement = requirements[0];
      if (!selectedRequirement) {
        throw new PaymentError(
          "No payment requirements found in accepts array",
        );
      }
      const validBefore =
        Math.floor(Date.now() / 1000) + selectedRequirement.maxTimeoutSeconds;

      const paymentRequiredContext: PaymentRequiredContext = {
        url: input,
        requestInit: init,
        accepts: requirements,
        requirements: selectedRequirement,
        selectedRequirement,
        serverExtensions: undefined,
        fromAddress,
        nonce,
        validBefore,
      };

      if (hooks) {
        await runOnPaymentRequiredHooks(hooks, paymentRequiredContext);
      }

      const attemptRequirements = await getRequirementAttemptOrderWithHooks(
        hooks,
        paymentRequiredContext,
      );
      let lastError: Error | undefined;

      for (const requirement of attemptRequirements) {
        try {
          const attemptValidBefore =
            Math.floor(Date.now() / 1000) + requirement.maxTimeoutSeconds;
          const attemptContext: PaymentRequiredContext = {
            ...paymentRequiredContext,
            requirements: requirement,
            selectedRequirement: requirement,
            validBefore: attemptValidBefore,
          };
          const attemptRequirementDomain =
            getRequirementDomainOverrides(requirement);

          const payment = await createX402Payment(
            protocolWallet,
            requirement,
            fromAddress,
            nonce,
            attemptValidBefore,
            domainName ?? attemptRequirementDomain.domainName,
            domainVersion ?? attemptRequirementDomain.domainVersion,
          );

          if (debug) {
            console.log("[X402] Created payment payload");
          }

          if (hooks) {
            const paymentPayloadContext = {
              payload: payment,
              requirements: requirement,
              wallet: protocolWallet,
              paymentContext: attemptContext,
            };
            await runBeforeSignPaymentHooks(hooks, paymentPayloadContext);
          }

          const headers = new Headers(init?.headers);
          addPaymentHeader(headers, payment);

          response = await fetch(input, { ...init, headers });

          if (debug) {
            console.log(`[X402] Payment response status: ${response.status}`);
          }

          if (hooks) {
            await runAfterPaymentResponseHooks(hooks, {
              payload: payment,
              requirements: requirement,
              wallet: protocolWallet,
              paymentContext: attemptContext,
              response,
            });
          }

          if (response.status === 402) {
            lastError = await createPaymentVerificationError(response);
            continue;
          }

          checkSettlement(response);
          return response;
        } catch (error) {
          lastError =
            error instanceof Error
              ? error
              : new PaymentError("Payment verification failed");
        }
      }

      throw lastError ?? new PaymentError("Payment verification failed");
    }

    return response;
  };
};

export const createX402Client = (config: X402ClientConfig): X402Client => {
  const {
    wallet,
    version = 2,
    defaultExpiry = DEFAULT_EXPIRY,
    nonceGenerator,
    hooks,
  } = config;
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
      const validBefore =
        expiry ?? Math.floor(Date.now() / 1000) + defaultExpiry;

      const networkConfig = getNetworkByChainId(chainId);
      const caip2Network = (networkConfig?.caip2Id ??
        toCaip2Id(chainId)) as `eip155:${string}`;

      const requirements: PaymentRequirementsV2 = {
        scheme: "exact",
        network: caip2Network,
        amount: amount,
        asset: contractAddress as `0x${string}`,
        payTo: to,
        maxTimeoutSeconds: validBefore - Math.floor(Date.now() / 1000),
      };

      return createX402Payment(
        protocolWallet,
        requirements,
        from,
        nonce,
        validBefore,
        domainName,
        domainVersion,
      );
    },

    async signPayment(payload) {
      const from = getAddress();
      const nonce = payload.nonce.startsWith("0x")
        ? (payload.nonce as `0x${string}`)
        : (`0x${parseInt(payload.nonce, 10).toString(16).padStart(64, "0")}` as `0x${string}`);
      const validBefore = payload.expiry;

      const networkConfig = getNetworkByChainId(payload.chainId);
      const caip2Network = (networkConfig?.caip2Id ??
        toCaip2Id(payload.chainId)) as `eip155:${string}`;

      const requirements: PaymentRequirementsV2 = {
        scheme: "exact",
        network: caip2Network,
        amount: payload.amount,
        asset: payload.contractAddress as `0x${string}`,
        payTo: payload.to,
        maxTimeoutSeconds: validBefore - Math.floor(Date.now() / 1000),
      };

      return createX402Payment(
        protocolWallet,
        requirements,
        from,
        nonce,
        validBefore,
        domainName,
        domainVersion,
      );
    },
  };
};

export const createX402Transport = (
  config: X402TransportConfig,
): ((input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) => {
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
