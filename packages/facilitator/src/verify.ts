import type { Address, Hash } from "viem";
import { recoverAddress, hashTypedData, createPublicClient, http } from "viem";
import type {
  PaymentPayload,
  PaymentPayloadV1,
  PaymentPayloadV2,
  PaymentRequirements,
  CustomToken,
  X402PaymentPayloadV1,
  LegacyPaymentPayloadV1,
} from "@armory-sh/base";
import { isX402V1Payload, isX402V2Payload, isLegacyV1Payload, isPaymentV1, isPaymentV2, ERC20_ABI, EIP712_TYPES, NETWORKS, getCustomToken } from "@armory-sh/base";
import type { NonceTracker } from "./nonce/types.js";

// ============================================================================
// Helper functions to extract values from nested x402 structures
// ============================================================================

const isX402V1 = (payload: PaymentPayload): payload is X402PaymentPayloadV1 =>
  isX402V1Payload(payload);

const isX402V2 = (payload: PaymentPayload): payload is PaymentPayloadV2 =>
  isX402V2Payload(payload);

const isLegacyV1 = (payload: PaymentPayload): payload is LegacyPaymentPayloadV1 =>
  isLegacyV1Payload(payload);

const extractFrom = (payload: PaymentPayload): string => {
  if (isX402V1(payload)) return payload.payload.authorization.from;
  if (isLegacyV1(payload)) return payload.from;
  if (isX402V2(payload)) return payload.payload.authorization.from;
  throw new InvalidPayloadError("Invalid payload structure: cannot extract 'from' address");
};

const extractTo = (payload: PaymentPayload): string => {
  if (isX402V1(payload)) return payload.payload.authorization.to;
  if (isLegacyV1(payload)) return payload.to;
  if (isX402V2(payload)) return payload.payload.authorization.to;
  throw new InvalidPayloadError("Invalid payload structure: cannot extract 'to' address");
};

const extractValue = (payload: PaymentPayload): string => {
  if (isX402V1(payload)) return payload.payload.authorization.value;
  if (isLegacyV1(payload)) return payload.amount;
  if (isX402V2(payload)) return payload.payload.authorization.value;
  throw new InvalidPayloadError("Invalid payload structure: cannot extract amount");
};

const extractNonce = (payload: PaymentPayload): string => {
  if (isX402V1(payload)) return payload.payload.authorization.nonce;
  if (isLegacyV1(payload)) return payload.nonce;
  if (isX402V2(payload)) return payload.payload.authorization.nonce;
  throw new InvalidPayloadError("Invalid payload structure: cannot extract nonce");
};

const extractExpiry = (payload: PaymentPayload): number => {
  if (isX402V1(payload)) return parseInt(payload.payload.authorization.validBefore, 10);
  if (isLegacyV1(payload)) return payload.expiry;
  if (isX402V2(payload)) return parseInt(payload.payload.authorization.validBefore, 10);
  throw new InvalidPayloadError("Invalid payload structure: cannot extract expiry");
};

const extractChainId = (payload: PaymentPayload): number => {
  if (isX402V1(payload)) {
    const networkToChainId: Record<string, number> = {
      "base": 8453,
      "base-sepolia": 84532,
      "ethereum": 1,
      "ethereum-sepolia": 11155111,
      "polygon": 137,
      "polygon-amoy": 80002,
      "arbitrum": 42161,
      "arbitrum-sepolia": 421614,
      "optimism": 10,
      "optimism-sepolia": 11155420,
    };
    return networkToChainId[payload.network] ?? 8453;
  }
  if (isLegacyV1(payload)) return payload.chainId;
  // V2 CAIP-2 format: eip155:{chainId}
  const match = payload.accepted.network.match(/^eip155:(\d+)$/);
  if (!match) throw new InvalidPayloadError(`Invalid CAIP-2 chain ID: ${payload.accepted.network}`);
  return parseInt(match[1], 10);
};

const extractContractAddress = (payload: PaymentPayload): string => {
  if (isX402V1(payload)) {
    // For x402 V1, we need to get the contract address from the asset in requirements
    // or use a default USDC address based on network
    const networkToAddress: Record<string, string> = {
      "base": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
      "base-sepolia": "0x036bd51497f7f969ef59aBaadF254486EA431C8e",
      "ethereum": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      "ethereum-sepolia": "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
      "polygon": "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
      "polygon-amoy": "0x41e94eb011e5644eb7edcae66bb0748983356c4b",
      "arbitrum": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      "arbitrum-sepolia": "0x75faf114eafb1a353f7c805b6e268a0db3c29b58",
      "optimism": "0x7b5eb834b866e62c5a3616f46ae63df5acddbcde",
      "optimism-sepolia": "0xe05a0646e49d56bc01ad2e394a89cc0f6a51bd07",
    };
    return networkToAddress[payload.network] ?? "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
  }
  if (isLegacyV1(payload)) return payload.contractAddress;
  // For V2, extract from the accepted.asset or from assetId if available
  const assetId = (payload as any).assetId as string | undefined;
  if (assetId) {
    const match = assetId.match(/^eip155:\d+\/erc20:(0x[a-fA-F0-9]{40})$/);
    if (match) return match[1];
  }
  // Fallback to USDC on Base
  return "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
};

