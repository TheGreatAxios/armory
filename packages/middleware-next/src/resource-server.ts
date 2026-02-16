import type { PaymentRequirementsV2 } from "@armory-sh/base";
import type { HTTPFacilitatorClient, PaymentScheme } from "./types";

export class x402ResourceServer {
  private facilitator: HTTPFacilitatorClient;
  private schemes: Map<string, PaymentScheme>;

  constructor(facilitatorClient: HTTPFacilitatorClient) {
    this.facilitator = facilitatorClient;
    this.schemes = new Map();
  }

  register(chainId: string, scheme: PaymentScheme): this {
    this.schemes.set(chainId, scheme);
    return this;
  }

  getRequirements(chainId: string): PaymentRequirementsV2 {
    const scheme = this.schemes.get(chainId);
    if (!scheme) {
      throw new Error(`No scheme registered for chain: ${chainId}`);
    }
    return scheme.getRequirements();
  }

  getAllRequirements(): PaymentRequirementsV2[] {
    return Array.from(this.schemes.values()).map((s) => s.getRequirements());
  }

  getFacilitator(): HTTPFacilitatorClient {
    return this.facilitator;
  }
}
