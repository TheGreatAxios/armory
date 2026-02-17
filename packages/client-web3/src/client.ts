import {
  combineSignatureV2,
  encodePaymentV2,
  getNetworkByChainId,
  getNetworkConfig,
  type NetworkConfig,
  networkToCaip2,
  type PaymentRequirementsV2,
  type SettlementResponseV2,
  V2_HEADERS,
} from "@armory-sh/base";
import {
  getRequirementAttemptOrderWithHooks,
  runAfterPaymentResponseHooks,
  runBeforeSignPaymentHooks,
  runOnPaymentRequiredHooks,
} from "@armory-sh/base/client-hooks-runtime";
import type { PaymentRequiredContext } from "@armory-sh/base/types/hooks";
import { Web3 } from "web3";
import { createEIP712Domain, createTransferWithAuthorization } from "./eip3009";
import {
  createX402V2Payment,
  detectX402Version,
  parsePaymentRequired,
} from "./protocol";
import type {
  PaymentSignatureResult,
  PaymentSignOptions,
  Web3Account,
  Web3ClientConfig,
  Web3EIP712Domain,
  Web3X402Client,
} from "./types";

const DEFAULT_EXPIRY_SECONDS = 3600;
const DEFAULT_VALID_AFTER = 0;

// Extract domain config from token or individual fields
const extractDomainConfig = (config: Web3ClientConfig) => {
  if (config.token) {
    return {
      domainName: config.token.name,
      domainVersion: config.token.version,
    };
  }
  return {
    domainName: config.domainName,
    domainVersion: config.domainVersion,
  };
};

const createClientState = (config: Web3ClientConfig) => {
  const network = config.network
    ? typeof config.network === "string"
      ? (getNetworkConfig(config.network) ??
        (() => {
          throw new Error(`Unknown network: ${config.network}`);
        })())
      : config.network
    : undefined;
  const { domainName, domainVersion } = extractDomainConfig(config);

  return {
    account: config.account,
    version: config.version ?? 2,
    network,
    web3: config.rpcUrl
      ? new Web3(config.rpcUrl)
      : network
        ? new Web3(network.rpcUrl)
        : new Web3(),
    domainName,
    domainVersion,
  };
};

const getAddress = (account: Web3Account): string => {
  if ("address" in account) return account.address;
  if (Array.isArray(account) && account[0]) return account[0].address;
  throw new Error("Unable to get address from account");
};

const parseSignature = (
  signature: string,
): { v: number; r: string; s: string } => {
  const hexSig = signature.startsWith("0x") ? signature.slice(2) : signature;
  if (hexSig.length !== 130)
    throw new Error(`Invalid signature length: ${hexSig.length}`);
  return {
    r: `0x${hexSig.slice(0, 64)}`,
    s: `0x${hexSig.slice(64, 128)}`,
    v: parseInt(hexSig.slice(128, 130), 16),
  };
};

const signTypedDataWrapper = async (
  account: Web3Account,
  domain:
    | Record<string, string>
    | { [key: string]: string | number | boolean }
    | Web3EIP712Domain,
  message:
    | Record<string, string>
    | { [key: string]: string | number | boolean },
): Promise<{ v: number; r: string; s: string }> => {
  const acc = account as unknown as Record<string, unknown>;

  if (typeof acc.signTypedData === "function") {
    const sig = await (
      acc.signTypedData as (d: unknown, m: unknown) => Promise<string>
    )(domain, message);
    return parseSignature(sig);
  }

  const getAddressLocal = () => {
    if ("address" in account) return account.address;
    if (Array.isArray(account) && account[0]) return account[0].address;
    throw new Error("Unable to get address from account");
  };

  if (typeof acc.request === "function") {
    const sig = await (
      acc.request as (args: {
        method: string;
        params: unknown[];
      }) => Promise<string>
    )({
      method: "eth_signTypedData_v4",
      params: [getAddressLocal(), JSON.stringify({ domain, message })],
    });
    return parseSignature(sig);
  }

  if ("privateKey" in account && typeof account.privateKey === "string") {
    throw new Error(
      "Direct private key signing not implemented. Use wallet provider with signTypedData.",
    );
  }

  throw new Error("Account does not support EIP-712 signing.");
};

/**
 * Sign payment for x402 V2 protocol
 * Creates a proper x402 V2 PaymentPayload with x402Version, accepted, payload structure
 */