const extractSignature = (payload: PaymentPayload): { v: number; r: string; s: string } => {
  if (isX402V1(payload)) {
    const sig = payload.payload.signature;
    return {
      v: parseInt(sig.slice(130, 132), 16),
      r: `0x${sig.slice(2, 66)}`,
      s: `0x${sig.slice(66, 130)}`,
    };
  }
  if (isLegacyV1(payload)) {
    return { v: payload.v, r: payload.r, s: payload.s };
  }
  const sig = payload.payload.signature;
  return {
    v: parseInt(sig.slice(130, 132), 16),
    r: `0x${sig.slice(2, 66)}`,
    s: `0x${sig.slice(66, 130)}`,
  };
};

const extractRequirementsAmount = (requirements: PaymentRequirements): string => {
  if ("maxAmountRequired" in requirements) return requirements.maxAmountRequired;
  if ("amount" in requirements) return requirements.amount;
  throw new InvalidPayloadError("Missing amount in requirements");
};

const requirementsHasExpiry = (requirements: PaymentRequirements): boolean =>
  "expiry" in requirements && typeof requirements.expiry === "number";

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
  const payloadIsV1 = isPaymentV1(payload);
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
  const requiredAmount = BigInt(extractRequirementsAmount(requirements));
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

    const chainId = extractChainId(payload);
    const contractAddress = extractContractAddress(payload) as Address;
    const fromAddress = extractFrom(payload) as Address;
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
      ? { success: true, payerAddress, balance: 0n, requiredAmount: BigInt(extractRequirementsAmount(requirements)) }
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
  const from = extractFrom(payload);
  const to = extractTo(payload);
  const value = extractValue(payload);
  const nonce = extractNonce(payload);
  const expiry = extractExpiry(payload);

  if (!from) throw new InvalidPayloadError("Missing 'from' address");
  if (!to) throw new InvalidPayloadError("Missing 'to' address");
  if (!value) throw new InvalidPayloadError("Missing 'amount'");
  if (!nonce) throw new InvalidPayloadError("Missing 'nonce'");
  if (!expiry) throw new InvalidPayloadError("Missing 'expiry'");

  validateAddress(from, "from");
  validateAddress(to, "to");
};

const validateRequirements = (requirements: PaymentRequirements): void => {
  if (!extractRequirementsAmount(requirements)) throw new InvalidPayloadError("Missing required amount in requirements");
  if (!requirementsHasExpiry(requirements)) throw new InvalidPayloadError("Missing required expiry in requirements");
  if ("to" in requirements && !requirements.to) {
    throw new InvalidPayloadError("Missing required 'to' address in requirements");
  }
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
  if (isPaymentV1(payload)) return verifyV1Signature(payload, network, contractAddress, options);
  return verifyV2Signature(payload, network, contractAddress, options);
};

const recoverSignatureAddress = async (
  payload: PaymentPayload,
  domain: { name: string; version: string },
  network: { chainId: number },
  contractAddress: Address
): Promise<Address> => {
  const from = extractFrom(payload) as Address;
  const to = extractTo(payload) as Address;
  const value = extractValue(payload);
  const expiry = extractExpiry(payload);
  const nonce = extractNonce(payload);
  const sigData = extractSignature(payload);

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
      from,
      to,
      value: BigInt(value),
      validAfter: 0n,
      validBefore: BigInt(expiry),
      nonce: toNonceBigInt(nonce),
    },
  });

  const sig = {
    r: sigData.r as `0x${string}`,
    s: sigData.s as `0x${string}`,
    yParity: sigData.v === 27 ? 0 : 1,
  };

  return await recoverAddress({ hash, signature: sig });
};

const verifyV1Signature = async (
  payload: PaymentPayload,
  network: { chainId: number },
  contractAddress: Address,
  options: VerifyPaymentOptions
): Promise<Address> => await recoverSignatureAddress(payload, getTokenDomain(network.chainId, contractAddress, options), network, contractAddress);

const verifyV2Signature = async (
  payload: PaymentPayload,
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
  const expiry = extractExpiry(payload);

  if (expiry < now - gracePeriodSeconds) {
    throw new PaymentExpiredError(expiry, now);
  }
};

const checkNonce = (payload: PaymentPayload, nonceTracker?: NonceTracker): void => {
  if (!nonceTracker) return;

  const nonce = extractNonce(payload);
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
