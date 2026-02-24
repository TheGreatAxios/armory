import { generateCdpJwt } from "./jwt.js";

export const CDP_FACILITATOR_URL =
  "https://api.cdp.coinbase.com/platform/x402/v2";

export const CDP_FACILITATOR_HOST = "api.cdp.coinbase.com";

export interface CdpCredentials {
  apiKeyId: string;
  apiKeySecret: string;
  expiresIn?: number;
}

export interface GenerateCdpHeadersOptions extends CdpCredentials {
  requestMethod: string;
  requestPath: string;
}

export async function generateCdpHeaders(
  options: GenerateCdpHeadersOptions,
): Promise<Record<string, string>> {
  const token = await generateCdpJwt({
    apiKeyId: options.apiKeyId,
    apiKeySecret: options.apiKeySecret,
    requestMethod: options.requestMethod,
    requestHost: CDP_FACILITATOR_HOST,
    requestPath: options.requestPath,
    expiresIn: options.expiresIn,
  });
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}
