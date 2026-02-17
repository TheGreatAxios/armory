import { describe, expect, test } from "bun:test";
import {
  findRequirementByAccepted,
  type PaymentRequirementsV2,
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
