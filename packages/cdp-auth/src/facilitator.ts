import type {
  FacilitatorClientConfig,
  PaymentPayload,
  PaymentRequirements,
  SettlementResponse,
  VerifyResponse,
} from "@armory-sh/base";
import { settlePayment, verifyPayment } from "@armory-sh/base";
import { generateCdpJwt } from "./jwt.js";

export const CDP_FACILITATOR_URL =
  "https://api.cdp.coinbase.com/platform/x402/v2";

export const CDP_FACILITATOR_HOST = "api.cdp.coinbase.com";

export interface CdpCredentials {
  apiKeyId: string;
  apiKeySecret: string;
  expiresIn?: number;
}

async function buildCdpHeaders(
  credentials: CdpCredentials,
  method: string,
  path: string,
): Promise<Record<string, string>> {
  const token = await generateCdpJwt({
    apiKeyId: credentials.apiKeyId,
    apiKeySecret: credentials.apiKeySecret,
    requestMethod: method,
    requestHost: CDP_FACILITATOR_HOST,
    requestPath: path,
    expiresIn: credentials.expiresIn,
  });
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export async function createCdpFacilitatorConfig(
  credentials: CdpCredentials,
  path = "/verify",
): Promise<FacilitatorClientConfig> {
  const headers = await buildCdpHeaders(credentials, "POST", path);
  return {
    url: CDP_FACILITATOR_URL,
    headers,
  };
}

export async function cdpVerify(
  payload: PaymentPayload,
  requirements: PaymentRequirements,
  credentials: CdpCredentials,
): Promise<VerifyResponse> {
  const headers = await buildCdpHeaders(credentials, "POST", "/verify");
  const config: FacilitatorClientConfig = {
    url: CDP_FACILITATOR_URL,
    headers,
  };
  return verifyPayment(payload, requirements, config);
}

export async function cdpSettle(
  payload: PaymentPayload,
  requirements: PaymentRequirements,
  credentials: CdpCredentials,
): Promise<SettlementResponse> {
  const headers = await buildCdpHeaders(credentials, "POST", "/settle");
  const config: FacilitatorClientConfig = {
    url: CDP_FACILITATOR_URL,
    headers,
  };
  return settlePayment(payload, requirements, config);
}
