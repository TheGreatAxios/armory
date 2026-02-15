import type {
  PaymentPayload,
  PaymentPayloadV1,
  PaymentPayloadV2,
  X402PaymentPayloadV1,
  LegacyPaymentPayloadV1,
} from "@armory-sh/base";
import { ERC20_ABI, getNetworkByChainId, isPaymentV1, isLegacyPaymentPayloadV1 } from "@armory-sh/base";
import type { WalletClient } from "viem";
import {
  BaseError,
  ContractFunctionExecutionError,
  ContractFunctionRevertedError,
} from "viem";

export class SettlementError extends Error {
  override readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "SettlementError";
    this.cause = cause;
  }
}

export class InvalidPaymentError extends SettlementError {
  constructor(message: string, cause?: unknown) {
    super(`Invalid payment payload: ${message}`, cause);
    this.name = "InvalidPaymentError";
  }
}

export class NetworkNotFoundError extends SettlementError {
  constructor(chainId: number) {
    super(`Network configuration not found for chainId: ${chainId}`);
    this.name = "NetworkNotFoundError";
  }
}

export class ContractExecutionError extends SettlementError {
  constructor(message: string, cause?: unknown) {
    super(`Contract execution failed: ${message}`, cause);
    this.name = "ContractExecutionError";
  }
}

export class AuthorizationExpiredError extends SettlementError {
  constructor(expiry: number) {
    const expiryDate = new Date(expiry * 1000);
    super(`Authorization expired at ${expiryDate.toISOString()}`);
    this.name = "AuthorizationExpiredError";
  }
}

export class InvalidSignatureError extends SettlementError {
  constructor(message: string = "Invalid signature provided") {
    super(message);
    this.name = "InvalidSignatureError";
  }
}

export class NonceAlreadyUsedError extends SettlementError {
  constructor(nonce: string) {
    super(`Nonce already used: ${nonce}`);
    this.name = "NonceAlreadyUsedError";
  }
}

export interface SettlementResult {
  txHash: string;
  blockNumber?: bigint;
}

export interface SettlePaymentParams {
  paymentPayload: PaymentPayload;
  walletClient: WalletClient;
  contractAddress?: `0x${string}`;
  validAfter?: bigint;
}

export async function settlePayment(
  params: SettlePaymentParams
): Promise<SettlementResult> {
  const { paymentPayload, walletClient, contractAddress, validAfter } = params;

  const settlementParams = extractSettlementParams(paymentPayload);
  validateExpiry(settlementParams.expiry);

  const networkConfig = getNetworkByChainId(settlementParams.chainId);
  if (!networkConfig) throw new NetworkNotFoundError(settlementParams.chainId);

  const usdcAddress = contractAddress ?? networkConfig.usdcAddress;

  try {
    const hash = await walletClient.writeContract({
      address: usdcAddress,
      abi: ERC20_ABI,
      functionName: "transferWithAuthorization",
      args: [
        settlementParams.from,
        settlementParams.to,
        settlementParams.value,
        validAfter ?? 0n,
        settlementParams.expiry,
        settlementParams.v,
        settlementParams.r,
        settlementParams.s,
      ],
    } as any);

    return { txHash: hash };
  } catch (error) {
    throw handleContractError(error);
  }
}

const extractSettlementParams = (payload: PaymentPayload): {
  from: `0x${string}`;
  to: `0x${string}`;
  value: bigint;
  expiry: bigint;
  v: number;
  r: `0x${string}`;
  s: `0x${string}`;
  chainId: number;
} => {
  if (isPaymentV1(payload)) return extractV1Params(payload);
  return extractV2Params(payload);
};

const extractV1Params = (payload: PaymentPayloadV1): {
  from: `0x${string}`;
  to: `0x${string}`;
  value: bigint;
  expiry: bigint;
  v: number;
  r: `0x${string}`;
  s: `0x${string}`;
  chainId: number;
} => {
  // Handle x402 V1 format (nested structure)
  if (!isLegacyPaymentPayloadV1(payload)) {
    return extractX402V1Params(payload as X402PaymentPayloadV1);
  }

  // Handle legacy V1 format (direct properties)
  const legacy = payload as LegacyPaymentPayloadV1;
  if (!legacy.amount) throw new InvalidPaymentError("Missing 'amount'");
  if (!legacy.nonce) throw new InvalidPaymentError("Missing 'nonce'");
  if (!legacy.expiry || legacy.expiry <= 0) {
    throw new InvalidPaymentError("Invalid 'expiry'");
  }
  if (!legacy.chainId || legacy.chainId <= 0) {
    throw new InvalidPaymentError("Invalid 'chainId'");
  }

  return {
    from: validateAddress(legacy.from, "from"),
    to: validateAddress(legacy.to, "to"),
    value: parseAmount(legacy.amount),
    expiry: BigInt(legacy.expiry),
    v: (() => { validateV(legacy.v); return legacy.v; })(),
    r: validateHex64(legacy.r, "r"),
    s: validateHex64(legacy.s, "s"),
    chainId: legacy.chainId,
  };
};

