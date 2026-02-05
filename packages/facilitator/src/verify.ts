import type { Address, Hash } from "viem";
import { recoverAddress, hashTypedData, createPublicClient, http } from "viem";
import type {
  PaymentPayload,
  PaymentPayloadV1,
  PaymentPayloadV2,
  PaymentRequirements,
  CustomToken,
} from "@armory-sh/base";
import { isV1, isV2, ERC20_ABI, EIP712_TYPES, NETWORKS, getCustomToken } from "@armory-sh/base";
import type { NonceTracker } from "./nonce/types.js";

export class PaymentVerificationError extends Error {
  override readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "PaymentVerificationError";
    this.cause = cause;
  }
}

export class InvalidSignatureError extends PaymentVerificationError {
  constructor(message: string = "Invalid signature") {
    super(message);
    this.name = "InvalidSignatureError";
  }
}

export class InsufficientBalanceError extends PaymentVerificationError {
  constructor(
    public readonly requiredAmount: bigint,
    public readonly actualBalance: bigint
  ) {
    super(`Insufficient balance: required ${requiredAmount}, have ${actualBalance}`);
    this.name = "InsufficientBalanceError";
  }
}

export class NonceUsedError extends PaymentVerificationError {
  constructor(public readonly nonce: string | number | bigint) {
    super(`Nonce has already been used: ${nonce}`);
    this.name = "NonceUsedError";
  }
}

export class PaymentExpiredError extends PaymentVerificationError {
  constructor(
    public readonly expiry: number,
    public readonly currentTime: number
  ) {
    super(`Payment expired at ${expiry}, current time is ${currentTime}`);
    this.name = "PaymentExpiredError";
  }
}

export class PaymentNotYetValidError extends PaymentVerificationError {
  constructor(
    public readonly validAfter: number,
    public readonly currentTime: number
  ) {
    super(`Payment not valid until ${validAfter}, current time is ${currentTime}`);
    this.name = "PaymentNotYetValidError";
  }
}

export class UnsupportedNetworkError extends PaymentVerificationError {
  constructor(public readonly chainId: number | string) {
    super(`Unsupported network with chain ID: ${chainId}`);
    this.name = "UnsupportedNetworkError";
  }
}

export class InvalidPayloadError extends PaymentVerificationError {
  constructor(message: string) {
    super(`Invalid payload: ${message}`);
    this.name = "InvalidPayloadError";
  }
}

export interface VerificationSuccess {
  success: true;
  payerAddress: Address;
  balance: bigint;
  requiredAmount: bigint;
}

export interface VerificationFailure {
  success: false;
  error: PaymentVerificationError;
}

export type VerificationResult = VerificationSuccess | VerificationFailure;

export interface VerifyPaymentOptions {
  nonceTracker?: NonceTracker;
  rpcUrl?: string;
  expiryGracePeriod?: number;
  skipBalanceCheck?: boolean;
  skipNonceCheck?: boolean;
  domainName?: string;
  domainVersion?: string;
  token?: CustomToken;
}

const validateVersionsMatch = (
  payload: PaymentPayload,
  requirements: PaymentRequirements
): void => {
  const payloadIsV1 = isV1(payload);
  const requirementsIsV1 = "contractAddress" in requirements && "network" in requirements;

  if (payloadIsV1 !== requirementsIsV1) {
    throw new InvalidPayloadError(`Payload version (v${payloadIsV1 ? 1 : 2}) does not match requirements version`);
  }
};

const verifySignatureAndPayer = async (
  payload: PaymentPayload,
  network: ReturnType<typeof getNetworkByChainId>,
  contractAddress: Address,
  fromAddress: Address,
  options: VerifyPaymentOptions
): Promise<Address> => {
  if (!network) throw new UnsupportedNetworkError(fromAddress);

  const payerAddress = await verifySignature(payload, network, contractAddress, options);
  if (payerAddress !== fromAddress) {
    throw new InvalidSignatureError(
      `Signer address ${payerAddress} does not match from address ${fromAddress}`
    );
  }
  return payerAddress;
};

