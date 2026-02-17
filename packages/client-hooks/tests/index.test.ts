import { describe, expect, test } from "bun:test";
import type {
  PaymentRequiredContext,
  PaymentRequirementsV2,
} from "@armory-sh/base";
import { combineHooks, Logger, PaymentPreference } from "../src/index";

const makeRequirement = (
  network: PaymentRequirementsV2["network"],
  amount: string,
  asset: `0x${string}` = "0x0000000000000000000000000000000000000001",
): PaymentRequirementsV2 => ({
  scheme: "exact",
  network,
  amount,
  asset,
  payTo: "0x0000000000000000000000000000000000000002",
  maxTimeoutSeconds: 300,
});

const makeContext = (
  accepts: PaymentRequirementsV2[],
): PaymentRequiredContext => ({
  url: "http://localhost/test",
  requestInit: undefined,
  accepts,
  requirements: accepts[0] as PaymentRequirementsV2,
  selectedRequirement: accepts[0] as PaymentRequirementsV2,
  serverExtensions: undefined,
  fromAddress: "0x0000000000000000000000000000000000000003",
  nonce: "0x0000000000000000000000000000000000000000000000000000000000000001",
  validBefore: Math.floor(Date.now() / 1000) + 300,
});

describe("[unit|client-hooks] - [PaymentPreference|success] - selects preferred chain", () => {
  test("selectRequirement picks preferred chain when present", async () => {
    const hook = PaymentPreference.chain(["eip155:84532"]);
    const accepts = [
      makeRequirement("eip155:324705682", "100"),
      makeRequirement("eip155:84532", "100"),
    ];
    const selected = await hook.selectRequirement?.(makeContext(accepts));
    expect(selected?.network).toBe("eip155:84532");
  });
});

describe("[unit|client-hooks] - [PaymentPreference|success] - selects cheapest amount", () => {
  test("selectRequirement picks lowest amount in same network and asset", async () => {
    const hook = PaymentPreference.cheapest();
    const accepts = [
      makeRequirement("eip155:84532", "100"),
      makeRequirement("eip155:84532", "50"),
    ];
    const selected = await hook.selectRequirement?.(makeContext(accepts));
    expect(selected?.amount).toBe("50");
  });
});

describe("[unit|client-hooks] - [combineHooks|success] - flattens hook arrays", () => {
  test("combineHooks returns ordered flat hook list", () => {
    const hooks = combineHooks(PaymentPreference.chain(["eip155:84532"]), [
      PaymentPreference.cheapest(),
      Logger.console({ enabled: false }),
    ]);
    expect(hooks).toHaveLength(3);
    expect(hooks[0]?.name).toBe("PaymentPreference.chain");
    expect(hooks[1]?.name).toBe("PaymentPreference.cheapest");
  });
});
