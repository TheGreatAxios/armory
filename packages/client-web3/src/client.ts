import { Web3 } from "web3";
import {
  getNetworkConfig,
  encodePaymentV2,
  isX402V2Requirements,
  networkToCaip2,
  combineSignatureV2,
  createNonce,
  V2_HEADERS,
  type PaymentPayloadV2,
  type PaymentRequirementsV2,
  type SettlementResponseV2,
  type EIP3009Authorization,
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
  createX402V2Payment,
  detectX402Version,
  parsePaymentRequired,
  type ParsedPaymentRequired,
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
    network: networkToCaip2(network.name) as `eip155:${string}`,
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

export const createX402Client = (config: Web3ClientConfig): Web3X402Client => {
  const state = createClientState(config);

  const fetch = async (url: string | Request, init?: RequestInit): Promise<Response> => {
    let response = await fetch(url, init);

    if (response.status === 402) {
      const version = detectX402Version(response, state.version);
      const parsed = await parsePaymentRequired(response, version);

      const selectedRequirements = parsed.requirements[0];
      if (!selectedRequirements) {
        throw new Error("No supported payment scheme found in requirements");
      }

      const from = getAddress(state.account);
      const req = selectedRequirements;
      const to = typeof req.payTo === "string" ? req.payTo : "0x0000000000000000000000000000000000000000";

      const result = await signPaymentV2(state, {
        from,
        to,
        amount: req.amount,
        nonce: crypto.randomUUID(),
        expiry: Math.floor(Date.now() / 1000) + DEFAULT_EXPIRY_SECONDS,
        accepted: req,
      });

      const paymentHeaders = new Headers(init?.headers);
      paymentHeaders.set(V2_HEADERS.PAYMENT_SIGNATURE, encodePaymentV2(result.payload));

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

      return signPaymentV2(state, { from, to, amount, nonce, expiry });
    },

    createPaymentHeaders: async (options: PaymentSignOptions): Promise<Headers> => {
      const from = getAddress(state.account);
      const to = options.to;
      const amount = options.amount.toString();
      const nonce = options.nonce ?? crypto.randomUUID();
      const expiry = options.expiry ?? Math.floor(Date.now() / 1000) + DEFAULT_EXPIRY_SECONDS;

      const result = await signPaymentV2(state, { from, to, amount, nonce, expiry });
      const headers = new Headers();
      headers.set("PAYMENT-SIGNATURE", encodePaymentV2(result.payload));
      return headers;
    },

    handlePaymentRequired: async (
      requirements: PaymentRequirementsV2
    ): Promise<PaymentSignatureResult> => {
      const from = getAddress(state.account);
      const to = typeof requirements.payTo === "string" ? requirements.payTo : "0x0000000000000000000000000000000000000000";

      return signPaymentV2(state, {
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