const performBalanceCheck = async (
  payerAddress: Address,
  contractAddress: Address,
  network: { rpcUrl?: string },
  requirements: PaymentRequirements,
  customRpcUrl?: string
): Promise<VerificationSuccess> => {
  const requiredAmount = BigInt(requirements.amount);
  const rpcUrl = customRpcUrl ?? network.rpcUrl;
  if (!rpcUrl) throw new InvalidPayloadError("Missing RPC URL for balance check");

  const balance = await checkBalance(payerAddress, contractAddress, { rpcUrl } as { rpcUrl: string }, undefined);

  if (balance < requiredAmount) {
    throw new InsufficientBalanceError(requiredAmount, balance);
  }

  return { success: true, payerAddress, balance, requiredAmount };
};

export async function verifyPayment(
  payload: PaymentPayload,
  requirements: PaymentRequirements,
  options: VerifyPaymentOptions = {}
): Promise<VerificationResult> {
  try {
    validatePayload(payload);
    validateRequirements(requirements);
    validateVersionsMatch(payload, requirements);

    const { chainId, contractAddress, fromAddress } = extractPaymentDetails(payload);
    const network = getNetworkByChainId(chainId);

    const payerAddress = await verifySignatureAndPayer(
      payload,
      network,
      contractAddress,
      fromAddress,
      options
    );

    checkExpiry(payload, options.expiryGracePeriod);
    if (!options.skipNonceCheck) checkNonce(payload, options.nonceTracker);

    return options.skipBalanceCheck
      ? { success: true, payerAddress, balance: 0n, requiredAmount: BigInt(requirements.amount) }
      : await performBalanceCheck(payerAddress, contractAddress, network ?? {}, requirements, options.rpcUrl);
  } catch (error) {
    if (error instanceof PaymentVerificationError) {
      return { success: false, error };
    }
    return {
      success: false,
      error: new PaymentVerificationError("Unknown verification error", error),
    };
  }
}

const validateAddress = (address: string, fieldName: string): void => {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new InvalidPayloadError(`Invalid '${fieldName}' address: ${address}`);
  }
};

const validatePayload = (payload: PaymentPayload): void => {
  if (!payload.from) throw new InvalidPayloadError("Missing 'from' address");
  if (!payload.to) throw new InvalidPayloadError("Missing 'to' address");
  if (!payload.amount) throw new InvalidPayloadError("Missing 'amount'");
  if (!payload.nonce) throw new InvalidPayloadError("Missing 'nonce'");
  if (!payload.expiry) throw new InvalidPayloadError("Missing 'expiry'");

  validateAddress(payload.from, "from");

  const to = isV1(payload)
    ? payload.to
    : typeof payload.to === "string" ? payload.to : undefined;
  if (to) validateAddress(to, "to");
};

const validateRequirements = (requirements: PaymentRequirements): void => {
  if (!requirements.amount) throw new InvalidPayloadError("Missing required amount in requirements");
  if (!requirements.expiry) throw new InvalidPayloadError("Missing required expiry in requirements");
  if ("to" in requirements && !requirements.to) {
    throw new InvalidPayloadError("Missing required 'to' address in requirements");
  }
};

const extractPaymentDetails = (payload: PaymentPayload): {
  chainId: number;
  contractAddress: Address;
  fromAddress: Address;
} => {
  if (isV1(payload)) {
    return {
      chainId: payload.chainId,
      contractAddress: payload.contractAddress as Address,
      fromAddress: payload.from as Address,
    };
  }

  const chainIdMatch = payload.chainId.match(/^eip155:(\d+)$/);
  if (!chainIdMatch) throw new InvalidPayloadError(`Invalid CAIP-2 chain ID: ${payload.chainId}`);
  const chainId = Number.parseInt(chainIdMatch[1], 10);

  const assetIdMatch = payload.assetId.match(/^eip155:\d+\/erc20:(0x[a-fA-F0-9]{40})$/);
  if (!assetIdMatch) throw new InvalidPayloadError(`Invalid CAIP asset ID: ${payload.assetId}`);
  const contractAddress = assetIdMatch[1] as Address;

  return { chainId, contractAddress, fromAddress: payload.from };
};

const getNetworkByChainId = (chainId: number) => {
  for (const network of Object.values(NETWORKS)) {
    if (network.chainId === chainId) return network;
  }
  return undefined;
};

