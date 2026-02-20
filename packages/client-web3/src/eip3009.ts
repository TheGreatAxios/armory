import type { Web3BaseWallet, Web3BaseWalletAccount } from "web3-types";
import type { Web3EIP712Domain, Web3TransferWithAuthorization } from "./types";

export const EIP712_TYPES = {
  EIP712Domain: [
    { name: "name", type: "string" },
    { name: "version", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "verifyingContract", type: "address" },
  ],
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "uint256" },
  ],
} as const;

export const USDC_DOMAIN = {
  NAME: "USD Coin",
  VERSION: "2",
} as const;

const toQuantity = (value: bigint | number | string): string => {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number") return `0x${value.toString(16)}`;
  return value;
};

const toBigInt = (value: bigint | number | string): bigint => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.floor(value));
  if (typeof value === "string") {
    return value.startsWith("0x") ? BigInt(value) : BigInt(value);
  }
  throw new Error(`Invalid value type: ${typeof value}`);
};

export const createEIP712Domain = (
  chainId: number | string,
  contractAddress: string,
  domainName?: string,
  domainVersion?: string,
): Web3EIP712Domain => ({
  name: domainName ?? USDC_DOMAIN.NAME,
  version: domainVersion ?? USDC_DOMAIN.VERSION,
  chainId: toQuantity(chainId),
  verifyingContract: contractAddress.toLowerCase(),
});

export const createTransferWithAuthorization = (
  params: Web3TransferWithAuthorization,
): Record<string, string> => ({
  from: params.from.toLowerCase(),
  to: params.to.toLowerCase(),
  value: toQuantity(params.value),
  validAfter: toQuantity(params.validAfter),
  validBefore: toQuantity(params.validBefore),
  nonce: toQuantity(params.nonce),
});

export const validateTransferWithAuthorization = (
  message: Web3TransferWithAuthorization,
): boolean => {
  const addressRegex = /^0x[a-fA-F0-9]{40}$/;
  if (!addressRegex.test(message.from)) {
    throw new Error(`Invalid "from" address: ${message.from}`);
  }
  if (!addressRegex.test(message.to)) {
    throw new Error(`Invalid "to" address: ${message.to}`);
  }

  const value = toBigInt(message.value);
  if (value < 0n) {
    throw new Error(`"value" must be non-negative: ${value}`);
  }

  const validAfter = toBigInt(message.validAfter);
  const validBefore = toBigInt(message.validBefore);

  if (validAfter < 0n) {
    throw new Error(`"validAfter" must be non-negative: ${validAfter}`);
  }
  if (validBefore < 0n) {
    throw new Error(`"validBefore" must be non-negative: ${validBefore}`);
  }
  if (validAfter >= validBefore) {
    throw new Error(
      `"validAfter" (${validAfter}) must be before "validBefore" (${validBefore})`,
    );
  }

  const nonce = toBigInt(message.nonce);
  if (nonce < 0n) {
    throw new Error(`"nonce" must be non-negative: ${nonce}`);
  }

  return true;
};

export const parseSignature = (
  signature: string,
): {
  v: number;
  r: string;
  s: string;
} => {
  const hexSig = signature.startsWith("0x") ? signature.slice(2) : signature;

  if (hexSig.length !== 130) {
    throw new Error(
      `Invalid signature length: ${hexSig.length} (expected 130)`,
    );
  }

  return {
    r: `0x${hexSig.slice(0, 64)}`,
    s: `0x${hexSig.slice(64, 128)}`,
    v: parseInt(hexSig.slice(128, 130), 16),
  };
};

export const concatenateSignature = (
  v: number,
  r: string,
  s: string,
): string => {
  const rHex = r.startsWith("0x") ? r.slice(2) : r;
  const sHex = s.startsWith("0x") ? s.slice(2) : s;
  const vHex = v.toString(16).padStart(2, "0");

  return `0x${rHex}${sHex}${vHex}`;
};

export const adjustVForChainId = (v: number, chainId: number): number => {
  if (v === 27 || v === 28) return v;
  const chainIdBit = chainId * 2 + 35;
  return v - chainIdBit + 27;
};

export const signTypedData = async (
  _account: Web3BaseWalletAccount | Web3BaseWallet<Web3BaseWalletAccount>,
  _domain: Web3EIP712Domain,
  _message: Record<string, string>,
): Promise<{ v: number; r: string; s: string }> => {
  throw new Error(
    "EIP-712 signing requires web3-eth-personal or wallet provider.",
  );
};

export const signWithPrivateKey = async (
  _privateKey: string,
  _domain: Web3EIP712Domain,
  _message: Record<string, string>,
): Promise<{ v: number; r: string; s: string }> => {
  throw new Error(
    "Direct private key signing not implemented. Use wallet provider's signTypedData method instead.",
  );
};
