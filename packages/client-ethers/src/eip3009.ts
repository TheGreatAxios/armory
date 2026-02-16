import { ethers, type Signer } from "ethers";
import {
  createEIP712Domain,
  type TransferWithAuthorization,
} from "@armory-sh/base";
import type {
  TransferWithAuthorizationParams,
  EIP712Domain as EIP712DomainType,
} from "./types";
import { AuthorizationError } from "./errors";

const EIP712_TYPES_ETHERS = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
};

export async function signEIP3009(
  signer: Signer,
  params: TransferWithAuthorizationParams,
  domain: EIP712DomainType
): Promise<{ v: number; r: string; s: string }> {
  try {
    const message: TransferWithAuthorization = {
      from: params.from,
      to: params.to,
      value: BigInt(params.value),
      validAfter: BigInt(params.validAfter),
      validBefore: BigInt(params.validBefore),
      nonce: params.nonce,
    };

    const signature = await signer.signTypedData(domain, EIP712_TYPES_ETHERS, message);
    const { v, r, s } = ethers.Signature.from(signature);

    return { v: Number(v), r: r as string, s: s as string };
  } catch (error) {
    throw new AuthorizationError(
      `Failed to sign EIP-3009 authorization: ${error instanceof Error ? error.message : "Unknown error"}`,
      error
    );
  }
}

export async function signEIP3009WithDomain(
  signer: Signer,
  params: TransferWithAuthorizationParams,
  chainId: number,
  verifyingContract: `0x${string}`,
  domainName?: string,
  domainVersion?: string
): Promise<{ v: number; r: string; s: string }> {
  const domain = createEIP712Domain(chainId, verifyingContract);
  const customDomain = domainName || domainVersion
    ? { ...domain, name: domainName ?? domain.name, version: domainVersion ?? domain.version }
    : domain;
  return signEIP3009(signer, params, customDomain as EIP712DomainType);
}

export async function signPayment(
  signer: Signer,
  from: `0x${string}`,
  to: `0x${string}`,
  value: bigint,
  chainId: number,
  verifyingContract: `0x${string}`,
  expirySeconds: number = 3600,
  domainName?: string,
  domainVersion?: string
): Promise<{ v: number; r: string; s: string; nonce: `0x${string}` }> {
  const now = Math.floor(Date.now() / 1000);
  const nonce = `0x${(now * 1000).toString(16).padStart(64, "0")}` as `0x${string}`;

  const signature = await signEIP3009WithDomain(
    signer,
    { from, to, value, validAfter: 0n, validBefore: BigInt(now + expirySeconds), nonce },
    chainId,
    verifyingContract,
    domainName,
    domainVersion
  );

  return { ...signature, nonce };
}

export async function recoverEIP3009Signer(
  params: TransferWithAuthorizationParams,
  signature: { v: number; r: string; s: string },
  domain: EIP712DomainType
): Promise<`0x${string}`> {
  const message: TransferWithAuthorization = {
    from: params.from,
    to: params.to,
    value: BigInt(params.value),
    validAfter: BigInt(params.validAfter),
    validBefore: BigInt(params.validBefore),
    nonce: params.nonce,
  };

  const sig = ethers.Signature.from({
    v: signature.v,
    r: signature.r,
    s: signature.s,
  });

  const address = ethers.verifyTypedData(domain, EIP712_TYPES_ETHERS, message, sig);
  return address as `0x${string}`;
}

export { ethers };
