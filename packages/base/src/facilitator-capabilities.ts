import { getSupported } from "./payment-client";
import type { PaymentRequirementsV2 } from "./types/v2";
import type { FacilitatorRoutingConfig } from "./payment-requirements";
import { resolveFacilitatorUrlFromRequirement } from "./payment-requirements";

const DEFAULT_CAPABILITY_TTL_MS = 5 * 60 * 1000;

type CapabilityCacheEntry = {
  expiresAt: number;
  keys: Set<string>;
};

const capabilityCache = new Map<string, CapabilityCacheEntry>();

const normalizeNetwork = (network: string): string => {
  return network.toLowerCase();
};

async function getExtensionKeysForFacilitator(
  url: string,
  network: string,
  ttlMs: number,
): Promise<Set<string>> {
  const cacheKey = `${url}|${normalizeNetwork(network)}`;
  const now = Date.now();
  const cached = capabilityCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.keys;
  }

  try {
    const supported = await getSupported({ url });
    const extensionKeys = new Set<string>();
    for (const kind of supported.kinds) {
      if (normalizeNetwork(kind.network) !== normalizeNetwork(network)) {
        continue;
      }
      if (kind.extra && typeof kind.extra === "object") {
        for (const key of Object.keys(kind.extra)) {
          extensionKeys.add(key);
        }
      }
    }
    capabilityCache.set(cacheKey, {
      expiresAt: now + ttlMs,
      keys: extensionKeys,
    });
    return extensionKeys;
  } catch {
    capabilityCache.set(cacheKey, {
      expiresAt: now + ttlMs,
      keys: new Set<string>(),
    });
    return new Set<string>();
  }
}

export async function filterExtensionsForFacilitator(
  extensions: Record<string, unknown> | undefined,
  facilitatorUrl: string | undefined,
  network: string,
  ttlMs: number = DEFAULT_CAPABILITY_TTL_MS,
): Promise<Record<string, unknown>> {
  if (!extensions || !facilitatorUrl) {
    return extensions ?? {};
  }

  const supportedKeys = await getExtensionKeysForFacilitator(
    facilitatorUrl,
    network,
    ttlMs,
  );

  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(extensions)) {
    if (supportedKeys.has(key)) {
      filtered[key] = value;
    }
  }

  return filtered;
}

export async function filterExtensionsForFacilitators(
  extensions: Record<string, unknown> | undefined,
  facilitators: Array<{ url?: string; network: string }>,
  ttlMs: number = DEFAULT_CAPABILITY_TTL_MS,
): Promise<Record<string, unknown>> {
  if (!extensions) {
    return {};
  }

  let filtered = { ...extensions };
  for (const facilitator of facilitators) {
    filtered = await filterExtensionsForFacilitator(
      filtered,
      facilitator.url,
      facilitator.network,
      ttlMs,
    );
    if (Object.keys(filtered).length === 0) {
      return {};
    }
  }

  return filtered;
}

export async function filterExtensionsForRequirements(
  extensions: Record<string, unknown> | undefined,
  requirements: PaymentRequirementsV2[],
  config: FacilitatorRoutingConfig,
  ttlMs: number = DEFAULT_CAPABILITY_TTL_MS,
): Promise<Record<string, unknown>> {
  const facilitators = requirements.map((requirement) => ({
    url: resolveFacilitatorUrlFromRequirement(config, requirement),
    network: requirement.network,
  }));

  return filterExtensionsForFacilitators(extensions, facilitators, ttlMs);
}

export function clearFacilitatorCapabilityCache(): void {
  capabilityCache.clear();
}
