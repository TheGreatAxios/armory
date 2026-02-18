import type {
  PaymentRequirementsV2,
  SettlementResponseV2,
  VerifyResponse,
  X402PaymentPayload,
} from "@armory-sh/base";
import {
  enrichPaymentRequirements,
  extractPayerAddress,
  findRequirementByAccepted,
  resolveFacilitatorUrlFromRequirement,
  settlePayment,
  verifyPayment,
} from "@armory-sh/base";
import {
  attachPaymentResponseToMeta,
  createPaymentRequiredResult,
  extractPaymentFromMeta,
} from "./meta";
import type {
  McpMeta,
  McpPaymentContext,
  McpPaymentHooks,
  McpPaymentRequiredData,
  McpPaymentWrapperConfig,
  McpToolHandler,
  McpToolResult,
} from "./types";

function buildPaymentRequiredData(
  requirements: PaymentRequirementsV2[],
  config: McpPaymentWrapperConfig,
  toolName: string,
): McpPaymentRequiredData {
  return {
    x402Version: 2,
    error: "Payment required",
    resource: config.resource ?? {
      url: `mcp://tool/${toolName}`,
      description: toolName,
      mimeType: "application/json",
    },
    accepts: requirements,
  };
}

function resolveFacilitatorUrl(
  config: McpPaymentWrapperConfig,
  requirement: PaymentRequirementsV2,
): string | undefined {
  return resolveFacilitatorUrlFromRequirement(
    {
      facilitatorUrl: config.facilitatorUrl,
      facilitatorUrlByChain: config.facilitatorUrlByChain,
      facilitatorUrlByToken: config.facilitatorUrlByToken,
    },
    requirement,
  );
}

export function createMcpPaymentWrapper<TArgs = Record<string, unknown>>(
  toolName: string,
  config: McpPaymentWrapperConfig,
  handler: McpToolHandler<TArgs>,
  hooks?: McpPaymentHooks,
) {
  const requirements = enrichPaymentRequirements(
    Array.isArray(config.accepts) ? config.accepts : [config.accepts],
  );

  return async (
    args: TArgs,
    meta: McpMeta | undefined,
  ): Promise<McpToolResult> => {
    const payment = extractPaymentFromMeta(meta);

    if (!payment) {
      const paymentRequiredData = buildPaymentRequiredData(
        requirements,
        config,
        toolName,
      );
      return createPaymentRequiredResult(paymentRequiredData);
    }

    const selectedRequirement = findRequirementByAccepted(
      requirements,
      payment.accepted,
    );
    if (!selectedRequirement) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: "Invalid payment",
              message: "Accepted requirement is not configured for this tool",
            }),
          },
        ],
        isError: true,
      };
    }

    const facilitatorUrl = resolveFacilitatorUrl(config, selectedRequirement);
    if (!facilitatorUrl) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: "Configuration error",
              message: "Facilitator URL is required for verification",
            }),
          },
        ],
        isError: true,
      };
    }

    const facilitatorConfig = { url: facilitatorUrl };

    let verifyResult: VerifyResponse;
    try {
      verifyResult = await verifyPayment(
        payment,
        selectedRequirement,
        facilitatorConfig,
      );
    } catch {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: "Verification error",
              message: "Failed to verify payment with facilitator",
            }),
          },
        ],
        isError: true,
      };
    }

    if (!verifyResult.isValid) {
      const paymentRequiredData = buildPaymentRequiredData(
        requirements,
        config,
        toolName,
      );
      return createPaymentRequiredResult(paymentRequiredData);
    }

    let payerAddress: string;
    try {
      payerAddress = verifyResult.payer ?? extractPayerAddress(payment);
    } catch {
      payerAddress = "";
    }

    const paymentContext: McpPaymentContext = {
      payload: payment,
      payerAddress,
      verified: true,
      requirement: selectedRequirement,
      facilitatorConfig,
    };

    if (hooks?.onVerify) {
      await hooks.onVerify(paymentContext);
    }

    const toolResult = await handler(args, { payment: paymentContext });

    if (toolResult.isError) {
      return toolResult;
    }

    let settleResult: SettlementResponseV2;
    try {
      settleResult = (await settlePayment(
        payment,
        selectedRequirement,
        facilitatorConfig,
      )) as SettlementResponseV2;
    } catch {
      const paymentRequiredData = buildPaymentRequiredData(
        requirements,
        config,
        toolName,
      );
      paymentRequiredData.error = "Payment settlement failed";
      return createPaymentRequiredResult(paymentRequiredData);
    }

    if (!settleResult.success) {
      const paymentRequiredData = buildPaymentRequiredData(
        requirements,
        config,
        toolName,
      );
      paymentRequiredData.error = `Payment settlement failed: ${settleResult.errorReason ?? "unknown error"}`;
      return createPaymentRequiredResult(paymentRequiredData);
    }

    if (hooks?.onSettle) {
      await hooks.onSettle(paymentContext, settleResult);
    }

    return {
      ...toolResult,
      _meta: attachPaymentResponseToMeta(toolResult._meta, settleResult),
    };
  };
}
