/**
 * Middleware Next Tests
 * Tests the Next.js payment proxy and resource server
 */
import { describe, expect, test } from "bun:test";
import { paymentProxy, x402ResourceServer } from "../src";
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

    expect(() => server.getRequirements("eip155:8453")).toThrow(
      "No scheme registered",
    );
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
      server,
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
      server,
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
      server,
    );

    const request = new Request("http://localhost/api/users");
    const response = await proxy(request);

    expect(response.status).toBe(402);
  });

  test("[paymentProxy|success] - settles after successful upstream response", async () => {
    const facilitatorClient: HTTPFacilitatorClient = {
      async verify() {
        return { success: true, payerAddress: "0x123" };
      },
      async settle() {
        return { success: true, txHash: "0xabc" };
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
      server,
      async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );

    const request = new Request("http://localhost/api/protected", {
      headers: {
        "PAYMENT-SIGNATURE":
          "eyJ4NDAyVmVyc2lvbiI6Miwic2NoZW1lIjoiZXhhY3QiLCJuZXR3b3JrIjoiZWlwMTU1Ojg0NTMyIiwicGF5bG9hZCI6eyJzaWduYXR1cmUiOiIweDRjMmQ4Zjg3MjI1NjllNmQ1MTkwYjczNmI5Njk4NzRkMzliNDRlOTFkMTJhMzJiYzY2YjRmNzkxM2Q2MmY4YTZhNWIwMGViZTFlN2ExNmQ0NzQxOWFhM2FjYTQ3OWQzZDVlZjA4MWRiYWI0ZjY3Y2Q4N2M0YWQ0NmYxYzNjMjUxYjEiLCJhdXRob3JpemF0aW9uIjp7ImZyb20iOiIweDcxNDQxRjg2QjUzQkUyNjQ0N0Q1QjI4Q0QxMzQ5NkUyRjUzRjFjRzYiLCJ0byI6IjB4QzUxQTY2NEE5NTY3YmM5ODNjYzRhOWQ2YzY0NEI4ZWQxODBBZTk2YiIsInZhbHVlIjoiMTAwMDAwMCIsInZhbGlkQWZ0ZXIiOiIxNzU4MTE4MzQ2IiwidmFsaWRCZWZvcmUiOiIxNzU4MTE5NDAwIiwibm9uY2UiOiIweDEyMzQ1Njc4OTBhYmNkZWYxMjM0NTY3ODkwYWJjZGVmMTIzNDU2Nzg5MGFiY2RlZjEyMzQ1Njc4OTBhYmNkZWYifX0sInJlcXVlc3QiOnsibWV0aG9kIjoiR0VUIiwidXJsIjoiaHR0cHM6Ly9hcGkuZXhhbXBsZS5jb20iLCJoZWFkZXJzIjp7fX19",
      },
    });

    const response = await proxy(request as never);

    expect(response.status).toBe(200);
    expect(response.headers.get("PAYMENT-RESPONSE")).toBeDefined();
  });

  test("[paymentProxy|success] - skips settlement when upstream response is error", async () => {
    const facilitatorClient: HTTPFacilitatorClient = {
      async verify() {
        return { success: true, payerAddress: "0x123" };
      },
      async settle() {
        return { success: false, error: "should-not-run" };
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
      server,
      async () =>
        new Response(JSON.stringify({ ok: false }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
    );

    const request = new Request("http://localhost/api/protected", {
      headers: {
        "PAYMENT-SIGNATURE":
          "eyJ4NDAyVmVyc2lvbiI6Miwic2NoZW1lIjoiZXhhY3QiLCJuZXR3b3JrIjoiZWlwMTU1Ojg0NTMyIiwicGF5bG9hZCI6eyJzaWduYXR1cmUiOiIweDRjMmQ4Zjg3MjI1NjllNmQ1MTkwYjczNmI5Njk4NzRkMzliNDRlOTFkMTJhMzJiYzY2YjRmNzkxM2Q2MmY4YTZhNWIwMGViZTFlN2ExNmQ0NzQxOWFhM2FjYTQ3OWQzZDVlZjA4MWRiYWI0ZjY3Y2Q4N2M0YWQ0NmYxYzNjMjUxYjEiLCJhdXRob3JpemF0aW9uIjp7ImZyb20iOiIweDcxNDQxRjg2QjUzQkUyNjQ0N0Q1QjI4Q0QxMzQ5NkUyRjUzRjFjRzYiLCJ0byI6IjB4QzUxQTY2NEE5NTY3YmM5ODNjYzRhOWQ2YzY0NEI4ZWQxODBBZTk2YiIsInZhbHVlIjoiMTAwMDAwMCIsInZhbGlkQWZ0ZXIiOiIxNzU4MTE4MzQ2IiwidmFsaWRCZWZvcmUiOiIxNzU4MTE5NDAwIiwibm9uY2UiOiIweDEyMzQ1Njc4OTBhYmNkZWYxMjM0NTY3ODkwYWJjZGVmMTIzNDU2Nzg5MGFiY2RlZjEyMzQ1Njc4OTBhYmNkZWYifX0sInJlcXVlc3QiOnsibWV0aG9kIjoiR0VUIiwidXJsIjoiaHR0cHM6Ly9hcGkuZXhhbXBsZS5jb20iLCJoZWFkZXJzIjp7fX19",
      },
    });

    const response = await proxy(request as never);

    expect(response.status).toBe(500);
    expect(response.headers.get("PAYMENT-RESPONSE")).toBeNull();
  });
});
