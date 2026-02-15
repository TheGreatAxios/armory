import { Web3 } from "web3";
import {
  getNetworkConfig,
  encodePaymentV1,
  encodePaymentV2,
  isX402V1Requirements,
  isX402V2Requirements,
  isLegacyPaymentPayloadV1,
  networkToCaip2,
  combineSignatureV2,
  createNonce,
  V1_HEADERS,
  V2_HEADERS,
  type PaymentPayloadV1,
  type PaymentPayloadV2,
  type PaymentRequirementsV1,
  type PaymentRequirementsV2,
  type SettlementResponseV1,
  type SettlementResponseV2,
  type X402PaymentPayloadV1,
  type EIP3009Authorization,
  type EIP3009AuthorizationV1,
  type X402PaymentRequirementsV1,
  type LegacyPaymentRequirementsV1,
} from "@armory-sh/base";
import type {
  Web3Account,
  Web3ClientConfig,
  PaymentSignOptions,
  PaymentSignatureResult,
  Web3X402Client,
  Web3EIP712Domain,
} from "./types";
import { createEIP712Domain, createTransferWithAuthorization } from "./eip3009";
import {
  createX402V1Payment,
  createX402V2Payment,
  detectX402Version,
  parsePaymentRequired,
  selectSchemeRequirements,
  type X402Version,
} from "./protocol";

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
  const network = typeof config.network === "string"
    ? getNetworkConfig(config.network) ?? (() => { throw new Error(`Unknown network: ${config.network}`); })()
    : config.network;
  const { domainName, domainVersion } = extractDomainConfig(config);

  return {
    account: config.account,
    version: config.version ?? 2,
    network,
    web3: new Web3(config.rpcUrl ?? network.rpcUrl),
    domainName,
    domainVersion,
  };
};

const getAddress = (account: Web3Account): string => {
  if ("address" in account) return account.address;
  if (Array.isArray(account) && account[0]) return account[0].address;
  throw new Error("Unable to get address from account");
};

const parseSignature = (signature: string): { v: number; r: string; s: string } => {
  const hexSig = signature.startsWith("0x") ? signature.slice(2) : signature;
  if (hexSig.length !== 130) throw new Error(`Invalid signature length: ${hexSig.length}`);
  return {
    r: `0x${hexSig.slice(0, 64)}`,
    s: `0x${hexSig.slice(64, 128)}`,
    v: parseInt(hexSig.slice(128, 130), 16),
  };
};

const signTypedDataWrapper = async (
  account: Web3Account,
  domain: Record<string, string> | { [key: string]: string | number | boolean } | Web3EIP712Domain,
  message: Record<string, string> | { [key: string]: string | number | boolean }
): Promise<{ v: number; r: string; s: string }> => {
  const acc = account as unknown as Record<string, unknown>;

  if (typeof acc.signTypedData === "function") {
    const sig = await (acc.signTypedData as (d: unknown, m: unknown) => Promise<string>)(domain, message);
    return parseSignature(sig);
  }

  const getAddressLocal = () => {
    if ("address" in account) return account.address;
    if (Array.isArray(account) && account[0]) return account[0].address;
    throw new Error("Unable to get address from account");
  };

  if (typeof acc.request === "function") {
    const sig = await (acc.request as (args: { method: string; params: unknown[] }) => Promise<string>)({
      method: "eth_signTypedData_v4",
      params: [getAddressLocal(), JSON.stringify({ domain, message })],
    });
    return parseSignature(sig);
  }

  if ("privateKey" in account && typeof account.privateKey === "string") {
    throw new Error("Direct private key signing not implemented. Use wallet provider with signTypedData.");
  }

  throw new Error("Account does not support EIP-712 signing.");
};

/**
 * Sign payment for x402 V1 protocol
 * Creates a legacy format payload for backward compatibility
 */
