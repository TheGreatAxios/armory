/**
 * @deprecated Use framework-specific packages directly for smaller bundles and better type inference.
 * This barrel package re-exports all framework middleware packages.
 */

// Bun
export * from "@armory-sh/middleware-bun";

// Express
export { paymentMiddleware as expressPaymentMiddleware } from "@armory-sh/middleware-express";
export type { PaymentMiddlewareConfig as ExpressPaymentMiddlewareConfig } from "@armory-sh/middleware-express";

// Hono
export * from "@armory-sh/middleware-hono";

// Elysia
export { paymentMiddleware as elysiaPaymentMiddleware } from "@armory-sh/middleware-elysia";
export type { PaymentMiddlewareConfig as ElysiaPaymentMiddlewareConfig } from "@armory-sh/middleware-elysia";
