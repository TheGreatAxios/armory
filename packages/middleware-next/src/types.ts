import type { PaymentRequirementsV2 } from "@armory-sh/base";

export interface HTTPFacilitatorClient {
  verify(headers: Headers): Promise<{ success: boolean; payerAddress?: string; error?: string }>;
  settle?(headers: Headers): Promise<{ success: boolean; txHash?: string; error?: string }>;
}

export interface PaymentScheme {
  name: string;
  getRequirements(): PaymentRequirementsV2;
}

export interface RoutePaymentConfig {
  accepts: {
    scheme: string;
    price: string;
    network: string;
    payTo: string;
  };
  description?: string;
}

export interface MiddlewareConfig {
  matcher: string[];
}