const signPaymentV1 = async (
  state: ReturnType<typeof createClientState>,
  params: { from: string; to: string; amount: string; nonce: string; expiry: number; validAfter: number }
): Promise<PaymentSignatureResult> => {
  const { from, to, amount, nonce, expiry, validAfter } = params;
  const { network, domainName, domainVersion } = state;

  const domain = createEIP712Domain(network.chainId, network.usdcAddress, domainName, domainVersion);
  const message = createTransferWithAuthorization({
    from,
    to,
    value: amount,
    validAfter: `0x${validAfter.toString(16)}`,
    validBefore: `0x${expiry.toString(16)}`,
    nonce: `0x${nonce}`,
  });

  const signature = await signTypedDataWrapper(state.account, domain, message);

  const legacyPayload: PaymentPayloadV1 = {
    from,
    to,
    amount,
    nonce,
    expiry,
    v: signature.v,
    r: signature.r,
    s: signature.s,
    chainId: network.chainId,
    contractAddress: network.usdcAddress,
    network: network.name.toLowerCase().replace(" ", "-"),
  };

  return { v: signature.v, r: signature.r, s: signature.s, payload: legacyPayload };
};

/**
 * Handle payment requirements for V1 or V2 protocol
 * This is used by both fetch() and handlePaymentRequired()
 */
const handlePaymentRequirements = async (
  requirements: PaymentRequirementsV1 | PaymentRequirementsV2,
  state: ReturnType<typeof createClientState>
): Promise<PaymentSignatureResult> => {
  const version = detectVersionFromRequirements(requirements);

  if (version === 1) {
    // V1 requirements handling
    const req = requirements as PaymentRequirementsV1;

    // Handle x402 V1 format
    if (isX402V1Requirements(req)) {
      const x402Req = req as X402PaymentRequirementsV1;
      return signPayment({
        amount: x402Req.maxAmountRequired,
        to: x402Req.payTo,
      }, state);
    }

    // Handle legacy V1 format
    const legacyReq = req as LegacyPaymentRequirementsV1;
    return signPayment({
      amount: legacyReq.amount,
      to: legacyReq.payTo,
      expiry: legacyReq.expiry,
    }, state);
  }

  // V2 requirements handling
  const req = requirements as PaymentRequirementsV2;
  const to = typeof req.payTo === "string" ? req.payTo : "0x0000000000000000000000000000000000000000";
  const from = getAddress(state.account);

  return signPaymentV2(state, {
    from,
    to,
    amount: req.amount,
    nonce: crypto.randomUUID(),
    expiry: Math.floor(Date.now() / 1000) + DEFAULT_EXPIRY_SECONDS,
    accepted: req,
  });
};

/**
 * Sign payment for x402 V2 protocol
 * Creates a proper x402 V2 PaymentPayload with x402Version, accepted, payload structure
 */
