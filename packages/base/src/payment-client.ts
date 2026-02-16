import type {
  PaymentPayload,
  PaymentRequirements,
  VerifyResponse,
  SettlementResponse,
} from "./types/x402";
import { isPaymentPayload, isExactEvmPayload } from "./types/x402";

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

function isCompactV2Payload(payload: unknown): payload is { x402Version: number; payload: unknown } {
  if (typeof payload !== "object" || payload === null) return false;
  const record = payload as Record<string, unknown>;
  return typeof record.x402Version === "number" && "payload" in record && !("accepted" in record);
}

export function decodePayloadHeader(
  headerValue: string,
  defaults?: DecodePayloadDefaults,
): PaymentPayload {
  if (headerValue.startsWith("{")) {
    const parsed = JSON.parse(headerValue);
    if (isPaymentPayload(parsed)) return parsed;
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

  const normalized = headerValue
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(headerValue.length / 4) * 4, "=");

  try {
    const decoded = JSON.parse(Buffer.from(normalized, "base64").toString("utf-8"));
    if (isPaymentPayload(decoded)) return decoded;
    if (isCompactV2Payload(decoded)) {
      const compact = decoded as { payload: PaymentPayload["payload"] };
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
  } catch {
    throw new Error("Invalid payment payload: failed to decode");
  }
}

export function extractPayerAddress(payload: PaymentPayload): string {
  if (isExactEvmPayload(payload.payload)) {
    return payload.payload.authorization.from;
  }

  throw new Error("Unable to extract payer address from payload");
}
