import { Web3 } from "web3";
import {
  getNetworkConfig,
  encodePaymentV1,
  encodePaymentV2,
} from "@armory-sh/base";
import type {
  PaymentPayloadV1,
  PaymentPayloadV2,
  PaymentRequirementsV1,
  PaymentRequirementsV2,
  SettlementResponseV1,
  SettlementResponseV2,
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

  const getAddress = () => {
    if ("address" in account) return account.address;
    if (Array.isArray(account) && account[0]) return account[0].address;
    throw new Error("Unable to get address from account");
  };

  if (typeof acc.request === "function") {
    const sig = await (acc.request as (args: { method: string; params: unknown[] }) => Promise<string>)({
      method: "eth_signTypedData_v4",
      params: [getAddress(), JSON.stringify({ domain, message })],
    });
    return parseSignature(sig);
  }

  if ("privateKey" in account && typeof account.privateKey === "string") {
    throw new Error("Direct private key signing not implemented. Use wallet provider with signTypedData.");
  }

  throw new Error("Account does not support EIP-712 signing.");
};

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

  const payload: PaymentPayloadV1 = {
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

  return { v: signature.v, r: signature.r, s: signature.s, payload };
};

const signPaymentV2 = async (
  state: ReturnType<typeof createClientState>,
  params: { from: string; to: string; amount: string; nonce: string; expiry: number }
): Promise<PaymentSignatureResult> => {
  const { from, to, amount, nonce, expiry } = params;
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

  const payload: PaymentPayloadV2 = {
    from: from as `0x${string}`,
    to: to as `0x${string}`,
    amount,
    nonce,
    expiry,
    signature: {
      v: signature.v,
      r: signature.r as `0x${string}`,
      s: signature.s as `0x${string}`,
    },
    chainId: network.caip2Id as `eip155:${string}`,
    assetId: network.caipAssetId as `eip155:${string}/erc20:${string}`,
  };

  return { signature: payload.signature, payload };
};

export const createX402Client = (config: Web3ClientConfig): Web3X402Client => {
  const state = createClientState(config);

  return {
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
      if ("contractAddress" in requirements) {
        const req = requirements as PaymentRequirementsV1;
        return signPayment({
          amount: req.amount,
          to: req.payTo,
          expiry: req.expiry,
        }, state);
      }

      const req = requirements as PaymentRequirementsV2;
      const to = typeof req.to === "string" ? req.to : "0x0000000000000000000000000000000000000000";

      return signPayment({
        amount: req.amount,
        to,
        nonce: req.nonce,
        expiry: req.expiry,
      }, state);
    },

    verifySettlement: (response: SettlementResponseV1 | SettlementResponseV2): boolean => {
      return "success" in response ? response.success : response.status === "success";
    },
  };
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
