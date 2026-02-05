import type { Signer } from "ethers";
import {
  encodePaymentV1,
  encodePaymentV2,
  V1_HEADERS,
  V2_HEADERS,
  getNetworkByChainId,
  type PaymentPayloadV1,
  type PaymentPayloadV2,
  type PaymentRequirements,
  type CAIP2ChainId,
  type CAIPAssetId,
} from "@armory/base";
import type { TransferWithAuthorizationParams } from "./types";
import { signEIP3009 } from "./eip3009";

export async function createPaymentPayloadV1(params: {
  signer: Signer;
  from: string;
  to: string;
  amount: string;
  nonce: string;
  expiry: number;
  chainId: number;
  contractAddress: string;
  network: string;
  domainName?: string;
  domainVersion?: string;
}): Promise<string> {
  const { signer, from, to, amount, nonce, expiry, chainId, contractAddress, network, domainName, domainVersion } = params;

  const authParams: TransferWithAuthorizationParams = {
    from: from as `0x${string}`,
    to: to as `0x${string}`,
    value: BigInt(Math.floor(parseFloat(amount) * 1e6)),
    validAfter: 0n,
    validBefore: BigInt(expiry),
    nonce: BigInt(nonce),
  };

  const domain = {
    name: domainName ?? "USD Coin",
    version: domainVersion ?? "2",
    chainId,
    verifyingContract: contractAddress as `0x${string}`,
  };

  const signature = await signEIP3009(signer, authParams, domain);

  const payload: PaymentPayloadV1 = {
    from,
    to,
    amount,
    nonce,
    expiry,
    v: signature.v,
    r: signature.r,
    s: signature.s,
    chainId,
    contractAddress,
    network,
  };

  return encodePaymentV1(payload);
}

export async function createPaymentPayloadV2(params: {
  signer: Signer;
  from: `0x${string}`;
  to: `0x${string}` | { role?: string; callback?: string };
  amount: string;
  nonce: string;
  expiry: number;
  chainId: CAIP2ChainId;
  assetId: CAIPAssetId;
  extensions?: Record<string, unknown>;
  domainName?: string;
  domainVersion?: string;
}): Promise<string> {
  const { signer, from, to, amount, nonce, expiry, chainId, assetId, extensions, domainName, domainVersion } = params;

  const chainIdNum = parseInt(chainId.split(":")[1], 10);
  const contractAddress = assetId.split(":")[2] as `0x${string}`;

  const authParams: TransferWithAuthorizationParams = {
    from,
    to: typeof to === "string" ? to : ("0x0000000000000000000000000000000000000000" as `0x${string}`),
    value: BigInt(Math.floor(parseFloat(amount) * 1e6)),
    validAfter: 0n,
    validBefore: BigInt(expiry),
    nonce: BigInt(nonce),
  };

  const domain = {
    name: domainName ?? "USD Coin",
    version: domainVersion ?? "2",
    chainId: chainIdNum,
    verifyingContract: contractAddress,
  };

  const signature = await signEIP3009(signer, authParams, domain);

  const payload: PaymentPayloadV2 = {
    from,
    to,
    amount,
    nonce,
    expiry,
    signature: {
      v: signature.v,
      r: signature.r,
      s: signature.s,
    },
    chainId,
    assetId,
    extensions,
  };

  return encodePaymentV2(payload);
}

export function detectProtocolVersion(requirements: PaymentRequirements): 1 | 2 {
  if ("contractAddress" in requirements && "network" in requirements) {
    return 1;
  }
  return 2;
}

export async function createPaymentPayload(
  requirements: PaymentRequirements,
  signer: Signer,
  from: string
): Promise<[string, string]> {
  const version = detectProtocolVersion(requirements);
  const now = Math.floor(Date.now() / 1000);
  const nonce = now.toString();
  const expiry = now + 3600;

  if (version === 1) {
    const req = requirements as { network: string; contractAddress: string; payTo: string; amount: string };
    const networkConfig = getNetworkByChainId(
      parseInt(req.contractAddress.slice(0, 10), 16)
    );

    const payload = await createPaymentPayloadV1({
      signer,
      from,
      to: req.payTo,
      amount: req.amount,
      nonce,
      expiry,
      chainId: networkConfig?.chainId || 1,
      contractAddress: req.contractAddress,
      network: req.network,
    });

    return [payload, V1_HEADERS.PAYMENT];
  }

  const req = requirements as {
    to: `0x${string}` | { role?: string; callback?: string };
    amount: string;
    chainId: string;
    assetId: string;
  };

  const payload = await createPaymentPayloadV2({
    signer,
    from: from as `0x${string}`,
    to: req.to,
    amount: req.amount,
    nonce,
    expiry,
    chainId: req.chainId as CAIP2ChainId,
    assetId: req.assetId as CAIPAssetId,
  });

  return [payload, V2_HEADERS.PAYMENT_SIGNATURE];
}

export async function parsePaymentRequirements(response: Response): Promise<PaymentRequirements> {
  const v2Header = response.headers.get(V2_HEADERS.PAYMENT_REQUIRED);
  if (v2Header) {
    return JSON.parse(v2Header);
  }

  try {
    return await response.json() as PaymentRequirements;
  } catch {
    throw new Error("No payment requirements found in response");
  }
}
