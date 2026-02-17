export type TypedDataDomain = {
  name?: string;
  version?: string;
  chainId?: number;
  verifyingContract?: `0x${string}`;
  salt?: `0x${string}`;
};

export interface EIP712Domain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: `0x${string}`;
}

export interface TransferWithAuthorization {
  from: `0x${string}`;
  to: `0x${string}`;
  value: bigint;
  validAfter: bigint;
  validBefore: bigint;
  nonce: `0x${string}`;
}

export type TransferWithAuthorizationRecord = TransferWithAuthorization &
  Record<string, unknown>;

export type TypedDataField = { name: string; type: string };

export type EIP712Types = {
  TransferWithAuthorization: TypedDataField[];
};

export const EIP712_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ] as const,
} as const satisfies EIP712Types;

export const USDC_DOMAIN = {
  NAME: "USD Coin",
  VERSION: "2",
} as const;

export const createEIP712Domain = (
  chainId: number,
  contractAddress: `0x${string}`,
): EIP712Domain => ({
  name: USDC_DOMAIN.NAME,
  version: USDC_DOMAIN.VERSION,
  chainId,
  verifyingContract: contractAddress,
});

export const createTransferWithAuthorization = (
  params: Omit<
    TransferWithAuthorization,
    "value" | "validAfter" | "validBefore" | "nonce"
  > & {
    value: bigint | number;
    validAfter: bigint | number;
    validBefore: bigint | number;
    nonce: `0x${string}`;
  },
): TransferWithAuthorizationRecord => ({
  from: params.from,
  to: params.to,
  value: BigInt(params.value),
  validAfter: BigInt(params.validAfter),
  validBefore: BigInt(params.validBefore),
  nonce: params.nonce,
});

const isAddress = (value: string): boolean => /^0x[a-fA-F0-9]{40}$/.test(value);

const isBytes32 = (value: string): boolean => /^0x[a-fA-F0-9]{64}$/.test(value);

export const validateTransferWithAuthorization = (
  message: TransferWithAuthorization,
): boolean => {
  if (!isAddress(message.from))
    throw new Error(`Invalid "from" address: ${message.from}`);
  if (!isAddress(message.to))
    throw new Error(`Invalid "to" address: ${message.to}`);
  if (message.value < 0n)
    throw new Error(`"value" must be non-negative: ${message.value}`);
  if (message.validAfter < 0n)
    throw new Error(`"validAfter" must be non-negative: ${message.validAfter}`);
  if (message.validBefore < 0n)
    throw new Error(
      `"validBefore" must be non-negative: ${message.validBefore}`,
    );
  if (message.validAfter >= message.validBefore) {
    throw new Error(
      `"validAfter" (${message.validAfter}) must be before "validBefore" (${message.validBefore})`,
    );
  }
  if (!isBytes32(message.nonce))
    throw new Error(
      `"nonce" must be a valid bytes32 hex string: ${message.nonce}`,
    );
  return true;
};
