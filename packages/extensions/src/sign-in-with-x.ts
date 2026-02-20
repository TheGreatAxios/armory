/**
 * Sign-In-With-X (SIWX) Extension for x402
 * CAIP-122 wallet authentication for repeat access
 */

import { isAddress } from "@armory-sh/base";
import { type } from "arktype";
import type {
  Extension,
  SIWxExtensionConfig,
  SIWxExtensionInfo,
  SIWxPayload,
} from "./types.js";
import { SIGN_IN_WITH_X } from "./types.js";
import { createExtension } from "./validators.js";

const SIWX_INFO_TYPE = type({
  domain: "string",
  resourceUri: "string",
  network: "string | string[]",
  statement: "string",
  version: "string",
  expirationSeconds: "number",
  supportedChains: type({
    chainId: "string",
    type: "string",
  }).array(),
}).partial();

const SIWX_HEADER_PATTERN = /^siwx-v1-(.+)$/;

function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64UrlDecode(str: string): string {
  let padded = str;
  while (padded.length % 4) {
    padded += "=";
  }
  return atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
}

export function declareSIWxExtension(
  config: SIWxExtensionConfig = {},
): Extension<SIWxExtensionInfo> {
  const info: SIWxExtensionInfo = {};

  if (config.domain !== undefined) {
    info.domain = config.domain;
  }

  if (config.resourceUri !== undefined) {
    info.resourceUri = config.resourceUri;
  }

  if (config.network !== undefined) {
    info.network = config.network;
  }

  if (config.statement !== undefined) {
    info.statement = config.statement;
  }

  if (config.version !== undefined) {
    info.version = config.version;
  }

  if (config.expirationSeconds !== undefined) {
    info.expirationSeconds = config.expirationSeconds;
  }

  return createExtension(info);
}

export function parseSIWxHeader(header: string): SIWxPayload {
  const match = header.match(SIWX_HEADER_PATTERN);
  if (!match) {
    throw new Error("Invalid SIWX header format");
  }

  try {
    const decoded = base64UrlDecode(match[1]);
    return JSON.parse(decoded) as SIWxPayload;
  } catch {
    throw new Error("Failed to decode SIWX header");
  }
}

export function validateSIWxMessage(
  payload: SIWxPayload,
  resourceUri: string,
  options: { maxAge?: number; checkNonce?: (nonce: string) => boolean } = {},
): { valid: boolean; error?: string } {
  if (!payload.domain) {
    return { valid: false, error: "Missing domain" };
  }

  if (!payload.address || !isAddress(payload.address)) {
    return { valid: false, error: "Invalid or missing address" };
  }

  if (payload.resourceUri && payload.resourceUri !== resourceUri) {
    return { valid: false, error: "Resource URI mismatch" };
  }

  if (payload.expirationTime) {
    const expiration = new Date(payload.expirationTime).getTime();
    const now = Date.now();
    if (expiration < now) {
      return { valid: false, error: "Message has expired" };
    }
  }

  if (options.maxAge && payload.issuedAt) {
    const issued = new Date(payload.issuedAt).getTime();
    const now = Date.now();
    const age = now - issued;
    if (age > options.maxAge * 1000) {
      return { valid: false, error: "Message is too old" };
    }
  }

  if (options.checkNonce && payload.nonce) {
    if (!options.checkNonce(payload.nonce)) {
      return { valid: false, error: "Invalid nonce" };
    }
  }

  return { valid: true };
}

export async function verifySIWxSignature(
  payload: SIWxPayload,
  options: {
    evmVerifier?: (
      message: string,
      signature: string,
      address: string,
    ) => Promise<boolean>;
  } = {},
): Promise<{ valid: boolean; address?: string; error?: string }> {
  if (!payload.signature) {
    return { valid: false, error: "Missing signature" };
  }

  if (!payload.address || !isAddress(payload.address)) {
    return { valid: false, error: "Invalid address" };
  }

  if (options.evmVerifier) {
    const message = createSIWxMessage(payload);
    const valid = await options.evmVerifier(
      message,
      payload.signature,
      payload.address,
    );
    if (!valid) {
      return { valid: false, error: "Signature verification failed" };
    }
  }

  return { valid: true, address: payload.address };
}

export function createSIWxMessage(payload: SIWxPayload): string {
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
    const chains = Array.isArray(payload.chainId)
      ? payload.chainId.join(", ")
      : payload.chainId;
    lines.push(`Chain ID(s): ${chains}`);
  }

  lines.push("");
  lines.push(`Address: ${payload.address}`);

  return lines.join("\n");
}

export function encodeSIWxHeader(payload: SIWxPayload): string {
  const payloadStr = JSON.stringify(payload);
  const encoded = base64UrlEncode(payloadStr);
  return `siwx-v1-${encoded}`;
}

export function createSIWxPayload(
  serverInfo: SIWxExtensionInfo,
  address: string,
  options: {
    nonce?: string;
    issuedAt?: string;
    expirationTime?: string;
  } = {},
): SIWxPayload {
  const getDefaultDomain = (): string => {
    if (typeof window !== "undefined" && window.location) {
      return window.location.hostname;
    }
    return "localhost";
  };

  const payload: SIWxPayload = {
    domain: serverInfo.domain || getDefaultDomain(),
    address,
  };

  if (serverInfo.resourceUri) {
    payload.resourceUri = serverInfo.resourceUri;
  }

  if (serverInfo.statement) {
    payload.statement = serverInfo.statement;
  }

  if (serverInfo.version) {
    payload.version = serverInfo.version;
  }

  if (serverInfo.network) {
    payload.chainId = serverInfo.network;
  }

  if (options.nonce) {
    payload.nonce = options.nonce;
  }

  if (options.issuedAt) {
    payload.issuedAt = options.issuedAt;
  }

  if (options.expirationTime) {
    payload.expirationTime = options.expirationTime;
  } else if (serverInfo.expirationSeconds) {
    const expiration = new Date(
      Date.now() + serverInfo.expirationSeconds * 1000,
    );
    payload.expirationTime = expiration.toISOString();
  }

  return payload;
}

export function isSIWxExtension(
  extension: unknown,
): extension is Extension<SIWxExtensionInfo> {
  if (!extension || typeof extension !== "object") {
    return false;
  }

  const ext = extension as Record<string, unknown>;
  return "info" in ext;
}

export { SIGN_IN_WITH_X, SIWX_INFO_TYPE };

export type { SIWxExtensionInfo, SIWxExtensionConfig, SIWxPayload };
