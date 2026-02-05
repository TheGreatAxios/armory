import type {
  Account,
  Address,
  Hash,
  TypedData,
  TypedDataDomain,
  WalletClient,
} from "viem";
import {
  encodePaymentV1,
  encodePaymentV2,
  type PaymentPayloadV1,
  type PaymentPayloadV2,
  type PaymentRequirementsV1,
  type PaymentRequirementsV2,
  type SettlementResponseV1,
  type SettlementResponseV2,
  V1_HEADERS,
  V2_HEADERS,
  createEIP712Domain,
  createTransferWithAuthorization,
  EIP712_TYPES,
} from "@armory-sh/base";

import type {
  X402Client,
  X402ClientConfig,
  X402Wallet,
  X402TransportConfig,
} from "./types";
import { SigningError, PaymentError } from "./errors";

const DEFAULT_EXPIRY = 3600;
const DEFAULT_NONCE = () => `${Date.now()}`;

// Signing utilities
const parseSignature = (signature: Hash): { v: number; r: string; s: string } => {
  const sig = signature.slice(2);
  return {
    v: parseInt(sig.slice(128, 130), 16) + 27,
    r: `0x${sig.slice(0, 64)}`,
    s: `0x${sig.slice(64, 128)}`,
  };
};

const getWalletAddress = (wallet: X402Wallet): Address =>
  wallet.type === "account" ? wallet.account.address : wallet.walletClient.account.address;

const signTypedData = (
  wallet: X402Wallet,
  domain: TypedDataDomain,
  types: TypedData,
  value: Record<string, unknown>
): Promise<Hash> => {
  if (wallet.type === "account" && !wallet.account.signTypedData) {
    throw new SigningError("Account does not support signTypedData");
  }
  return wallet.type === "account"
    ? wallet.account.signTypedData({ domain, types, value })
    : wallet.walletClient.signTypedData({ domain, types, value });
};

// Payment creation
const withCustomDomain = (domain: TypedDataDomain, domainName?: string, domainVersion?: string): TypedDataDomain =>
  domainName || domainVersion
    ? { ...domain, name: domainName ?? domain.name, version: domainVersion ?? domain.version }
    : domain;

const toNetworkName = (chainId: number): string =>
  chainId === 1 ? "ethereum" : chainId === 8453 ? "base" : "evm";

const createPaymentV1 = async (
  wallet: X402Wallet,
  from: Address,
  to: Address,
  amount: string,
  chainId: number,
  contractAddress: Address,
  nonce: string,
  expiry: number,
  domainName?: string,
  domainVersion?: string
): Promise<PaymentPayloadV1> => {
  const domain = createEIP712Domain(chainId, contractAddress);
  const value = createTransferWithAuthorization({
    from, to,
    value: BigInt(Math.floor(parseFloat(amount) * 1e6)),
    validAfter: 0n,
    validBefore: BigInt(expiry),
    nonce: BigInt(nonce),
  });

  const signature = await signTypedData(wallet, withCustomDomain(domain, domainName, domainVersion), EIP712_TYPES, { TransferWithAuthorization: value });
  const { v, r, s } = parseSignature(signature);

  return { from, to, amount, nonce, expiry, v, r, s, chainId, contractAddress, network: toNetworkName(chainId) };
};

const createPaymentV2 = async (
  wallet: X402Wallet,
  from: Address,
  to: Address,
  amount: string,
  chainId: number,
  assetId: string,
  nonce: string,
  expiry: number,
  domainName?: string,
  domainVersion?: string
): Promise<PaymentPayloadV2> => {
  const contractAddress = assetId.split(":")[2] as Address;
  const domain = createEIP712Domain(chainId, contractAddress);
  const value = createTransferWithAuthorization({
    from, to: to as Address,
    value: BigInt(Math.floor(parseFloat(amount) * 1e6)),
    validAfter: 0n,
    validBefore: BigInt(expiry),
    nonce: BigInt(nonce),
  });

  const signature = await signTypedData(wallet, withCustomDomain(domain, domainName, domainVersion), EIP712_TYPES, { TransferWithAuthorization: value });
  const { v, r, s } = parseSignature(signature);

  return {
    from, to, amount, nonce, expiry,
    signature: { v, r, s },
    chainId: `eip155:${chainId}` as const,
    assetId: assetId as `eip155:${string}/erc20:${string}`,
  };
};

