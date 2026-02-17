import type {
  ClientHook,
  ClientHookErrorContext,
  PaymentPayloadContext,
  PaymentRequiredContext,
} from "./types/hooks";
import type { PaymentRequirementsV2 } from "./types/v2";

const notifyError = async <TWallet>(
  hooks: ClientHook<TWallet>[] | undefined,
  context: ClientHookErrorContext,
): Promise<void> => {
  if (!hooks?.length) {
    return;
  }

  for (const hook of hooks) {
    if (!hook.onError) {
      continue;
    }
    await hook.onError(context);
  }
};

export const runOnPaymentRequiredHooks = async <TWallet>(
  hooks: ClientHook<TWallet>[] | undefined,
  context: PaymentRequiredContext,
): Promise<void> => {
  if (!hooks?.length) {
    return;
  }

  for (const hook of hooks) {
    if (!hook.onPaymentRequired) {
      continue;
    }
    try {
      await hook.onPaymentRequired(context);
    } catch (error) {
      await notifyError(hooks, { error, phase: "onPaymentRequired" });
      throw error;
    }
  }
};

export const selectRequirementWithHooks = async <TWallet>(
  hooks: ClientHook<TWallet>[] | undefined,
  context: PaymentRequiredContext,
): Promise<PaymentRequirementsV2> => {
  if (!context.accepts.length) {
    throw new Error("No payment requirements found in accepts array");
  }

  let selected = context.accepts[0];

  if (!hooks?.length) {
    context.selectedRequirement = selected;
    context.requirements = selected;
    return selected;
  }

  for (const hook of hooks) {
    if (!hook.selectRequirement) {
      continue;
    }
    try {
      const override = await hook.selectRequirement({
        ...context,
        selectedRequirement: selected,
        requirements: selected,
      });
      if (!override) {
        continue;
      }
      const isValid = context.accepts.some((accept) => accept === override);
      if (!isValid) {
        throw new Error(
          "Hook selectRequirement must return an item from accepts",
        );
      }
      selected = override;
    } catch (error) {
      await notifyError(hooks, { error, phase: "selectRequirement" });
      throw error;
    }
  }

  context.selectedRequirement = selected;
  context.requirements = selected;
  return selected;
};

export const runBeforeSignPaymentHooks = async <TWallet>(
  hooks: ClientHook<TWallet>[] | undefined,
  context: PaymentPayloadContext<TWallet>,
): Promise<void> => {
  if (!hooks?.length) {
    return;
  }

  for (const hook of hooks) {
    if (!hook.beforeSignPayment) {
      continue;
    }
    try {
      await hook.beforeSignPayment(context);
    } catch (error) {
      await notifyError(hooks, { error, phase: "beforeSignPayment" });
      throw error;
    }
  }
};

export const runAfterPaymentResponseHooks = async <TWallet>(
  hooks: ClientHook<TWallet>[] | undefined,
  context: PaymentPayloadContext<TWallet> & { response: Response },
): Promise<void> => {
  if (!hooks?.length) {
    return;
  }

  for (const hook of hooks) {
    if (!hook.afterPaymentResponse) {
      continue;
    }
    try {
      await hook.afterPaymentResponse(context);
    } catch (error) {
      await notifyError(hooks, { error, phase: "afterPaymentResponse" });
      throw error;
    }
  }
};