const signPaymentV2 = async (
  state: ReturnType<typeof createClientState>,
  params: {
    from: string;
    to: string;
    amount: string;
    nonce: string;
    expiry: number;
    accepted?: PaymentRequirementsV2;
  }
): Promise<PaymentSignatureResult> => {
  const { from, to, amount, nonce, expiry, accepted } = params;
  const { network, domainName, domainVersion } = state;

  const domain = createEIP712Domain(network.chainId, network.usdcAddress, domainName, domainVersion);
  const message = createTransferWithAuthorization({
    from,
    to,
    value: amount,
    validAfter: "0x0",
    validBefore: `0x${expiry.toString(16)}`,
    nonce: `0x${nonce}`,
  });

  const signature = await signTypedDataWrapper(state.account, domain, message);
  const combinedSig = combineSignatureV2(signature.v, signature.r, signature.s);

  const defaultAccepted: PaymentRequirementsV2 = accepted ?? {
    scheme: "exact",
    network: network.caip2Id as `eip155:${string}`,
    amount,
    asset: network.usdcAddress as `0x${string}`,
    payTo: to as `0x${string}`,
    maxTimeoutSeconds: expiry - Math.floor(Date.now() / 1000),
  };

  const x402Payload = createX402V2Payment({
    from,
    to,
    value: amount,
    nonce: `0x${nonce.padStart(64, "0")}`,
    validAfter: "0x0",
    validBefore: `0x${expiry.toString(16)}`,
    signature: combinedSig,
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

export const createX402Client = (config: Web3ClientConfig): Web3X402Client => {
  const state = createClientState(config);

  const fetch = async (url: string | Request, init?: RequestInit): Promise<Response> => {
    let response = await fetch(url, init);

    if (response.status === 402) {
      const version = detectX402Version(response, state.version);
      const parsed = await parsePaymentRequired(response, version);

      const selectedRequirements = selectSchemeRequirements(parsed.requirements, "exact");
      if (!selectedRequirements) {
        throw new Error("No supported payment scheme found in requirements");
      }

      const from = getAddress(state.account);
      let result;

      if (version === 1) {
        result = await handlePaymentRequirements(selectedRequirements as PaymentRequirementsV1, state);
      } else {
        const req = selectedRequirements as PaymentRequirementsV2;
        const to = typeof req.payTo === "string" ? req.payTo : "0x0000000000000000000000000000000000000000";
        result = await signPaymentV2(state, {
          from,
          to,
          amount: req.amount,
          nonce: crypto.randomUUID(),
          expiry: Math.floor(Date.now() / 1000) + DEFAULT_EXPIRY_SECONDS,
          accepted: req,
        });
      }

      const paymentHeaders = new Headers(init?.headers);
      if (version === 1) {
        paymentHeaders.set(V1_HEADERS.PAYMENT, encodePaymentV1(result.payload as PaymentPayloadV1));
      } else {
        paymentHeaders.set(V2_HEADERS.PAYMENT_SIGNATURE, encodePaymentV2(result.payload as PaymentPayloadV2));
      }

      response = await fetch(url, { ...init, headers: paymentHeaders });
    }

    return response;
  };

  return {
    fetch,
    getAccount: () => state.account,
    getNetwork: () => state.network,
    getVersion: () => state.version,

    signPayment: async (options: PaymentSignOptions): Promise<PaymentSignatureResult> => {
      const from = getAddress(state.account);
      const to = options.to;
      const amount = options.amount.toString();
      const nonce = options.nonce ?? crypto.randomUUID();
      const expiry = options.expiry ?? Math.floor(Date.now() / 1000) + DEFAULT_EXPIRY_SECONDS;

      if (state.version === 1) {
        return signPaymentV1(state, {
          from,
          to,
          amount,
          nonce,
          expiry,
          validAfter: options.validAfter ?? DEFAULT_VALID_AFTER,
        });
      }

      return signPaymentV2(state, { from, to, amount, nonce, expiry });
    },

    createPaymentHeaders: async (options: PaymentSignOptions): Promise<Headers> => {
      const result = await signPayment(options, state);
      const headers = new Headers();

      if (state.version === 1) {
        headers.set("X-PAYMENT", encodePaymentV1(result.payload as PaymentPayloadV1));
      } else {
        headers.set("PAYMENT-SIGNATURE", encodePaymentV2(result.payload as PaymentPayloadV2));
      }

      return headers;
    },

    handlePaymentRequired: async (
      requirements: PaymentRequirementsV1 | PaymentRequirementsV2
    ): Promise<PaymentSignatureResult> => {
      return handlePaymentRequirements(requirements, state);
    },

    verifySettlement: (response: SettlementResponseV1 | SettlementResponseV2): boolean => {
      if ("success" in response) {
        return response.success;
      }
      return false;
    },
  };
};

/**
 * Detect x402 version from requirements object structure
 */
const detectVersionFromRequirements = (requirements: PaymentRequirementsV1 | PaymentRequirementsV2): X402Version => {
  if (isX402V2Requirements(requirements)) {
    return 2;
  }

  if (isX402V1Requirements(requirements)) {
    return 1;
  }

  if ("contractAddress" in requirements) {
    return 1;
  }

  // Default to client version
  return 2;
};

const signPayment = async (
  options: PaymentSignOptions,
  state: ReturnType<typeof createClientState>
): Promise<PaymentSignatureResult> => {
  const from = getAddress(state.account);

  if (state.version === 1) {
    return signPaymentV1(state, {
      from,
      to: options.to,
      amount: options.amount.toString(),
      nonce: options.nonce ?? crypto.randomUUID(),
      expiry: options.expiry ?? Math.floor(Date.now() / 1000) + DEFAULT_EXPIRY_SECONDS,
      validAfter: options.validAfter ?? DEFAULT_VALID_AFTER,
    });
  }

  return signPaymentV2(state, {
    from,
    to: options.to,
    amount: options.amount.toString(),
    nonce: options.nonce ?? crypto.randomUUID(),
    expiry: options.expiry ?? Math.floor(Date.now() / 1000) + DEFAULT_EXPIRY_SECONDS,
  });
};