// Version detection
const detectVersion = (response: Response, version: X402ClientConfig["version"]): 1 | 2 => {
  if (version === 1) return 1;
  if (version === 2) return 2;

  const headers = response.headers;
  if (headers.has(V1_HEADERS.PAYMENT_RESPONSE) || headers.has("X-PAYMENT-REQUIRED")) {
    return 1;
  }
  return 2;
};

// Parse requirements
const parseRequirements = (
  response: Response,
  version: 1 | 2
): PaymentRequirementsV1 | PaymentRequirementsV2 => {
  if (version === 1) {
    const text = response.headers.get("X-PAYMENT-REQUIRED");
    if (text) {
      try {
        const json = Buffer.from(text, "base64").toString("utf-8");
        return JSON.parse(json) as PaymentRequirementsV1;
      } catch {
        throw new PaymentError("Failed to decode v1 payment requirements");
      }
    }
    return {
      amount: "1.0",
      network: "base",
      contractAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      payTo: "0x0000000000000000000000000000000000000000",
      expiry: Math.floor(Date.now() / 1000) + 3600,
    };
  }

  const v2Text = response.headers.get(V2_HEADERS.PAYMENT_REQUIRED);
  if (v2Text) {
    try {
      return JSON.parse(v2Text) as PaymentRequirementsV2;
    } catch {
      throw new PaymentError("Failed to decode v2 payment requirements");
    }
  }

  return {
    amount: "1.0",
    to: "0x0000000000000000000000000000000000000000",
    chainId: "eip155:8453",
    assetId: "eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    nonce: `${Date.now()}`,
    expiry: Math.floor(Date.now() / 1000) + 3600,
  };
};

// Create payment from requirements
const createPaymentFromRequirements = async (
  wallet: X402Wallet,
  requirements: PaymentRequirementsV1 | PaymentRequirementsV2,
  version: 1 | 2,
  getAddress: () => Address,
  nonceGenerator: () => string,
  domainName?: string,
  domainVersion?: string
): Promise<PaymentPayloadV1 | PaymentPayloadV2> => {
  const from = getAddress();
  const nonce = nonceGenerator();
  const expiry = requirements.expiry;

  if (version === 1) {
    const req = requirements as PaymentRequirementsV1;
    return createPaymentV1(
      wallet,
      from,
      req.payTo as Address,
      req.amount,
      req.network === "base" ? 8453 : 1,
      req.contractAddress as Address,
      nonce,
      expiry,
      domainName,
      domainVersion
    );
  }

  const req = requirements as PaymentRequirementsV2;
  const chainId = parseInt(req.chainId.split(":")[1], 10);
  const to = typeof req.to === "string" ? req.to : "0x0000000000000000000000000000000000000000";

  return createPaymentV2(wallet, from, to as Address, req.amount, chainId, req.assetId, nonce, expiry, domainName, domainVersion);
};

// Add payment header
const addPaymentHeader = (
  headers: Headers,
  payment: PaymentPayloadV1 | PaymentPayloadV2,
  version: 1 | 2
): void => {
  if (version === 1) {
    headers.set(V1_HEADERS.PAYMENT, encodePaymentV1(payment as PaymentPayloadV1));
  } else {
    headers.set(V2_HEADERS.PAYMENT_SIGNATURE, encodePaymentV2(payment as PaymentPayloadV2));
  }
};

