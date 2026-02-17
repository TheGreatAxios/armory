import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import {
  clearFacilitatorCapabilityCache,
  createPaymentRequirements,
  enrichPaymentRequirements,
  filterExtensionsForRequirements,
  findRequirementByAccepted,
  type PaymentRequirementsV2,
  resolveFacilitatorUrlFromRequirement,
} from "../src/index";

const BASE_REQUIREMENT: PaymentRequirementsV2 = {
  scheme: "exact",
  network: "eip155:84532",
  amount: "1000000",
  asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  payTo: "0x1234567890123456789012345678901234567890",
  maxTimeoutSeconds: 300,
};

const SKALE_REQUIREMENT: PaymentRequirementsV2 = {
  scheme: "exact",
  network: "eip155:324705682",
  amount: "1000000",
  asset: "0x2e08028E3C4c2356572E096d8EF835cD5C6030bD",
  payTo: "0x1234567890123456789012345678901234567890",
  maxTimeoutSeconds: 300,
};

describe(
  "[unit|base] - [createPaymentRequirements|success] - includes top-level name/version metadata",
  () => {
    test("adds token metadata required by x402 signers", () => {
      const result = createPaymentRequirements({
        payTo: "0x1234567890123456789012345678901234567890",
        chains: ["base-sepolia"],
        tokens: ["usdc"],
        amount: "0.001",
      });

      expect(result.error).toBeUndefined();
      expect(result.requirements.length).toBe(1);
      expect(typeof result.requirements[0]?.name).toBe("string");
      expect(result.requirements[0]?.version).toBe("2");
    });
  },
);

describe(
  "[unit|base] - [enrichPaymentRequirements|success] - hydrates name/version from network+asset",
  () => {
    test("fills missing token metadata for explicit requirements", () => {
      const enriched = enrichPaymentRequirements([
        {
          scheme: "exact",
          network: "eip155:324705682",
          amount: "1000000",
          asset: "0x2e08028E3C4c2356572E096d8EF835cD5C6030bD",
          payTo: "0x1234567890123456789012345678901234567890",
          maxTimeoutSeconds: 300,
        },
      ]);

      expect(enriched[0]?.name).toBe("Bridged USDC (SKALE Bridge)");
      expect(enriched[0]?.version).toBe("2");
    });
  },
);

describe(
  "[unit|base] - [findRequirementByAccepted|success] - matches non-primary requirement by accepted payload",
  () => {
    test("returns matching requirement when accepted points to second entry", () => {
      const requirements = [BASE_REQUIREMENT, SKALE_REQUIREMENT];
      const matched = findRequirementByAccepted(requirements, SKALE_REQUIREMENT);

      expect(matched).toEqual(SKALE_REQUIREMENT);
    });
  },
);

describe(
  "[unit|base] - [resolveFacilitator|success] - picks facilitator by network+token over chain/global",
  () => {
    test("returns token-specific facilitator for matching network and token", () => {
      const url = resolveFacilitatorUrlFromRequirement(
        {
          facilitatorUrl: "https://global.facilitator",
          facilitatorUrlByChain: {
            "base-sepolia": "https://chain.facilitator",
          },
          facilitatorUrlByToken: {
            "base-sepolia": {
              usdc: "https://token.facilitator",
            },
          },
        },
        BASE_REQUIREMENT,
      );

      expect(url).toBe("https://token.facilitator");
    });
  },
);

describe(
  "[unit|base] - [resolveFacilitator|success] - falls back chain then global",
  () => {
    test("returns chain facilitator when token mapping does not match", () => {
      const url = resolveFacilitatorUrlFromRequirement(
        {
          facilitatorUrl: "https://global.facilitator",
          facilitatorUrlByChain: {
            "skale-base-sepolia": "https://chain.facilitator",
          },
          facilitatorUrlByToken: {
            "base-sepolia": {
              usdc: "https://token.facilitator",
            },
          },
        },
        SKALE_REQUIREMENT,
      );

      expect(url).toBe("https://chain.facilitator");
    });
  },
);

describe(
  "[unit|base] - [resolveExtensions|success] - strips unsupported extensions from facilitator capabilities",
  () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
      clearFacilitatorCapabilityCache();
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
      clearFacilitatorCapabilityCache();
    });

    test("keeps only extension keys returned by supported response", async () => {
      globalThis.fetch = mock(async () => {
        return new Response(
          JSON.stringify({
            kinds: [
              {
                x402Version: 2,
                scheme: "exact",
                network: BASE_REQUIREMENT.network,
                extra: { bazaar: {} },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }) as typeof fetch;

      const filtered = await filterExtensionsForRequirements(
        {
          bazaar: { enabled: true },
          "sign-in-with-x": { enabled: true },
        },
        [BASE_REQUIREMENT],
        { facilitatorUrl: "https://payai.facilitator" },
      );

      expect(filtered).toEqual({ bazaar: { enabled: true } });
    });

    test("uses cached capability response for subsequent calls", async () => {
      const fetchMock = mock(async () => {
        return new Response(
          JSON.stringify({
            kinds: [
              {
                x402Version: 2,
                scheme: "exact",
                network: BASE_REQUIREMENT.network,
                extra: { bazaar: {} },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      });
      globalThis.fetch = fetchMock as typeof fetch;

      await filterExtensionsForRequirements(
        { bazaar: { enabled: true } },
        [BASE_REQUIREMENT],
        { facilitatorUrl: "https://payai.facilitator" },
      );
      await filterExtensionsForRequirements(
        { bazaar: { enabled: true } },
        [BASE_REQUIREMENT],
        { facilitatorUrl: "https://payai.facilitator" },
      );

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test("returns empty extension set when supported lookup fails", async () => {
      globalThis.fetch = mock(async () => {
        throw new Error("network failed");
      }) as typeof fetch;

      const filtered = await filterExtensionsForRequirements(
        { bazaar: { enabled: true } },
        [BASE_REQUIREMENT],
        { facilitatorUrl: "https://payai.facilitator" },
      );

      expect(filtered).toEqual({});
    });
  },
);

describe(
  "[unit|base] - [findRequirementByAccepted|success] - matches addresses case-insensitively",
  () => {
    test("returns matching requirement with mixed-case accepted addresses", () => {
      const requirements = [SKALE_REQUIREMENT];
      const matched = findRequirementByAccepted(requirements, {
        ...SKALE_REQUIREMENT,
        asset: SKALE_REQUIREMENT.asset.toLowerCase(),
        payTo: SKALE_REQUIREMENT.payTo.toUpperCase(),
      });

      expect(matched).toEqual(SKALE_REQUIREMENT);
    });
  },
);

describe(
  "[unit|base] - [findRequirementByAccepted|error] - rejects unconfigured accepted requirement",
  () => {
    test("returns undefined for unmatched accepted requirement", () => {
      const matched = findRequirementByAccepted([BASE_REQUIREMENT], {
        ...SKALE_REQUIREMENT,
      });

      expect(matched).toBeUndefined();
    });
  },
);

describe(
  "[unit|base] - [findRequirementByAccepted|success] - falls back to network-based matching when accepted fields differ",
  () => {
    test("matches configured requirement by scheme+network when accepted asset differs", () => {
      const matched = findRequirementByAccepted([BASE_REQUIREMENT], {
        ...BASE_REQUIREMENT,
        asset: "0x0000000000000000000000000000000000000001",
      });

      expect(matched).toEqual(BASE_REQUIREMENT);
    });
  },
);