const signPaymentV2 = async (
  state: ReturnType<typeof createClientState>,
  network: NetworkConfig,
  params: {
    from: string;
    to: string;
    amount: string;
    nonce: string;
    expiry: number;
    accepted?: PaymentRequirementsV2;
  },
): Promise<PaymentSignatureResult> => {
  const { from, to, amount, nonce, expiry, accepted } = params;
  const defaultAccepted: PaymentRequirementsV2 = accepted ?? {
    scheme: "exact",
    network: networkToCaip2(network.name) as `eip155:${string}`,
    amount: amount,
    asset: network.usdcAddress as `0x${string}`,
    payTo: to as `0x${string}`,
    maxTimeoutSeconds: expiry - Math.floor(Date.now() / 1000),
  };

  const domainExtra = defaultAccepted.extra;
  const requirementDomainName =
    defaultAccepted.name ??
    (domainExtra &&
    typeof domainExtra === "object" &&
    typeof domainExtra.name === "string"
      ? domainExtra.name
      : undefined);
  const requirementDomainVersion =
    defaultAccepted.version ??
    (domainExtra &&
    typeof domainExtra === "object" &&
    typeof domainExtra.version === "string"
      ? domainExtra.version
      : undefined);
  const effectiveDomainName = state.domainName ?? requirementDomainName;
  const effectiveDomainVersion =
    state.domainVersion ?? requirementDomainVersion;

  const chainId = parseInt(defaultAccepted.network.split(":")[1], 10);
  const domain = createEIP712Domain(
    chainId,
    defaultAccepted.asset,
    effectiveDomainName,
    effectiveDomainVersion,
  );
  const nowSeconds = Math.floor(Date.now() / 1000);
  const validAfterHex = `0x${(nowSeconds - 600).toString(16)}`;
  const message = createTransferWithAuthorization({
    from,
    to,
    value: amount,
    validAfter: validAfterHex,
    validBefore: `0x${expiry.toString(16)}`,
    nonce: `0x${nonce}`,
  });

  const signature = await signTypedDataWrapper(state.account, domain, message);
  const combinedSig = combineSignatureV2(signature.v, signature.r, signature.s);

  const x402Payload = createX402V2Payment({
    from,
    to,
    value: amount,
    nonce: `0x${nonce.padStart(64, "0")}`,
    validAfter: validAfterHex,
    validBefore: `0x${expiry.toString(16)}`,
    signature: combinedSig,
    network: defaultAccepted.network,
    accepted: defaultAccepted,
  });

  return {
    signature: {
      v: signature.v,
      r: signature.r,
      s: signature.s,
    },
    payload: x402Payload,
  };
};

const extractNetworkFromRequirements = (
  requirements: PaymentRequirementsV2,
): NetworkConfig => {
  const caip2Network = requirements.network;
  const match = caip2Network.match(/^eip155:(\d+)$/);
  if (!match) {
    throw new Error(`Invalid CAIP-2 network format: ${caip2Network}`);
  }

  const chainId = parseInt(match[1], 10);
  const network = getNetworkByChainId(chainId);
  if (!network) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }

  return network;
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
): Promise<Error> => {
  const detail = await getPaymentFailureDetail(response);
  return new Error(
    detail
      ? `Payment verification failed: ${detail}`
      : "Payment verification failed",
  );
};