// Check settlement
const checkSettlement = (response: Response, version: 1 | 2): void => {
  const v1Header = response.headers.get(V1_HEADERS.PAYMENT_RESPONSE);
  const v2Header = response.headers.get(V2_HEADERS.PAYMENT_RESPONSE);

  let settlement: SettlementResponseV1 | SettlementResponseV2 | null = null;

  if (version === 1 && v1Header) {
    try {
      const json = Buffer.from(v1Header, "base64").toString("utf-8");
      settlement = JSON.parse(json) as SettlementResponseV1;
    } catch {
      // Ignore
    }
  } else if (version === 2 && v2Header) {
    try {
      settlement = JSON.parse(v2Header) as SettlementResponseV2;
    } catch {
      // Ignore
    }
  }

  if (settlement) {
    const success = "success" in settlement ? settlement.success : settlement.status === "success";
    if (!success) {
      const error = "error" in settlement ? settlement.error : "Payment settlement failed";
      throw new PaymentError(error);
    }
  }
};

// Create fetch with payment handling
const createFetch = (
  wallet: X402Wallet,
  config: Omit<X402ClientConfig, "wallet">
): typeof fetch => {
  const { version = "auto", nonceGenerator = DEFAULT_NONCE, debug = false, domainName, domainVersion } = config;
  const getAddress = () => getWalletAddress(wallet);

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

      const detectedVersion = detectVersion(response, version);

      if (debug) {
        console.log(`[X402] Detected protocol v${detectedVersion}`);
      }

      const requirements = parseRequirements(response, detectedVersion);

      if (debug) {
        console.log(`[X402] Payment requirements:`, requirements);
      }

      const payment = await createPaymentFromRequirements(wallet, requirements, detectedVersion, getAddress, nonceGenerator, domainName, domainVersion);

      if (debug) {
        console.log(`[X402] Created payment:`, payment);
      }

      const headers = new Headers(init?.headers);
      addPaymentHeader(headers, payment, detectedVersion);

      response = await fetch(input, { ...init, headers });

      if (debug) {
        console.log(`[X402] Payment response status: ${response.status}`);
      }

      checkSettlement(response, detectedVersion);
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
  const { wallet, version = "auto", defaultExpiry = DEFAULT_EXPIRY, nonceGenerator = DEFAULT_NONCE } = config;
  const { domainName, domainVersion } = extractDomainConfig(config);
  const getAddress = () => getWalletAddress(wallet);
  const fetchFn = createFetch(wallet, { version, defaultExpiry, nonceGenerator, debug: config.debug, domainName, domainVersion });

  return {
    fetch: fetchFn,

    getAddress,

    async createPayment(amount, to, contractAddress, chainId, expiry) {
      const from = getAddress();
      const nonce = nonceGenerator();
      const validExpiry = expiry ?? Math.floor(Date.now() / 1000) + defaultExpiry;

      const targetVersion = version === "auto" ? 1 : version;

      if (targetVersion === 1) {
        return createPaymentV1(wallet, from, to, amount, chainId, contractAddress, nonce, validExpiry, domainName, domainVersion);
      }

      const assetId = `eip155:${chainId}/erc20:${contractAddress}`;
      return createPaymentV2(wallet, from, to, amount, chainId, assetId, nonce, validExpiry, domainName, domainVersion);
    },

    async signPayment(payload) {
      const from = getAddress();
      const chainId = typeof payload.chainId === "number"
        ? payload.chainId
        : parseInt(payload.chainId.split(":")[1], 10);
      const contractAddress = "contractAddress" in payload
        ? payload.contractAddress
        : (payload.assetId as string).split(":")[2];
      const to = (payload as { to: Address | string }).to as Address;
      const expiry = payload.expiry;
      const nonce = nonceGenerator();

      if ("contractAddress" in payload) {
        return createPaymentV1(
          wallet,
          from,
          to,
          payload.amount,
          chainId,
          contractAddress as Address,
          nonce,
          expiry,
          domainName,
          domainVersion
        ) as any;
      }

      return createPaymentV2(
        wallet,
        from,
        to,
        payload.amount,
        chainId,
        payload.assetId,
        nonce,
        expiry,
        domainName,
        domainVersion
      ) as any;
    },
  };
};

export const createX402Transport = (config: X402TransportConfig): typeof fetch => {
  return createFetch(config.payment.wallet as X402Wallet, config.payment);
};
