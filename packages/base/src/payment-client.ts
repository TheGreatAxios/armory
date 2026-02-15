import type {
  PaymentPayload,
  PaymentRequirements,
  VerifyResponse,
  SettlementResponse,
} from "./types/x402";
import { isPaymentPayload, isExactEvmPayload, isLegacyPaymentPayload } from "./types/x402";
import { decodePayment } from "./encoding/x402";

export interface FacilitatorClientConfig {
  url: string;
  createHeaders?: () => Record<string, string> | Promise<Record<string, string>>;
}

const DEFAULT_FACILITATOR_URL = "https://facilitator.payai.network";

function toJsonSafe(data: object): object {
  function convert(value: unknown): unknown {
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, convert(val)]));
    }
    if (Array.isArray(value)) {
      return value.map(convert);
    }
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  }
  return convert(data) as object;
}

function resolveUrl(config?: FacilitatorClientConfig): string {
  return config?.url ?? DEFAULT_FACILITATOR_URL;
}

async function resolveHeaders(config?: FacilitatorClientConfig): Promise<Record<string, string>> {
  const base: Record<string, string> = { "Content-Type": "application/json" };
  if (!config?.createHeaders) return base;
  const extra = await config.createHeaders();
  return { ...base, ...extra };
}

export async function verifyPayment(
  payload: PaymentPayload,
  requirements: PaymentRequirements,
  config?: FacilitatorClientConfig,
): Promise<VerifyResponse> {
  const url = resolveUrl(config);
  const headers = await resolveHeaders(config);

  const response = await fetch(`${url}/verify`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      paymentPayload: toJsonSafe(payload),
      paymentRequirements: toJsonSafe(requirements),
    }),
  });

  if (response.status !== 200) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`Facilitator verify failed: ${response.status} ${text}`);
  }

  return (await response.json()) as VerifyResponse;
}

export async function settlePayment(
  payload: PaymentPayload,
  requirements: PaymentRequirements,
  config?: FacilitatorClientConfig,
): Promise<SettlementResponse> {
  const url = resolveUrl(config);
  const headers = await resolveHeaders(config);

  const response = await fetch(`${url}/settle`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      paymentPayload: toJsonSafe(payload),
      paymentRequirements: toJsonSafe(requirements),
    }),
  });

  if (response.status !== 200) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`Facilitator settle failed: ${response.status} ${text}`);
  }

  return (await response.json()) as SettlementResponse;
}

export interface SupportedKind {
  x402Version: number;
  scheme: string;
  network: string;
  extra?: Record<string, unknown>;
}

export interface SupportedResponse {
  kinds: SupportedKind[];
}

interface DecodePayloadDefaults {
  accepted?: PaymentRequirements;
}

export async function getSupported(
  config?: FacilitatorClientConfig,
): Promise<SupportedResponse> {
  const url = resolveUrl(config);
  const headers = await resolveHeaders(config);

  const response = await fetch(`${url}/supported`, {
    method: "GET",
    headers,
  });

  if (response.status !== 200) {
    throw new Error(`Facilitator supported failed: ${response.statusText}`);
  }

  return (await response.json()) as SupportedResponse;
}

function tryParseHeaderJson(headerValue: string): unknown {
  if (headerValue.startsWith("{")) {
    return JSON.parse(headerValue);
  }
  const normalized = headerValue
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(headerValue.length / 4) * 4, "=");
  return JSON.parse(Buffer.from(normalized, "base64").toString("utf-8"));
}

function isCompactV2Payload(payload: unknown): payload is { x402Version: number; payload: unknown } {
  if (typeof payload !== "object" || payload === null) return false;
  const record = payload as Record<string, unknown>;
  return typeof record.x402Version === "number" && "payload" in record;
}

function convertLegacyToNew(
  legacy: { x402Version: number; scheme: string; network: string; payload: PaymentPayload["payload"] },
  defaults?: DecodePayloadDefaults,
): PaymentPayload {
  return {
    x402Version: legacy.x402Version as 2,
    accepted: defaults?.accepted ?? {
      scheme: legacy.scheme as "exact",
      network: legacy.network,
      amount: "0",
      asset: "0x0000000000000000000000000000000000000000" as `0x${string}`,
      payTo: "0x0000000000000000000000000000000000000000" as `0x${string}`,
      maxTimeoutSeconds: 300,
    },
    payload: legacy.payload,
  };
}

export function decodePayloadHeader(
  headerValue: string,
  defaults?: DecodePayloadDefaults,
): PaymentPayload {
  if (headerValue.startsWith("{")) {
    const parsed = JSON.parse(headerValue);
    if (isPaymentPayload(parsed)) return parsed;
    if (isLegacyPaymentPayload(parsed)) {
      return convertLegacyToNew(parsed, defaults);
    }
    if (isCompactV2Payload(parsed)) {
      const compact = parsed as { payload: PaymentPayload["payload"] };
      if (!defaults?.accepted) {
        throw new Error("Invalid payment payload: missing 'accepted' field and no defaults provided");
      }
      return {
        x402Version: 2,
        accepted: defaults.accepted,
        payload: compact.payload,
      };
    }
    throw new Error("Invalid payment payload: unrecognized format");
  }

  try {
    const decoded = decodePayment(headerValue);
    if (isPaymentPayload(decoded)) return decoded;
    if (isLegacyPaymentPayload(decoded)) {
      return convertLegacyToNew(decoded, defaults);
    }
    return decoded;
  } catch {
    const parsed = tryParseHeaderJson(headerValue);
    if (isPaymentPayload(parsed)) return parsed;
    if (isLegacyPaymentPayload(parsed)) {
      return convertLegacyToNew(parsed, defaults);
    }
    if (isCompactV2Payload(parsed)) {
      const compact = parsed as { payload: PaymentPayload["payload"] };
      if (!defaults?.accepted) {
        throw new Error("Invalid payment payload: missing 'accepted' field and no defaults provided");
      }
      return {
        x402Version: 2,
        accepted: defaults.accepted,
        payload: compact.payload,
      };
    }
    throw new Error("Invalid payment payload: unrecognized format");
  }
}

export function extractPayerAddress(payload: PaymentPayload): string {
  if (isExactEvmPayload(payload.payload)) {
    return payload.payload.authorization.from;
  }

  throw new Error("Unable to extract payer address from payload");
}