export const createX402Client = (config: Web3ClientConfig): Web3X402Client => {
  const state = createClientState(config);
  const hooks = config.hooks;

  const fetch = async (
    url: string | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    let response = await globalThis.fetch(url, init);

    if (response.status === 402) {
      const version = detectX402Version(response, state.version);
      const parsed = await parsePaymentRequired(response, version);

      const selectedRequirements =
        parsed.requirements.find(
          (requirement) => requirement.network === state.network?.caip2Id,
        ) ?? parsed.requirements[0];
      if (!selectedRequirements) {
        throw new Error("No supported payment scheme found in requirements");
      }

      const from = getAddress(state.account);
      const paymentRequiredContext: PaymentRequiredContext = {
        url,
        requestInit: init,
        accepts: parsed.requirements,
        requirements: selectedRequirements,
        selectedRequirement: selectedRequirements,
        serverExtensions: undefined,
        fromAddress: from as `0x${string}`,
        nonce: `0x${Date.now().toString(16).padStart(64, "0")}`,
        validBefore:
          Math.floor(Date.now() / 1000) +
          selectedRequirements.maxTimeoutSeconds,
      };
      await runOnPaymentRequiredHooks(hooks, paymentRequiredContext);
      const attemptRequirements = await getRequirementAttemptOrderWithHooks(
        hooks,
        paymentRequiredContext,
      );
      let lastError: Error | undefined;

      for (const req of attemptRequirements) {
        try {
          const to =
            typeof req.payTo === "string"
              ? req.payTo
              : "0x0000000000000000000000000000000000000000";
          const attemptValidBefore =
            Math.floor(Date.now() / 1000) + req.maxTimeoutSeconds;
          const attemptContext: PaymentRequiredContext = {
            ...paymentRequiredContext,
            requirements: req,
            selectedRequirement: req,
            validBefore: attemptValidBefore,
          };
          const network = extractNetworkFromRequirements(req);

          const result = await signPaymentV2(state, network, {
            from,
            to,
            amount: req.amount,
            nonce: crypto.randomUUID(),
            expiry: attemptValidBefore,
            accepted: req,
          });
          await runBeforeSignPaymentHooks(hooks, {
            payload: result.payload,
            requirements: req,
            wallet: state.account,
            paymentContext: attemptContext,
          });

          const paymentHeaders = new Headers(init?.headers);
          paymentHeaders.set(
            V2_HEADERS.PAYMENT_SIGNATURE,
            encodePaymentV2(result.payload),
          );

          response = await globalThis.fetch(url, {
            ...init,
            headers: paymentHeaders,
          });
          await runAfterPaymentResponseHooks(hooks, {
            payload: result.payload,
            requirements: req,
            wallet: state.account,
            paymentContext: attemptContext,
            response,
          });

          if (response.status === 402) {
            lastError = await createPaymentVerificationError(response);
            continue;
          }

          return response;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
        }
      }

      throw lastError ?? new Error("Payment verification failed");
    }

    return response;
  };

  return {
    fetch,
    getAccount: () => state.account,
    getNetwork: () => state.network,
    getVersion: () => state.version,

    signPayment: async (
      options: PaymentSignOptions,
    ): Promise<PaymentSignatureResult> => {
      const network =
        state.network ??
        (() => {
          throw new Error(
            "Network must be configured for manual payment signing",
          );
        })();
      const from = getAddress(state.account);
      const to = options.to;
      const amount = options.amount.toString();
      const nonce = options.nonce ?? crypto.randomUUID();
      const expiry =
        options.expiry ??
        Math.floor(Date.now() / 1000) + DEFAULT_EXPIRY_SECONDS;

      return signPaymentV2(state, network, { from, to, amount, nonce, expiry });
    },

    createPaymentHeaders: async (
      options: PaymentSignOptions,
    ): Promise<Headers> => {
      const network =
        state.network ??
        (() => {
          throw new Error(
            "Network must be configured for manual payment signing",
          );
        })();
      const from = getAddress(state.account);
      const to = options.to;
      const amount = options.amount.toString();
      const nonce = options.nonce ?? crypto.randomUUID();
      const expiry =
        options.expiry ??
        Math.floor(Date.now() / 1000) + DEFAULT_EXPIRY_SECONDS;

      const result = await signPaymentV2(state, network, {
        from,
        to,
        amount,
        nonce,
        expiry,
      });
      const headers = new Headers();
      headers.set("PAYMENT-SIGNATURE", encodePaymentV2(result.payload));
      return headers;
    },

    handlePaymentRequired: async (
      requirements: PaymentRequirementsV2,
    ): Promise<PaymentSignatureResult> => {
      const from = getAddress(state.account);
      const to =
        typeof requirements.payTo === "string"
          ? requirements.payTo
          : "0x0000000000000000000000000000000000000000";
      const network = extractNetworkFromRequirements(requirements);

      return signPaymentV2(state, network, {
        from,
        to,
        amount: requirements.amount,
        nonce: crypto.randomUUID(),
        expiry: Math.floor(Date.now() / 1000) + DEFAULT_EXPIRY_SECONDS,
        accepted: requirements,
      });
    },

    verifySettlement: (response: SettlementResponseV2): boolean => {
      return response.success === true;
    },
  };
};
