import type { PaymentRequirements } from "@armory-sh/base";
import { createPaymentRequirements as createBaseRequirements } from "@armory-sh/base";
import type { MiddlewareConfig } from "./types";

export const createPaymentRequirements = (
  config: MiddlewareConfig,
): PaymentRequirements => {
  const resolved = createBaseRequirements({
    payTo: config.payTo,
    chain: config.network,
    token: "usdc",
    amount: config.amount,
  });
  const requirement = resolved.requirements[0];
  if (!requirement) {
    throw new Error(
      resolved.error?.message ?? "Failed to create payment requirements",
    );
  }
  return requirement;
};
