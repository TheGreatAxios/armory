import type { Address } from "@armory-sh/base";

export interface PaymentRequirements {
  network: string | number;
  amount: string;
  payTo: Address;
  expiresAt?: number;
  version?: 1 | 2;
}

export interface PaymentPayload {
  network: string | number;
  amount: string;
  payTo: Address;
  payerAddress?: Address;
  expiresAt: number;
  version?: 1 | 2;
  signature?: string;
}

export const getRequirementsVersion = (requirements: PaymentRequirements): 1 | 2 => {
  return requirements.version ?? 2;
};

export const getHeadersForVersion = (version: 1 | 2) => {
  return version === 1
    ? { payment: "X-PAYMENT", required: "X-PAYMENT-REQUIRED", response: "X-PAYMENT-VERIFIED" }
    : { payment: "PAYMENT-SIGNATURE", required: "PAYMENT-REQUIRED", response: "PAYMENT-VERIFIED" };
};

export const encodeRequirements = (requirements: PaymentRequirements): string => {
  return JSON.stringify(requirements);
};

export const decodePayload = (header: string): { payload: any; version: 1 | 2 } => {
  try {
    const buffer = Buffer.from(header, 'base64');
    const parsed = JSON.parse(buffer.toString('utf-8'));
    return { payload: parsed, version: parsed.x402Version ?? 2 };
  } catch {
    throw new Error("Invalid payment payload");
  }
};

export const extractPayerAddress = (payload: any): string => {
  // Handle x402 V2 format (nested structure)
  if (payload?.x402Version && payload?.payload?.authorization?.from) {
    return payload.payload.authorization.from;
  }
  // Handle direct payerAddress field
  if (payload?.payerAddress) {
    return payload.payerAddress;
  }
  // Handle from field
  if (payload?.from) {
    return payload.from;
  }
  throw new Error("Unable to extract payer address");
};

export const createResponseHeaders = (payerAddress: string, version: 1 | 2): Record<string, string> => {
  return version === 1
    ? { "PAYMENT-SIGNATURE": payerAddress }
    : { "PAYMENT-VERIFIED": `{"status":"verified","version":${version}}` };
};

export interface VerifyResult {
  success: boolean;
  payerAddress?: string;
  error?: string;
}

export const verifyPaymentWithRetry = async (
  payload: PaymentPayload,
  requirements: PaymentRequirements,
  facilitatorUrl?: string
): Promise<VerifyResult> => {
  if (!facilitatorUrl) {
    return { success: true, payerAddress: payload.payerAddress };
  }

  try {
    const response = await fetch(`${facilitatorUrl}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload, requirements }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: JSON.stringify(error) };
    }

    const result = await response.json() as { success: boolean; error?: string; payerAddress?: string };
    if (!result.success) {
      return { success: false, error: result.error ?? "Verification failed" };
    }

    return { success: true, payerAddress: result.payerAddress ?? payload.payerAddress };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown facilitator error",
    };
  }
};
