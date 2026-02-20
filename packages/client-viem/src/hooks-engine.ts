/**
 * Hook Execution Engine
 *
 * Executes hooks in priority order and handles errors gracefully.
 * Hooks are sorted by priority (higher priority runs first).
 */

import type { Extensions } from "@armory-sh/base";
import type {
  HookRegistry,
  PaymentRequiredContext,
  ViemPaymentPayloadContext,
} from "./hooks";

export async function executeHooks(
  hooks: HookRegistry,
  context: PaymentRequiredContext | ViemPaymentPayloadContext,
): Promise<void> {
  const sortedHooks = Object.entries(hooks).sort(([, a], [, b]) => {
    const priorityA = a.priority ?? 0;
    const priorityB = b.priority ?? 0;
    return priorityB - priorityA;
  });

  for (const [key, config] of sortedHooks) {
    try {
      const hook = config.hook as (
        value: PaymentRequiredContext | ViemPaymentPayloadContext,
      ) => void | Promise<void>;
      await hook(context);
    } catch (error) {
      console.warn(`[X402] Hook "${key}" failed:`, error);
    }
  }
}

export function mergeExtensions(
  baseExtensions: Extensions | undefined,
  hookExtensions: Record<string, unknown>,
): Extensions {
  return {
    ...(baseExtensions ?? {}),
    ...hookExtensions,
  };
}
