/**
 * Hook Execution Engine
 *
 * Executes hooks in priority order and handles errors gracefully.
 * Hooks are sorted by priority (higher priority runs first).
 */

import type {
  HookRegistry,
  PaymentRequiredContext,
  PaymentPayloadContext,
} from "./hooks";
import type { Extensions } from "@armory-sh/base";

export async function executeHooks(
  hooks: HookRegistry,
  context: PaymentRequiredContext | PaymentPayloadContext
): Promise<void> {
  const sortedHooks = Object.entries(hooks).sort(([, a], [, b]) => {
    const priorityA = a.priority ?? 0;
    const priorityB = b.priority ?? 0;
    return priorityB - priorityA;
  });

  for (const [key, config] of sortedHooks) {
    try {
      await config.hook(context as any);
    } catch (error) {
      console.warn(`[X402] Hook "${key}" failed:`, error);
    }
  }
}

export function mergeExtensions(
  baseExtensions: Extensions | undefined,
  hookExtensions: Record<string, unknown>
): Extensions {
  return {
    ...(baseExtensions ?? {}),
    ...hookExtensions,
  };
}
