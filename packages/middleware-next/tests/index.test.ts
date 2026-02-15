/**
 * Middleware Next Tests
 * Tests the Next.js payment proxy and resource server
 */
import { test, expect, describe } from "bun:test";
import { x402ResourceServer, paymentProxy } from "../src";
import type { HTTPFacilitatorClient, PaymentScheme } from "../src/types";

describe("[unit|middleware-next]: x402ResourceServer", () => {
  test("[register|success] - registers payment scheme", () => {
    const facilitatorClient: HTTPFacilitatorClient = {
      async verify() {
        return { success: true, payerAddress: "0x123" };
      },
    };

    const mockScheme: PaymentScheme = {
      name: "exact",
      getRequirements: () => ({
        scheme: "exact",
        network: "eip155:8453",
        amount: "1000000",
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
        payTo: "0x1234567890123456789012345678901234567890" as `0x${string}`,
        maxTimeoutSeconds: 300,
        extra: {},
      }),
    };

    const server = new x402ResourceServer(facilitatorClient);
    server.register("eip155:8453", mockScheme);

    const requirements = server.getRequirements("eip155:8453");
    expect(requirements.scheme).toBe("exact");
    expect(requirements.network).toBe("eip155:8453");
  });

  test("[getRequirements|error] - throws for unregistered chain", () => {
    const facilitatorClient: HTTPFacilitatorClient = {
      async verify() {
        return { success: true, payerAddress: "0x123" };
      },
    };

    const server = new x402ResourceServer(facilitatorClient);

    expect(() => server.getRequirements("eip155:8453")).toThrow("No scheme registered");
  });

  test("[getAllRequirements|success] - returns all registered schemes", () => {
    const facilitatorClient: HTTPFacilitatorClient = {
      async verify() {
        return { success: true, payerAddress: "0x123" };
      },
    };

    const mockScheme: PaymentScheme = {
      name: "exact",
      getRequirements: () => ({
        scheme: "exact",
        network: "eip155:8453",
        amount: "1000000",
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
        payTo: "0x1234567890123456789012345678901234567890" as `0x${string}`,
        maxTimeoutSeconds: 300,
        extra: {},
      }),
    };

    const server = new x402ResourceServer(facilitatorClient);
    server.register("eip155:8453", mockScheme);
    server.register("eip155:1", mockScheme);

    const allRequirements = server.getAllRequirements();
    expect(allRequirements).toHaveLength(2);
  });
});

describe("[unit|middleware-next]: paymentProxy", () => {
  test("[paymentProxy|noPayment] - returns 402 when no payment header", async () => {
    const facilitatorClient: HTTPFacilitatorClient = {
      async verify() {
        return { success: true, payerAddress: "0x123" };
      },
    };

    const server = new x402ResourceServer(facilitatorClient);

    const proxy = paymentProxy(
      {
        "/api/protected": {
          accepts: {
            scheme: "exact",
            price: "1000000",
            network: "eip155:8453",
            payTo: "0x1234567890123456789012345678901234567890",
          },
          description: "Protected resource",
        },
      },
      server
    );

    const request = new Request("http://localhost/api/protected");
    const response = await proxy(request);

    expect(response.status).toBe(402);
    const body = await response.json();
    expect(body.error).toBe("Payment required");
  });

  test("[paymentProxy|notFound] - returns 404 for non-matching route", async () => {
    const facilitatorClient: HTTPFacilitatorClient = {
      async verify() {
        return { success: true, payerAddress: "0x123" };
      },
    };

    const server = new x402ResourceServer(facilitatorClient);

    const proxy = paymentProxy(
      {
        "/api/protected": {
          accepts: {
            scheme: "exact",
            price: "1000000",
            network: "eip155:8453",
            payTo: "0x1234567890123456789012345678901234567890",
          },
        },
      },
      server
    );

    const request = new Request("http://localhost/other/path");
    const response = await proxy(request);

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("Route not found");
  });

  test("[paymentProxy|wildcard] - matches wildcard routes", async () => {
    const facilitatorClient: HTTPFacilitatorClient = {
      async verify() {
        return { success: true, payerAddress: "0x123" };
      },
    };

    const server = new x402ResourceServer(facilitatorClient);

    const proxy = paymentProxy(
      {
        "/api/*": {
          accepts: {
            scheme: "exact",
            price: "1000000",
            network: "eip155:8453",
            payTo: "0x1234567890123456789012345678901234567890",
          },
        },
      },
      server
    );

    const request = new Request("http://localhost/api/users");
    const response = await proxy(request);

    expect(response.status).toBe(402);
  });
});
