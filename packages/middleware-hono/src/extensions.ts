/**
 * Extension handling for Hono middleware
 * Integrates with @armory-sh/extensions package
 */

import type { Extensions } from "@armory-sh/base";

type BazaarDiscoveryConfig = {
  input?: unknown;
  inputSchema?: Record<string, unknown>;
  bodyType?: "json" | "form-data" | "text";
  output?: {
    example?: unknown;
    schema?: Record<string, unknown>;
  };
};

type SIWxExtensionConfig = {
  domain?: string;
  resourceUri?: string;
  network?: string | string[];
  statement?: string;
  version?: string;
  expirationSeconds?: number;
};

type Extension<T = unknown> = {
  info: T;
  schema: Record<string, unknown>;
};

type BazaarExtensionInfo = {
  input?: unknown;
  inputSchema?: Record<string, unknown>;
  output?: {
    example?: unknown;
    schema?: Record<string, unknown>;
  };
};

type SIWxExtensionInfo = {
  domain?: string;
  resourceUri?: string;
  network?: string | string[];
  statement?: string;
  version?: string;
  expirationSeconds?: number;
  supportedChains?: Array<{
    chainId: string;
    type: string;
  }>;
};

const declareDiscoveryExtension = (
  config: BazaarDiscoveryConfig = {},
): Extension<BazaarExtensionInfo> => {
  const info: BazaarExtensionInfo = {};

  if (config.input !== undefined) {
    info.input = config.input;
  }

  if (config.inputSchema !== undefined) {
    info.inputSchema = config.inputSchema as Record<string, unknown>;
  }

  if (config.output !== undefined) {
    info.output = config.output;
  }

  return { info, schema: { type: "object" } };
};

const declareSIWxExtension = (
  config: SIWxExtensionConfig = {},
): Extension<SIWxExtensionInfo> => {
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

  return { info, schema: { type: "object" } };
};

export interface ExtensionConfig {
  bazaar?: BazaarDiscoveryConfig;
  signInWithX?: SIWxExtensionConfig;
}

export interface PaymentConfigWithExtensions {
  extensions?: ExtensionConfig;
}

export function buildExtensions(config: ExtensionConfig): Extensions {
  const extensions: Extensions = {};

  if (config.bazaar) {
    extensions.bazaar = declareDiscoveryExtension(config.bazaar);
  }

  if (config.signInWithX) {
    extensions["sign-in-with-x"] = declareSIWxExtension(config.signInWithX);
  }

  return extensions;
}

export function extractExtension<T>(
  extensions: Extensions | undefined,
  key: string,
): Extension<T> | null {
  if (!extensions || typeof extensions !== "object") {
    return null;
  }

  const extension = extensions[key];
  if (!extension || typeof extension !== "object") {
    return null;
  }

  return extension as Extension<T>;
}