const getTokenDomain = (
  chainId: number,
  contractAddress: string,
  options: VerifyPaymentOptions
): { name: string; version: string } => {
  if (options.token) {
    return { name: options.token.name, version: options.token.version };
  }

  // Check for custom token in registry
  const customToken = getCustomToken(chainId, contractAddress);
  if (customToken) {
    return { name: customToken.name, version: customToken.version };
  }

  return {
    name: options.domainName ?? "USD Coin",
    version: options.domainVersion ?? "2",
  };
};

const verifySignature = async (
  payload: PaymentPayload,
  network: { name: string; chainId: number; usdcAddress: `0x${string}` },
  contractAddress: Address,
  options: VerifyPaymentOptions
): Promise<Address> => {
  if (isV1(payload)) return verifyV1Signature(payload, network, contractAddress, options);
  return verifyV2Signature(payload, network, contractAddress, options);
};

const recoverSignatureAddress = async (
  payload: PaymentPayloadV1 | PaymentPayloadV2,
  domain: { name: string; version: string },
  network: { chainId: number },
  contractAddress: Address
): Promise<Address> => {
  const hash = hashTypedData({
    domain: {
      name: domain.name,
      version: domain.version,
      chainId: network.chainId,
      verifyingContract: contractAddress,
    },
    types: EIP712_TYPES,
    primaryType: "TransferWithAuthorization",
    message: {
      from: payload.from as Address,
      to: isV1(payload)
        ? payload.to as Address
        : typeof payload.to === "string"
          ? payload.to as Address
          : ("0x0000000000000000000000000000000000000000" as Address),
      value: BigInt(payload.amount),
      validAfter: 0n,
      validBefore: BigInt(payload.expiry),
      nonce: toNonceBigInt(payload.nonce),
    },
  });

  // Convert { v, r, s } to viem's { r, s, yParity } format
  const v1Sig = isV1(payload)
    ? { v: payload.v, r: payload.r, s: payload.s }
    : payload.signature;
  const sig = {
    r: v1Sig.r as `0x${string}`,
    s: v1Sig.s as `0x${string}`,
    yParity: v1Sig.v === 27 ? 0 : 1,
  };

  return await recoverAddress({ hash, signature: sig });
};

const verifyV1Signature = async (
  payload: PaymentPayloadV1,
  network: { chainId: number },
  contractAddress: Address,
  options: VerifyPaymentOptions
): Promise<Address> => await recoverSignatureAddress(payload, getTokenDomain(network.chainId, contractAddress, options), network, payload.contractAddress as Address);

const verifyV2Signature = async (
  payload: PaymentPayloadV2,
  network: { chainId: number; usdcAddress: `0x${string}` },
  contractAddress: Address,
  options: VerifyPaymentOptions
): Promise<Address> => await recoverSignatureAddress(payload, getTokenDomain(network.chainId, contractAddress, options), network, contractAddress);

const toNonceBigInt = (nonce: string | number | bigint): bigint => {
  if (typeof nonce === "bigint") return nonce;
  if (typeof nonce === "number") return BigInt(nonce);

  try {
    const num = Number.parseInt(nonce, 10);
    if (!Number.isNaN(num)) return BigInt(num);
  } catch {}

  if (nonce.startsWith("0x")) return BigInt(nonce);
  return BigInt(Date.now());
};

const checkExpiry = (payload: PaymentPayload, gracePeriodSeconds = 0): void => {
  const now = Math.floor(Date.now() / 1000);
  const expiry = payload.expiry;

  if (expiry < now - gracePeriodSeconds) {
    throw new PaymentExpiredError(expiry, now);
  }
};

const checkNonce = (payload: PaymentPayload, nonceTracker?: NonceTracker): void => {
  if (!nonceTracker) return;

  const nonce = payload.nonce;
  if (nonceTracker.isUsed(nonce)) {
    throw new NonceUsedError(nonce);
  }

  nonceTracker.markUsed(nonce);
};

const checkBalance = async (
  payerAddress: Address,
  contractAddress: Address,
  network: { rpcUrl: string },
  customRpcUrl?: string
): Promise<bigint> => {
  const rpcUrl = customRpcUrl ?? network.rpcUrl;

  const client = createPublicClient({
    transport: http(rpcUrl),
  });

  const balance = await client.readContract({
    address: contractAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [payerAddress],
  });

  return balance as bigint;
};