const extractX402V1Params = (payload: X402PaymentPayloadV1): {
  from: `0x${string}`;
  to: `0x${string}`;
  value: bigint;
  expiry: bigint;
  v: number;
  r: `0x${string}`;
  s: `0x${string}`;
  chainId: number;
} => {
  if (!payload.payload || !payload.payload.authorization || !payload.payload.signature) {
    throw new InvalidPaymentError("Invalid x402 V1 payload: missing payload.authorization or payload.signature");
  }
  const { authorization, signature: fullSig } = payload.payload;

  const r = `0x${fullSig.slice(2, 66)}` as `0x${string}`;
  const s = `0x${fullSig.slice(66, 130)}` as `0x${string}`;
  const v = parseInt(fullSig.slice(130, 132), 16);

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
  const chainId = networkToChainId[payload.network] ?? 8453; // Default to Base

  if (!authorization.value) throw new InvalidPaymentError("Missing 'value'");
  if (!authorization.nonce) throw new InvalidPaymentError("Missing 'nonce'");
  if (!authorization.validBefore || parseInt(authorization.validBefore) <= 0) {
    throw new InvalidPaymentError("Invalid 'validBefore'");
  }

  validateV(v);
  validateHex64(r, "r");
  validateHex64(s, "s");

  return {
    from: validateAddress(authorization.from, "from"),
    to: validateAddress(authorization.to, "to"),
    value: BigInt(authorization.value),
    expiry: BigInt(authorization.validBefore),
    v,
    r,
    s,
    chainId,
  };
};

const validateAddress = (value: string | undefined, fieldName: string): `0x${string}` => {
  if (!value || !/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new InvalidPaymentError(`Invalid '${fieldName}' address`);
  }
  return value as `0x${string}`;
};

const validateHex64 = (value: string, fieldName: string): `0x${string}` => {
  if (!value || !/^0x[a-fA-F0-9]{64}$/.test(value)) {
    throw new InvalidPaymentError(`Invalid '${fieldName}' value`);
  }
  return value as `0x${string}`;
};

const validateV = (v: number): void => {
  if (v !== 27 && v !== 28) {
    throw new InvalidPaymentError(`Invalid 'v' value: ${v}`);
  }
};

const parseCAIP2ChainId = (chainId: string): number => {
  const match = chainId.match(/^eip155:(\d+)$/);
  if (!match) throw new InvalidPaymentError(`Invalid CAIP-2 chainId: ${chainId}`);
  return parseInt(match[1], 10);
};

const extractV2Params = (payload: PaymentPayloadV2): {
  from: `0x${string}`;
  to: `0x${string}`;
  value: bigint;
  expiry: bigint;
  v: number;
  r: `0x${string}`;
  s: `0x${string}`;
  chainId: number;
} => {
  if (!payload.payload || !payload.payload.authorization || !payload.payload.signature) {
    throw new InvalidPaymentError("Invalid x402 V2 payload: missing payload.authorization or payload.signature");
  }
  const { authorization, signature: fullSig } = payload.payload;

  const r = `0x${fullSig.slice(2, 66)}` as `0x${string}`;
  const s = `0x${fullSig.slice(66, 130)}` as `0x${string}`;
  const v = parseInt(fullSig.slice(130, 132), 16);

  const from = validateAddress(authorization.from, "from");
  const to = validateAddress(authorization.to, "to");

  if (!authorization.value) throw new InvalidPaymentError("Missing 'value'");
  if (!authorization.nonce) throw new InvalidPaymentError("Missing 'nonce'");
  if (!authorization.validBefore || parseInt(authorization.validBefore) <= 0) {
    throw new InvalidPaymentError("Invalid 'validBefore'");
  }

  validateV(v);
  validateHex64(r, "signature 'r'");
  validateHex64(s, "signature 's'");

  return {
    from,
    to,
    value: BigInt(authorization.value),
    expiry: BigInt(authorization.validBefore),
    v,
    r,
    s,
    chainId: parseCAIP2ChainId(payload.network),
  };
};

const parseAmount = (amount: string): bigint => {
  const trimmed = amount.trim();

  if (trimmed.includes(".")) {
    const parts = trimmed.split(".");
    if (parts.length !== 2) {
      throw new InvalidPaymentError(`Invalid amount format: ${amount}`);
    }

    const [whole, fractional] = parts;
    const fractionalPadded = (fractional ?? "").padEnd(6, "0").slice(0, 6);
    return BigInt(whole + fractionalPadded);
  }

  return BigInt(trimmed) * 1_000_000n;
};

const validateExpiry = (expiry: bigint): void => {
  const now = BigInt(Math.floor(Date.now() / 1000));

  if (expiry <= now) {
    throw new AuthorizationExpiredError(Number(expiry));
  }
};

const extractRevertReason = (
  error: ContractFunctionExecutionError | ContractFunctionRevertedError
): string | null => {
  try {
    if ("reason" in error && typeof error.reason === "string") {
      return error.reason;
    }

    if ("data" in error && error.data) {
      if (typeof error.data === "string") return `Contract revert: ${error.data}`;
      if (typeof error.data === "object" && "errorName" in error.data) return String(error.data.errorName);
    }

    return null;
  } catch {
    return null;
  }
};

const createErrorFromMessage = (message: string, error: BaseError): SettlementError => {
  if (message.includes("expired")) return new AuthorizationExpiredError(0);
  if (message.includes("invalid signature") || message.includes("signature")) {
    return new InvalidSignatureError(message);
  }
  if (message.includes("nonce") && (message.includes("used") || message.includes("replay"))) {
    return new NonceAlreadyUsedError("unknown");
  }

  if (
    error instanceof ContractFunctionExecutionError ||
    error instanceof ContractFunctionRevertedError
  ) {
    const reason = extractRevertReason(error);
    if (reason) return new ContractExecutionError(reason, error);
  }

  return new ContractExecutionError(message, error);
};

const handleContractError = (error: unknown): SettlementError => {
  if (error instanceof BaseError) {
    return createErrorFromMessage(error.message, error);
  }

  return new SettlementError(
    error instanceof Error ? error.message : "Unknown error",
    error
  );
};
