/**
 * Client-side extension handling for x402
 * Integrates with @armory-sh/extensions package
 */

import type {
  PaymentPayloadV2,
  PaymentRequiredV2,
  Extensions,
  Address,
} from "@armory-sh/base";
import type {
  BazaarExtensionInfo,
  SIWxExtensionInfo,
  SIWxPayload,
} from "@armory-sh/extensions";
import type { X402Wallet } from "./protocol";
import { getWalletAddress } from "./protocol";
import { encodeUtf8ToBase64 } from "./bytes";

export interface ClientExtensionContext {
  bazaar?: BazaarExtensionInfo;
  signInWithX?: SIWxExtensionInfo;
}

export function parseExtensions(
  paymentRequired: PaymentRequiredV2
): ClientExtensionContext {
  const extensions = paymentRequired.extensions || {};
  const result: ClientExtensionContext = {};

  if (extensions.bazaar) {
    const bazaarExt = extensions.bazaar as unknown;
    if (bazaarExt && typeof bazaarExt === "object" && "info" in bazaarExt) {
      result.bazaar = (bazaarExt as { info: BazaarExtensionInfo }).info;
    }
  }

  if (extensions["sign-in-with-x"]) {
    const siwxExt = extensions["sign-in-with-x"] as unknown;
    if (siwxExt && typeof siwxExt === "object" && "info" in siwxExt) {
      result.signInWithX = (siwxExt as { info: SIWxExtensionInfo }).info;
    }
  }

  return result;
}

export function extractExtension<T>(
  extensions: Extensions | undefined,
  key: string
): T | null {
  if (!extensions || typeof extensions !== "object") {
    return null;
  }

  const extension = extensions[key];
  if (!extension || typeof extension !== "object") {
    return null;
  }

  const ext = extension as { info?: T };
  return ext.info || null;
}

export async function createSIWxProof(
  challenge: SIWxExtensionInfo,
  wallet: X402Wallet,
  nonce: string,
  expirationSeconds: number = 3600
): Promise<{ header: string; address: Address }> {
  const getDefaultDomain = (): string => {
    if (typeof window !== "undefined" && window.location) {
      return window.location.hostname;
    }
    return "localhost";
  };

  const address = getWalletAddress(wallet);
  const now = new Date();
  const expiration = new Date(now.getTime() + expirationSeconds * 1000);

  const payload: SIWxPayload = {
    domain: challenge.domain || getDefaultDomain(),
    resourceUri: challenge.resourceUri,
    address,
    statement: challenge.statement,
    version: challenge.version || "1",
    chainId: challenge.network,
    nonce,
    issuedAt: now.toISOString(),
    expirationTime: expiration.toISOString(),
  };

  const message = createSIWxMessage(payload);

  let signature: string;
  if (wallet.type === "account") {
    if (!wallet.account.signTypedData) {
      throw new Error("Wallet does not support signing");
    }
    signature = await wallet.account.signMessage({ message });
  } else {
    if (!wallet.walletClient.account.signTypedData) {
      throw new Error("Wallet does not support signing");
    }
    signature = await wallet.walletClient.account.signMessage({ message });
  }

  payload.signature = signature;

  const header = encodeSIWxHeader(payload);

  return { header, address };
}

function base64UrlEncode(str: string): string {
  return encodeUtf8ToBase64(str)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function createSIWxMessage(payload: SIWxPayload): string {
  const lines: string[] = [];

  lines.push(`${payload.domain} wants you to sign in`);

  if (payload.statement) {
    lines.push("");
    lines.push(payload.statement);
  }

  lines.push("");

  if (payload.resourceUri) {
    lines.push(`URI: ${payload.resourceUri}`);
  }

  if (payload.version) {
    lines.push(`Version: ${payload.version}`);
  }

  if (payload.nonce) {
    lines.push(`Nonce: ${payload.nonce}`);
  }

  if (payload.issuedAt) {
    lines.push(`Issued At: ${payload.issuedAt}`);
  }

  if (payload.expirationTime) {
    lines.push(`Expiration Time: ${payload.expirationTime}`);
  }

  if (payload.chainId) {
    const chains = Array.isArray(payload.chainId) ? payload.chainId.join(", ") : payload.chainId;
    lines.push(`Chain ID(s): ${chains}`);
  }

  return lines.join("\n");
}

function encodeSIWxHeader(payload: SIWxPayload): string {
  const payloadStr = JSON.stringify(payload);
  const encoded = base64UrlEncode(payloadStr);
  return `siwx-v1-${encoded}`;
}

export function addExtensionsToPayload(
  payload: PaymentPayloadV2,
  extensions?: Extensions
): PaymentPayloadV2 {
  if (!extensions || Object.keys(extensions).length === 0) {
    return payload;
  }

  return {
    ...payload,
    extensions,
  };
}

export type { BazaarExtensionInfo, SIWxExtensionInfo };
